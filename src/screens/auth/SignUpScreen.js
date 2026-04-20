import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { PUBLIC_ROUTES } from '../../constants/routes';
import C from '../../theme/colors';

export default function SignUpScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { createUser } = UserAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSignUp = async () => {
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await createUser(email, password);
    } catch (e) {
      setError(e.message?.replace('Firebase: ', '') || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top }]} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={C.accent} />
      </TouchableOpacity>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join IMS to manage your business</Text>

      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@company.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={C.text3} />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.inputRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry={!showPass} placeholderTextColor={C.text3} />
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.text2} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder="Repeat password" secureTextEntry={!showPass} placeholderTextColor={C.text3} />
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleSignUp} disabled={loading} activeOpacity={0.8}>
        {loading ? <ActivityIndicator color={C.text1} /> : <Text style={styles.btnText}>Create Account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate(PUBLIC_ROUTES.SIGN_IN)} style={styles.linkRow}>
        <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Sign In</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  scroll: { padding: 24, gap: 16 },
  backBtn: { marginBottom: 8, padding: 4, alignSelf: 'flex-start' },
  title: { fontSize: 26, fontWeight: '800', color: C.text1 },
  subtitle: { fontSize: 14, color: C.text2, marginBottom: 8 },
  errorBox: { backgroundColor: C.dangerDim, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12 },
  errorText: { fontSize: 13, color: C.danger },
  inputGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: C.text1, textTransform: 'uppercase' },
  input: { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text1 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: 12 },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: C.text1, fontSize: 15, fontWeight: '700' },
  linkRow: { alignItems: 'center', marginTop: 4 },
  linkText: { fontSize: 13, color: C.text2 },
  link: { color: C.accent, fontWeight: '700' },
});
