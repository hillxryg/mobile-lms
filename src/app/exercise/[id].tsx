import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import type { Material, Profile, Submission } from '../../types/database';

type SubmissionWithStudent = Submission & { profiles: Pick<Profile, 'full_name' | 'email'> | null };

const BUCKET = 'lms-files';

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'instructor' | 'student' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [exercise, setExercise] = useState<Material | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    setUserId(uid);
    const [{ data: profile }, { data: mat }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', uid).single(),
      supabase.from('materials').select('*').eq('id', id).single(),
    ]);
    setRole(profile?.role ?? null);
    setExercise(mat as Material | null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !exercise || !userId) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Exercise' }} />
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: exercise.title }} />
      {role === 'instructor' ? (
        <InstructorView exercise={exercise} />
      ) : (
        <StudentView exercise={exercise} userId={userId} />
      )}
    </>
  );
}

function Header({ exercise }: { exercise: Material }) {
  const due = exercise.due_date ? new Date(exercise.due_date) : null;
  const overdue = due ? due.getTime() < Date.now() : false;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{exercise.title}</Text>
      <View style={styles.badgeRow}>
        {due && (
          <View style={[styles.badge, overdue ? styles.badgeRed : styles.badgeBlue]}>
            <Text style={[styles.badgeText, overdue ? styles.textRed : styles.textBlue]}>
              {overdue ? 'Overdue · ' : 'Due · '}
              {due.toLocaleString()}
            </Text>
          </View>
        )}
        <View style={[styles.badge, styles.badgeGray]}>
          <Text style={[styles.badgeText, styles.textGray]}>Max {exercise.max_score} pts</Text>
        </View>
      </View>
      <Text style={styles.label}>Instructions</Text>
      <Text style={styles.body}>{exercise.instructions || 'No instructions provided.'}</Text>
      {exercise.file_url && (
        <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(exercise.file_url!)}>
          <Text style={styles.linkText}>📎 {exercise.file_name ?? 'Attachment'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

async function uploadFile(
  folder: string,
  file: DocumentPicker.DocumentPickerAsset
): Promise<string> {
  const buffer = await (await fetch(file.uri)).arrayBuffer();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}_${safe}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.mimeType ?? 'application/octet-stream' });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function StudentView({ exercise, userId }: { exercise: Material; userId: string }) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('material_id', exercise.id)
      .eq('student_id', userId)
      .maybeSingle();
    setSubmission(data as Submission | null);
    setAnswer(data?.answer_text ?? '');
    setLoading(false);
  }, [exercise.id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!res.canceled) setFile(res.assets[0]);
  };

  const submit = async () => {
    if (!answer.trim() && !file && !submission?.file_url) {
      Alert.alert('Nothing to submit', 'Write an answer or attach a file.');
      return;
    }
    setSaving(true);
    try {
      let file_url = submission?.file_url ?? null;
      let file_name = submission?.file_name ?? null;
      if (file) {
        file_url = await uploadFile(`submissions/${exercise.id}/${userId}`, file);
        file_name = file.name;
      }
      const payload = {
        material_id: exercise.id,
        student_id: userId,
        answer_text: answer.trim() || null,
        file_url,
        file_name,
        submitted_at: new Date().toISOString(),
      };
      const { error } = submission
        ? await supabase.from('submissions').update(payload).eq('id', submission.id)
        : await supabase.from('submissions').insert(payload);
      if (error) throw error;
      setFile(null);
      await load();
      Alert.alert('Submitted', 'Your work has been submitted.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Submission failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const graded = submission?.score !== null && submission?.score !== undefined;
  const locked = graded;
  const overdue = exercise.due_date ? new Date(exercise.due_date).getTime() < Date.now() : false;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Header exercise={exercise} />

        {graded && (
          <View style={[styles.card, styles.gradeCard]}>
            <Text style={styles.label}>Grade</Text>
            <Text style={styles.score}>
              {submission!.score} / {exercise.max_score}
            </Text>
            {!!submission!.feedback && (
              <>
                <Text style={[styles.label, { marginTop: 12 }]}>Feedback</Text>
                <Text style={styles.body}>{submission!.feedback}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Your Submission</Text>
            {submission && (
              <View style={[styles.badge, styles.badgeGreen]}>
                <Text style={[styles.badgeText, styles.textGreen]}>
                  {graded ? 'Graded' : 'Submitted'}
                </Text>
              </View>
            )}
          </View>
          {submission && (
            <Text style={styles.meta}>
              Last submitted {new Date(submission.submitted_at).toLocaleString()}
            </Text>
          )}

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Type your answer..."
            placeholderTextColor="#9CA3AF"
            multiline
            value={answer}
            onChangeText={setAnswer}
            editable={!locked}
          />

          {submission?.file_url && !file && (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL(submission.file_url!)}
            >
              <Text style={styles.linkText}>📎 {submission.file_name ?? 'Submitted file'}</Text>
            </TouchableOpacity>
          )}
          {file && <Text style={styles.meta}>Selected: {file.name}</Text>}

          {!locked && (
            <>
              <TouchableOpacity style={styles.secondaryBtn} onPress={pick}>
                <Text style={styles.secondaryText}>
                  {file || submission?.file_url ? 'Replace File' : 'Attach File'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, saving && styles.disabled]}
                onPress={submit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>
                    {submission ? 'Update Submission' : overdue ? 'Submit (Late)' : 'Submit'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InstructorView({ exercise }: { exercise: Material }) {
  const [subs, setSubs] = useState<SubmissionWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubmissionWithStudent | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('submissions')
      .select('*, profiles:student_id(full_name, email)')
      .eq('material_id', exercise.id)
      .order('submitted_at', { ascending: false });
    setSubs((data as unknown as SubmissionWithStudent[]) ?? []);
    setLoading(false);
  }, [exercise.id]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (s: SubmissionWithStudent) => {
    setSelected(s);
    setScore(s.score !== null && s.score !== undefined ? String(s.score) : '');
    setFeedback(s.feedback ?? '');
  };

  const saveGrade = async () => {
    if (!selected) return;
    const n = parseInt(score, 10);
    if (isNaN(n) || n < 0 || n > exercise.max_score) {
      Alert.alert('Invalid score', `Enter a number between 0 and ${exercise.max_score}.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('submissions')
      .update({ score: n, feedback: feedback.trim() || null })
      .eq('id', selected.id);
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setSelected(null);
    load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (selected) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Text style={styles.back}>← All submissions</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.title}>{selected.profiles?.full_name ?? 'Student'}</Text>
            <Text style={styles.meta}>{selected.profiles?.email}</Text>
            <Text style={styles.meta}>
              Submitted {new Date(selected.submitted_at).toLocaleString()}
              {exercise.due_date && new Date(selected.submitted_at) > new Date(exercise.due_date)
                ? ' (late)'
                : ''}
            </Text>

            <Text style={[styles.label, { marginTop: 16 }]}>Answer</Text>
            <Text style={styles.body}>{selected.answer_text || 'No text answer.'}</Text>

            {selected.file_url && (
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => Linking.openURL(selected.file_url!)}
              >
                <Text style={styles.linkText}>📎 {selected.file_name ?? 'Submitted file'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Grade</Text>
            <Text style={styles.label}>Score (max {exercise.max_score})</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={score}
              onChangeText={setScore}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={[styles.label, { marginTop: 12 }]}>Feedback</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Write feedback..."
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.disabled]}
              onPress={saveGrade}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Save Grade</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <FlatList
      data={subs}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <>
          <Header exercise={exercise} />
          <Text style={styles.sectionTitle}>Submissions ({subs.length})</Text>
        </>
      }
      ListEmptyComponent={<Text style={styles.empty}>No submissions yet.</Text>}
      renderItem={({ item }) => {
        const graded = item.score !== null && item.score !== undefined;
        return (
          <TouchableOpacity style={styles.card} onPress={() => open(item)}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.profiles?.full_name ?? 'Student'}</Text>
              <View style={[styles.badge, graded ? styles.badgeGreen : styles.badgeAmber]}>
                <Text style={[styles.badgeText, graded ? styles.textGreen : styles.textAmber]}>
                  {graded ? `${item.score}/${exercise.max_score}` : 'Needs grading'}
                </Text>
              </View>
            </View>
            <Text style={styles.meta}>{new Date(item.submitted_at).toLocaleString()}</Text>
            {item.file_url && (
              <TouchableOpacity onPress={() => Linking.openURL(item.file_url!)}>
                <Text style={styles.linkText}>📎 {item.file_name ?? 'File'}</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  container: { padding: 16, paddingBottom: 40, backgroundColor: '#F3F4F6', flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gradeCard: { borderLeftWidth: 4, borderLeftColor: '#10B981' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  name: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  body: { fontSize: 15, color: '#374151', lineHeight: 22 },
  meta: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  score: { fontSize: 32, fontWeight: '800', color: '#059669' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeBlue: { backgroundColor: '#E0E7FF' },
  textBlue: { color: '#4338CA' },
  badgeRed: { backgroundColor: '#FEE2E2' },
  textRed: { color: '#B91C1C' },
  badgeGray: { backgroundColor: '#F3F4F6' },
  textGray: { color: '#4B5563' },
  badgeGreen: { backgroundColor: '#D1FAE5' },
  textGreen: { color: '#047857' },
  badgeAmber: { backgroundColor: '#FEF3C7' },
  textAmber: { color: '#B45309' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryText: { color: '#4F46E5', fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.6 },
  linkBtn: { marginTop: 12 },
  linkText: { color: '#4F46E5', fontSize: 14, fontWeight: '600', marginTop: 6 },
  back: { color: '#4F46E5', fontWeight: '600', fontSize: 15, marginBottom: 12 },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 24 },
});