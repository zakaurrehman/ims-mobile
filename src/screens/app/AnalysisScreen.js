import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { formatCurrency } from '../../shared/utils/helpers';
import AppHeader from '../../components/AppHeader';
import Card from '../../components/Card';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';

export default function AnalysisScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});

  const load = async () => {
    if (!uidCollection) return;
    try {
      const [contracts, invoices, expenses] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.CONTRACTS),
        loadData(uidCollection, COLLECTIONS.INVOICES),
        loadData(uidCollection, COLLECTIONS.EXPENSES),
      ]);
      const income = invoices.reduce((s, x) => s + (Number(x.totalUSD) || 0), 0);
      const exp = expenses.reduce((s, x) => s + (Number(x.totalUSD) || 0), 0);
      const contractVal = contracts.reduce((s, x) => s + (Number(x.totalUSD) || 0), 0);
      setStats({ income, exp, pnl: income - exp, contractVal, contracts: contracts.length, invoices: invoices.length, expenses: expenses.length });
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection]);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const margin = stats.income > 0 ? ((stats.pnl / stats.income) * 100).toFixed(1) : '0.0';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Analysis" navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0366ae" />}>
        <Card style={styles.mainCard}>
          <Text style={styles.cardTitle}>Revenue Overview</Text>
          {[
            { label: 'Total Income', value: formatCurrency(stats.income), color: '#16a34a' },
            { label: 'Total Expenses', value: formatCurrency(stats.exp), color: '#dc2626' },
            { label: 'Net P&L', value: formatCurrency(stats.pnl), color: stats.pnl >= 0 ? '#16a34a' : '#dc2626' },
            { label: 'Net Margin', value: `${margin}%`, color: Number(margin) >= 0 ? '#0366ae' : '#dc2626' },
          ].map((row, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={[styles.rowValue, { color: row.color }]}>{row.value}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.mainCard}>
          <Text style={styles.cardTitle}>Counts</Text>
          {[
            { label: 'Contracts', value: stats.contracts, icon: 'document-text-outline' },
            { label: 'Invoices', value: stats.invoices, icon: 'receipt-outline' },
            { label: 'Expenses', value: stats.expenses, icon: 'wallet-outline' },
          ].map((item, i) => (
            <View key={i} style={styles.countRow}>
              <Ionicons name={item.icon} size={18} color="#0366ae" />
              <Text style={styles.countLabel}>{item.label}</Text>
              <Text style={styles.countValue}>{item.value}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  scroll: { padding: 16, gap: 16 },
  mainCard: { padding: 18 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#103a7a', marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  rowLabel: { fontSize: 13, color: '#9fb8d4' },
  rowValue: { fontSize: 13, fontWeight: '700' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  countLabel: { flex: 1, fontSize: 13, color: '#103a7a' },
  countValue: { fontSize: 16, fontWeight: '800', color: '#103a7a' },
});
