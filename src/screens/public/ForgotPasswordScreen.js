import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../shared/firebase';
import Spinner from '../../components/Spinner';

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setSent(true);
    } catch (e) {
      const code = e.code || '';
      if (code === 'auth/invalid-email') {
        setError('That email address is not valid.');
      } else if (code === 'auth/user-not-found') {
        // Show success anyway to prevent email enumeration
        setSent(true);
      } else {
        setError(e.message.replace('Firebase: ', '').replace(/\(.*\)\.?/, '').trim() || 'Failed to send reset email.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#0366ae" />
          <Text style={styles.backText}>Sign In</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.logo}>IMS</Text>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.sub}>Enter your email to receive a reset link</Text>
        </View>

        <View style={styles.form}>
          {sent ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#16a34a" />
              <Text style={styles.successTitle}>Email Sent!</Text>
              <Text style={styles.successText}>
                A password reset link has been sent to {email.trim()}.{'\n'}Check your inbox and follow the instructions.
              </Text>
              <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.backBtnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color="#9fb8d4" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor="#b8ddf8"
                    value={email}
                    onChangeText={v => { setEmail(v); setError(null); }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitDisabled]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading ? <Spinner size="small" color="#fff" /> : <Text style={styles.submitText}>Send Reset Link</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  scroll: { padding: 24, flexGrow: 1 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backText: { color: '#0366ae', fontSize: 14, marginLeft: 2 },
  header: { alignItems: 'center', marginBottom: 36 },
  logo: { fontSize: 36, fontWeight: '900', color: '#103a7a', letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#103a7a', marginBottom: 4 },
  sub: { fontSize: 14, color: '#9fb8d4', textAlign: 'center' },
  form: {
    backgroundColor: '#fff', borderRadius: 20,
    borderWidth: 1, borderColor: '#b8ddf8', padding: 24, gap: 16,
    shadowColor: '#0366ae', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  fieldWrap: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: '#103a7a', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 999,
    backgroundColor: '#f7fbff', paddingHorizontal: 12, height: 44,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: '#103a7a' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 10, padding: 10,
  },
  errorText: { fontSize: 12, color: '#dc2626', flex: 1 },
  submitBtn: {
    backgroundColor: '#0366ae', borderRadius: 999,
    height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successBox: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#16a34a' },
  successText: { fontSize: 14, color: '#9fb8d4', textAlign: 'center', lineHeight: 22 },
  backBtn: {
    backgroundColor: '#0366ae', borderRadius: 999,
    paddingHorizontal: 32, paddingVertical: 12, marginTop: 8,
  },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
