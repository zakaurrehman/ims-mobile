import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import C from '../../theme/colors';

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={C.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>About IMS</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>What is IMS?</Text>
        <Text style={styles.body}>
          IMS (Inventory Management System) is a powerful platform designed for businesses managing
          international shipments, contracts, and financial operations.
        </Text>
        <Text style={styles.heading}>Our Mission</Text>
        <Text style={styles.body}>
          We help teams eliminate spreadsheet chaos by providing a unified, real-time system for
          contracts, invoices, expenses, accounting, and cashflow analysis.
        </Text>
        <Text style={styles.heading}>Key Values</Text>
        {['Simplicity', 'Real-time data', 'Multi-language support', 'Secure & cloud-based'].map((v, i) => (
          <View key={i} style={styles.valueRow}>
            <Ionicons name="checkmark-circle" size={18} color={C.accent} />
            <Text style={styles.valueText}>{v}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg2 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.bgTertiary, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: C.text1 },
  scroll: { padding: 24, gap: 8 },
  heading: { fontSize: 17, fontWeight: '700', color: C.text1, marginTop: 16, marginBottom: 6 },
  body: { fontSize: 14, color: C.text2, lineHeight: 22 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  valueText: { fontSize: 14, color: C.accent, fontWeight: '500' },
});
