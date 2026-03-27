import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const FEATURES = [
  { icon: 'document-text-outline', title: 'Contracts', desc: 'Create and manage shipment contracts with full lifecycle tracking.' },
  { icon: 'receipt-outline', title: 'Invoices', desc: 'Generate, track, and reconcile invoices in multiple currencies.' },
  { icon: 'wallet-outline', title: 'Expenses', desc: 'Record and categorize company expenses with supplier linking.' },
  { icon: 'calculator-outline', title: 'Accounting', desc: 'Full accounting view linking invoices to expenses automatically.' },
  { icon: 'trending-up-outline', title: 'Cashflow', desc: 'Visualize financial cashflow with monthly breakdown.' },
  { icon: 'cube-outline', title: 'Stocks', desc: 'Track inventory per warehouse with real-time availability.' },
  { icon: 'people-outline', title: 'Clients & Suppliers', desc: 'Manage your full contact directory with details.' },
  { icon: 'bar-chart-outline', title: 'Dashboard', desc: 'KPI overview of P&L, invoices, contracts, and more.' },
];

export default function FeaturesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color="#0366ae" />
        </TouchableOpacity>
        <Text style={styles.title}>Features</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {FEATURES.map((f, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name={f.icon} size={22} color="#0366ae" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{f.title}</Text>
              <Text style={styles.cardDesc}>{f.desc}</Text>
            </View>
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
  scroll: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: '#f7fbff', borderRadius: 14,
    borderWidth: 1, borderColor: '#b8ddf8', padding: 16,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#103a7a', marginBottom: 4 },
  cardDesc: { fontSize: 12, color: '#9fb8d4', lineHeight: 18 },
});
