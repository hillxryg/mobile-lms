import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Course, Material, Profile } from '../../types/database';

type UpcomingItem = Material & { course_title: string; pending?: number };

const genCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const storagePath = (url: string) => {
  const i = url.indexOf('/lms-files/');
  return i >= 0 ? decodeURIComponent(url.slice(i + 11).split('?')[0]) : url;
};

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const isInstructor = profile?.role === 'instructor';

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    const { data: p } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (!p) {
      setLoading(false);
      return;
    }
    setProfile(p as Profile);

    let courseList: Course[] = [];
    if (p.role === 'instructor') {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('instructor_id', uid)
        .order('created_at', { ascending: false });
      courseList = (data as Course[]) ?? [];
    } else {
      const { data } = await supabase
        .from('enrollments')
        .select('courses(*)')
        .eq('student_id', uid)
        .order('enrolled_at', { ascending: false });
      courseList = ((data as any[]) ?? []).map((e) => e.courses).filter(Boolean) as Course[];
    }
    setCourses(courseList);

    const ids = courseList.map((c) => c.id);
    if (ids.length === 0) {
      setUpcoming([]);
      setLoading(false);
      return;
    }
    const titleOf = (id: string) => courseList.find((c) => c.id === id)?.title ?? '';

    const { data: ex } = await supabase
      .from('materials')
      .select('*')
      .in('course_id', ids)
      .eq('type', 'exercise')
      .order('due_date', { ascending: true });
    const exercises = (ex as Material[]) ?? [];

    if (p.role === 'student') {
      const { data: subs } = await supabase.from('submissions').select('material_id').eq('student_id', uid);
      const done = new Set((subs ?? []).map((s: any) => s.material_id));
      const now = Date.now();
      setUpcoming(
        exercises
          .filter((m) => !done.has(m.id) && m.due_date && new Date(m.due_date).getTime() >= now)
          .slice(0, 5)
          .map((m) => ({ ...m, course_title: titleOf(m.course_id) }))
      );
    } else {
      const exIds = exercises.map((m) => m.id);
      const { data: subs } = exIds.length
        ? await supabase.from('submissions').select('material_id, score').in('material_id', exIds)
        : { data: [] as any[] };
      const pending: Record<string, number> = {};
      (subs ?? []).forEach((s: any) => {
        if (s.score === null) pending[s.material_id] = (pending[s.material_id] ?? 0) + 1;
      });
      setUpcoming(
        exercises
          .filter((m) => pending[m.id])
          .slice(0, 5)
          .map((m) => ({ ...m, course_title: titleOf(m.course_id), pending: pending[m.id] }))
      );
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    setLoading(true);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    setTitle('');
    setCode('');
    setJoinCode('');
  };

  const createClass = async () => {
    if (!title.trim() || !code.trim() || !profile) return Alert.alert('Enter a title and course code.');
    setSaving(true);
    let error: any = null;
    for (let i = 0; i < 5; i++) {
      ({ error } = await supabase.from('courses').insert({
        title: title.trim(),
        code: code.trim(),
        join_code: genCode(),
        instructor_id: profile.id,
      }));
      if (!error || error.code !== '23505') break;
    }
    setSaving(false);
    if (error) return Alert.alert('Error', error.message);
    closeModal();
    load();
  };

  const joinClass = async () => {
    if (joinCode.trim().length !== 6 || !profile) return Alert.alert('Enter the 6-character join code.');
    setSaving(true);
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('join_code', joinCode.trim().toUpperCase())
      .maybeSingle();
    if (!course) {
      setSaving(false);
      return Alert.alert('Invalid code', 'No class found with that join code.');
    }
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', course.id)
      .eq('student_id', profile.id)
      .maybeSingle();
    if (existing) {
      setSaving(false);
      return Alert.alert('Already enrolled', 'You are already in this class.');
    }
    const { error } = await supabase
      .from('enrollments')
      .insert({ course_id: course.id, student_id: profile.id });
    setSaving(false);
    if (error) return Alert.alert('Error', error.message);
    closeModal();
    load();
  };

  const deleteCourse = (course: Course) =>
    Alert.alert('Delete course', `Delete "${course.title}" with all its materials, submissions, and enrollments?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { data: mats } = await supabase.from('materials').select('id, file_url').eq('course_id', course.id);
          const ids = (mats ?? []).map((m) => m.id);
          if (ids.length) {
            const { data: subs } = await supabase.from('submissions').select('file_url').in('material_id', ids);
            const paths = [...(mats ?? []), ...(subs ?? [])]
              .filter((r) => r.file_url)
              .map((r) => storagePath(r.file_url as string));
            if (paths.length) await supabase.storage.from('lms-files').remove(paths);
            await supabase.from('submissions').delete().in('material_id', ids);
            await supabase.from('materials').delete().eq('course_id', course.id);
          }
          await supabase.from('enrollments').delete().eq('course_id', course.id);
          const { error } = await supabase.from('courses').delete().eq('id', course.id);
          if (error) Alert.alert('Error', error.message);
          else load();
        },
      },
    ]);

  const signOut = () => supabase.auth.signOut();

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const header = (
    <View>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hi, {profile?.full_name?.split(' ')[0] ?? 'there'}</Text>
          <Text style={styles.role}>{isInstructor ? 'Instructor' : 'Student'}</Text>
        </View>
        <Pressable onPress={signOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>{isInstructor ? 'Pending Grading' : 'Upcoming Due'}</Text>
      {upcoming.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>{isInstructor ? 'Nothing to grade.' : 'No upcoming exercises.'}</Text>
        </View>
      ) : (
        upcoming.map((m) => (
          <Pressable key={m.id} style={styles.card} onPress={() => router.push(`/exercise/${m.id}`)}>
            <Text style={styles.cardTitle}>{m.title}</Text>
            <Text style={styles.muted}>{m.course_title}</Text>
            {isInstructor ? (
              <Text style={styles.badge}>{m.pending} to grade</Text>
            ) : (
              m.due_date && <Text style={styles.badge}>Due {fmtDate(m.due_date)}</Text>
            )}
          </Pressable>
        ))
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>My Classes</Text>
        <Pressable style={styles.addBtn} onPress={() => setModalOpen(true)}>
          <Text style={styles.addBtnText}>{isInstructor ? '+ Create Class' : '+ Join Class'}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={courses}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.muted}>
              {isInstructor ? 'No classes yet. Create one.' : 'Not enrolled in any class. Join one.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/course/${item.id}`)}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.muted}>{item.code}</Text>
                {isInstructor && <Text style={styles.joinCode}>Join code: {item.join_code}</Text>}
              </View>
              {isInstructor && (
                <Pressable
                  style={styles.deleteBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteCourse(item);
                  }}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        )}
      />

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{isInstructor ? 'Create Class' : 'Join Class'}</Text>
            {isInstructor ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Class title"
                  value={title}
                  onChangeText={setTitle}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Course code (e.g. CS101)"
                  autoCapitalize="characters"
                  value={code}
                  onChangeText={setCode}
                />
              </>
            ) : (
              <TextInput
                style={styles.input}
                placeholder="6-character join code"
                autoCapitalize="characters"
                maxLength={6}
                value={joinCode}
                onChangeText={setJoinCode}
              />
            )}
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={closeModal}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={isInstructor ? createClass : joinClass}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>{isInstructor ? 'Create' : 'Join'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  hello: { fontSize: 24, fontWeight: '700', color: '#111827' },
  role: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  signOut: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#fee2e2' },
  signOutText: { color: '#b91c1c', fontWeight: '600' },
  section: { fontSize: 17, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { backgroundColor: '#4f46e5', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, marginTop: 10 },
  addBtnText: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  muted: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
    backgroundColor: '#e0e7ff',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  joinCode: { marginTop: 8, fontSize: 13, fontWeight: '600', color: '#059669' },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  deleteBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14, color: '#111827' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
    backgroundColor: '#f9fafb',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, backgroundColor: '#4f46e5', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  btnGhost: { backgroundColor: '#f3f4f6' },
  btnGhostText: { color: '#374151', fontWeight: '600' },
});