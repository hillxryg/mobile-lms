import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform,
  Pressable, SafeAreaView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import type { Course, Material } from '../../types/database';

type Tab = 'presentation' | 'exercise';
const ALLOWED_EXT = ['ppt', 'pptx', 'pdf'];

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isInstructor, setIsInstructor] = useState(false);
  const [tab, setTab] = useState<Tab>('presentation');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Tab | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    const [c, m, p] = await Promise.all([
      supabase.from('courses').select('*').eq('id', id).single(),
      supabase.from('materials').select('*').eq('course_id', id).order('created_at', { ascending: false }),
      uid ? supabase.from('profiles').select('role').eq('id', uid).single() : Promise.resolve({ data: null }),
    ]);
    if (c.data) setCourse(c.data as Course);
    if (m.data) setMaterials(m.data as Material[]);
    setIsInstructor((p.data as { role?: string } | null)?.role === 'instructor');
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setTitle(''); setInstructions(''); setDueDate(''); setMaxScore('100'); setFile(null);
  };

  const closeModal = () => { setModal(null); resetForm(); };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    const ext = asset.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) {
      Alert.alert('Invalid file', 'Only .ppt, .pptx, or .pdf files are allowed.');
      return;
    }
    setFile(asset);
    if (!title.trim()) setTitle(asset.name.replace(/\.[^.]+$/, ''));
  };

  const uploadFile = async (asset: DocumentPicker.DocumentPickerAsset) => {
    const buffer = await (await fetch(asset.uri)).arrayBuffer();
    const safe = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${id}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage
      .from('lms-files')
      .upload(path, buffer, { contentType: asset.mimeType ?? 'application/octet-stream' });
    if (error) throw error;
    return supabase.storage.from('lms-files').getPublicUrl(path).data.publicUrl;
  };

  const savePresentation = async () => {
    if (!title.trim() || !file) {
      Alert.alert('Missing info', 'Enter a title and choose a file.');
      return;
    }
    setSaving(true);
    try {
      const url = await uploadFile(file);
      const { error } = await supabase.from('materials').insert({
        course_id: id, type: 'presentation', title: title.trim(),
        file_url: url, file_name: file.name,
      });
      if (error) throw error;
      closeModal();
      await load();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const saveExercise = async () => {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter a title.');
      return;
    }
    let due: string | null = null;
    if (dueDate.trim()) {
      const d = new Date(dueDate.trim().replace(' ', 'T'));
      if (isNaN(d.getTime())) {
        Alert.alert('Invalid date', 'Use YYYY-MM-DD or YYYY-MM-DD HH:mm.');
        return;
      }
      due = d.toISOString();
    }
    const score = parseInt(maxScore, 10);
    if (isNaN(score) || score <= 0) {
      Alert.alert('Invalid score', 'Max score must be a positive number.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('materials').insert({
      course_id: id, type: 'exercise', title: title.trim(),
      instructions: instructions.trim() || null, due_date: due, max_score: score,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    closeModal();
    await load();
  };

  const openFile = (url: string | null) => {
    if (url) Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open file.'));
  };

  const data = materials.filter((m) => m.type === tab);

  const renderItem = ({ item }: { item: Material }) => {
    if (item.type === 'presentation') {
      return (
        <Pressable style={styles.card} onPress={() => openFile(item.file_url)}>
          <View style={[styles.icon, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.iconText}>📊</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{item.file_name}</Text>
          </View>
          <Text style={styles.action}>Open</Text>
        </Pressable>
      );
    }
    const overdue = item.due_date && new Date(item.due_date) < new Date();
    return (
      <Pressable style={styles.card} onPress={() => router.push(`/exercise/${item.id}` as any)}>
        <View style={[styles.icon, { backgroundColor: '#DBEAFE' }]}>
          <Text style={styles.iconText}>📝</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSub}>
            {item.due_date ? `Due ${new Date(item.due_date).toLocaleString()}` : 'No deadline'} · {item.max_score} pts
          </Text>
        </View>
        {overdue ? <Text style={styles.overdue}>Overdue</Text> : <Text style={styles.action}>›</Text>}
      </Pressable>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: course?.code ?? 'Course', headerBackTitle: 'Back' }} />
      <View style={styles.header}>
        <Text style={styles.title}>{course?.title}</Text>
        {isInstructor && course?.join_code ? (
          <Text style={styles.joinCode}>Join code: {course.join_code}</Text>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {(['presentation', 'exercise'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'presentation' ? 'Presentations' : 'Exercises'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshing={false}
        onRefresh={load}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No {tab === 'presentation' ? 'presentations' : 'exercises'} yet.
          </Text>
        }
      />

      {isInstructor && (
        <Pressable style={styles.fab} onPress={() => setModal(tab)}>
          <Text style={styles.fabText}>
            + {tab === 'presentation' ? 'Upload Presentation' : 'Create Exercise'}
          </Text>
        </Pressable>
      )}

      <Modal visible={modal !== null} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {modal === 'presentation' ? 'Upload Presentation' : 'Create Exercise'}
            </Text>

            <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />

            {modal === 'presentation' ? (
              <Pressable style={styles.pickBtn} onPress={pickFile}>
                <Text style={styles.pickText} numberOfLines={1}>
                  {file ? `📎 ${file.name}` : 'Choose .ppt / .pptx / .pdf'}
                </Text>
              </Pressable>
            ) : (
              <>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Instructions"
                  value={instructions}
                  onChangeText={setInstructions}
                  multiline
                />
                <TextInput
                  style={styles.input}
                  placeholder="Due date (YYYY-MM-DD HH:mm) — optional"
                  value={dueDate}
                  onChangeText={setDueDate}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Max score"
                  value={maxScore}
                  onChangeText={setMaxScore}
                  keyboardType="number-pad"
                />
              </>
            )}

            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={closeModal} disabled={saving}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={modal === 'presentation' ? savePresentation : saveExercise}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>{modal === 'presentation' ? 'Upload' : 'Create'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  joinCode: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  tabs: {
    flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#E5E7EB',
    borderRadius: 10, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#2563EB' },
  list: { padding: 16, paddingBottom: 96, flexGrow: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12,
    padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  icon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20 },
  cardBody: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardSub: { marginTop: 2, fontSize: 12, color: '#6B7280' },
  action: { fontSize: 14, fontWeight: '600', color: '#2563EB', marginLeft: 8 },
  overdue: {
    fontSize: 11, fontWeight: '700', color: '#B91C1C', backgroundColor: '#FEE2E2',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden', marginLeft: 8,
  },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 48, fontSize: 15 },
  fab: {
    position: 'absolute', bottom: 24, left: 16, right: 16, backgroundColor: '#2563EB',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#111827' },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12,
    fontSize: 15, marginBottom: 10, backgroundColor: '#F9FAFB',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  pickBtn: {
    borderWidth: 1, borderColor: '#2563EB', borderStyle: 'dashed', borderRadius: 10,
    padding: 14, alignItems: 'center', marginBottom: 10,
  },
  pickText: { color: '#2563EB', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  btnGhost: { backgroundColor: '#F3F4F6' },
  btnGhostText: { color: '#374151', fontWeight: '600' },
  btnPrimary: { backgroundColor: '#2563EB' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
});