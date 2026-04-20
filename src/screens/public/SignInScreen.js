import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/Spinner';
import { PUBLIC_ROUTES } from '../../constants/routes';
import C from '../../theme/colors';

export default function SignInScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { SignIn, err, loadingPage } = UserAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const completeUserEmail = (userName) => {
    const u = userName.trim();
    if (u.includes('@')) return u;
    if (u === 'isims') return 'isims@is.is';
    if (u === 'isgis') return 'isgis@is.is';
    return u.slice(-3) === 'ims' ? u + '@ims-metals.com' : u + '@gismetals.com';
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    const ok = await SignIn(completeUserEmail(email), password);
    setLoading(false);
    // Navigation handled automatically by RootNavigator when user state changes
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Back to home */}
        <TouchableOpacity style={styles.back} onPress={() => navigation.navigate(PUBLIC_ROUTES.HOME)}>
          <Ionicons name="chevron-back" size={20} color={C.accent} />
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>IMS</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.sub}>Sign in to your account</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={C.text2} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={C.text3}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={C.text2} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={C.text3}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.text2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {err ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
              <Text style={styles.errorText}>{err.replace('Firebase: ', '').replace(/\(.*\)/, '').trim()}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitDisabled]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading
              ? <Spinner />
              : <Text style={styles.submitText}>Sign In</Text>
            }
          </TouchableOpacity>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => navigation.navigate(PUBLIC_ROUTES.FORGOT_PASSWORD)}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  scroll: { padding: 24, flexGrow: 1 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backText: { color: C.accent, fontSize: 14, marginLeft: 2 },
  header: { alignItems: 'center', marginBottom: 36 },
  logo: { fontSize: 36, fontWeight: '900', color: C.text1, letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: C.text1, marginBottom: 4 },
  sub: { fontSize: 14, color: C.text2 },
  form: {
    backgroundColor: C.bg2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    gap: 16,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  fieldWrap: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: C.text1, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    backgroundColor: C.bgSecondary,
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: C.text1 },
  eyeBtn: { padding: 4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.dangerDim,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
  },
  errorText: { fontSize: 12, color: C.danger, flex: 1 },
  submitBtn: {
    backgroundColor: C.accent,
    borderRadius: 999,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: C.text1, fontSize: 16, fontWeight: '700' },
  forgotBtn: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { fontSize: 13, color: C.accent, fontWeight: '600' },
});
