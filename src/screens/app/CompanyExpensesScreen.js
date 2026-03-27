import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { formatCurrency } from '../../shared/utils/helpers';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';

export default function CompanyExpensesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);

  const load = async () => {
    if (!uidCollection) return;
    try {
      const data = await loadData(uidCollection, COLLECTIONS.COMPANY_EXPENSES);
      setItems(data);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection]);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const total = items.reduce((s, x) => s + (Number(x.amount) || 0), 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Company Expenses" navigation={navigation} showBack />
      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item, i) => item.id || String(i)}
        contentContainerStyle={styles.list}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0366ae" />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No company expenses" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name || item.description || '—'}</Text>
              <Text style={styles.date}>{item.date || ''}</Text>
            </View>
            <Text style={styles.amount}>{formatCurrency(Number(item.amount) || 0)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  totalBar: { backgroundColor: '#103a7a', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#9fb8d4', fontSize: 13, fontWeight: '600' },
  totalValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 14, fontWeight: '600', color: '#103a7a' },
  date: { fontSize: 11, color: '#9fb8d4', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800', color: '#dc2626' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#9fb8d4' },
});
