import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import type { Role } from '../../types/database';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<Role>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Mobile LMS</Text>
        <Text style={styles.subtitle}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>

        <View style={styles.card}>
          {isSignUp && (
            <>
              <Text style={styles.label}>I am a</Text>
              <View style={styles.toggle}>
                {(['student', 'instructor'] as Role[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.toggleBtn, role === r && styles.toggleActive]}
                    onPress={() => setRole(r)}
                  >
                    <Text style={[styles.toggleText, role === r && styles.toggleTextActive]}>
                      {r === 'student' ? 'Student' : 'Instructor'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Jane Doe"
                placeholderTextColor="#9ca3af"
              />
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@school.edu"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            secureTextEntry
          />

          <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
          <Text style={styles.switch}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f3f4f6' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#4f46e5', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 24, marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  toggle: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 10, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: '#4f46e5' },
  toggleText: { fontWeight: '600', color: '#6b7280' },
  toggleTextActive: { color: '#fff' },
  button: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switch: { textAlign: 'center', color: '#4f46e5', fontWeight: '600', marginTop: 20 },
});