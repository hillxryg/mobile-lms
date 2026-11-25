import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import type { Role } from '../../types/database';

const ROLES: { value: Role; label: string; icon: string; desc: string }[] = [
  { value: 'student', label: 'Student', icon: '🎒', desc: 'Join classes & submit work' },
  { value: 'instructor', label: 'Instructor', icon: '🧑‍🏫', desc: 'Create classes & grade' },
];

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<Role>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const mail = email.trim();
    if (!mail || !password || (isSignUp && !fullName.trim())) {
      Alert.alert('Missing info', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { data: { full_name: fullName.trim(), role } },
      });
      if (error) Alert.alert('Sign up failed', error.message);
      else if (!data.session)
        Alert.alert('Check your email', 'Confirm your email address, then sign in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (error) Alert.alert('Sign in failed', error.message);
    }
    setLoading(false);
  };

  const field = (key: string) => [styles.inputWrap, focused === key && styles.inputWrapFocused];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.circle, styles.circleA]} />
          <View style={[styles.circle, styles.circleB]} />
          <View style={[styles.circle, styles.circleC]} />
          <View style={styles.logo}>
            <Text style={styles.logoIcon}>🎓</Text>
          </View>
          <Text style={styles.title}>Mobile LMS</Text>
          <Text style={styles.tagline}>Learn, teach and grow — all in one place</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isSignUp ? 'Create account' : 'Welcome back'}</Text>
          <Text style={styles.cardSub}>
            {isSignUp ? 'Pick your role and get started' : 'Sign in to continue'}
          </Text>

          {isSignUp && (
            <>
              <Text style={styles.label}>I am a</Text>
              <View style={styles.roleRow}>
                {ROLES.map((r) => {
                  const active = role === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      activeOpacity={0.85}
                      style={[styles.roleCard, active && styles.roleCardActive]}
                      onPress={() => setRole(r.value)}
                    >
                      <Text style={styles.roleIcon}>{r.icon}</Text>
                      <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>
                        {r.label}
                      </Text>
                      <Text style={styles.roleDesc}>{r.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Full name</Text>
              <View style={field('name')}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                  placeholder="Jane Doe"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <View style={field('email')}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="you@school.edu"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={field('password')}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPw}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={10}>
              <Text style={styles.showText}>{showPw ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={submit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </Text>
          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} hitSlop={8}>
            <Text style={styles.switch}> {isSignUp ? 'Sign in' : 'Sign up'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f3ff' },
  container: { flexGrow: 1, paddingBottom: 32 },

  hero: {
    backgroundColor: '#4f46e5',
    paddingTop: Platform.OS === 'ios' ? 90 : 70,
    paddingBottom: 80,
    alignItems: 'center',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
  circleA: { width: 220, height: 220, top: -70, left: -60, opacity: 0.08 },
  circleB: { width: 160, height: 160, top: 30, right: -50, opacity: 0.1 },
  circleC: { width: 100, height: 100, bottom: -30, left: 60, opacity: 0.07 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e1b4b',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    transform: [{ rotate: '-6deg' }],
  },
  logoIcon: { fontSize: 38 },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', marginTop: 18, letterSpacing: 0.5 },
  tagline: { fontSize: 14, color: '#c7d2fe', marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: -48,
    borderRadius: 24,
    padding: 22,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  cardSub: { fontSize: 14, color: '#6b7280', marginTop: 2, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 16 },

  roleRow: { flexDirection: 'row', gap: 10 },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  roleCardActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  roleIcon: { fontSize: 28, marginBottom: 6 },
  roleLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  roleLabelActive: { color: '#4f46e5' },
  roleDesc: { fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 2 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputWrapFocused: { borderColor: '#4f46e5', backgroundColor: '#fff' },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#111827' },
  showText: { color: '#4f46e5', fontWeight: '700', fontSize: 13 },

  button: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 26,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#6b7280', fontSize: 14 },
  switch: { color: '#4f46e5', fontWeight: '800', fontSize: 14 },
});