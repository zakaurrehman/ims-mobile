import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color="#0366ae" />
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
            <Ionicons name="checkmark-circle" size={18} color="#0366ae" />
            <Text style={styles.valueText}>{v}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#e3f3ff', borderBottomWidth: 1, borderBottomColor: '#b8ddf8',
  },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: '#103a7a' },
  scroll: { padding: 24, gap: 8 },
  heading: { fontSize: 17, fontWeight: '700', color: '#103a7a', marginTop: 16, marginBottom: 6 },
  body: { fontSize: 14, color: '#28264f', lineHeight: 22 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  valueText: { fontSize: 14, color: '#0366ae', fontWeight: '500' },
});
