import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { formatCurrency, getName } from '../../shared/utils/helpers';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import YearPicker from '../../components/YearPicker';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';

export default function ContractsStatementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');

  const dateSelect = { start: `${year}-01-01`, end: `${year}-12-31` };

  const load = async () => {
    if (!uidCollection) return;
    try {
      const data = await loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect);
      const enriched = (data || [])
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map(c => {
          const purchaseValue = (c.productsData || []).reduce(
            (s, p) => s + (parseFloat(p.qnty) || 0) * (parseFloat(p.unitPrc) || 0), 0
          );
          const currency = getName(settings, 'Currency', c.cur, 'cur') || c.cur || 'USD';
          const supplierName = getName(settings, 'Supplier', c.supplier);
          return { ...c, _value: purchaseValue, _currency: currency, _supplierName: supplierName };
        });
      setItems(enriched);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, year]);

  const filtered = search.trim()
    ? items.filter(x => {
        const q = search.toLowerCase();
        return (x.order || '').toLowerCase().includes(q) || x._supplierName.toLowerCase().includes(q);
      })
    : items;

  const total = filtered.reduce((s, x) => s + x._value, 0);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Contracts Statement" navigation={navigation} showBack />
      <YearPicker year={year} setYear={setYear} />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9fb8d4" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.search}
          placeholder="Search contracts..."
          placeholderTextColor="#b8ddf8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color="#9fb8d4" /></TouchableOpacity> : null}
      </View>

      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>{filtered.length} contracts · Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        contentContainerStyle={styles.list}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0366ae" />}
        ListEmptyComponent={<EmptyState icon="document-outline" title="No contracts" subtitle="Try changing the year or search" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.poNum}>PO# {item.order || '—'}</Text>
              <Text style={styles.supplier}>{item._supplierName}</Text>
              <Text style={styles.dateText}>{item.date || '—'}</Text>
            </View>
            <Text style={styles.amount}>{formatCurrency(item._value, item._currency)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 4, marginBottom: 4,
    paddingHorizontal: 14, height: 40,
    backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: '#b8ddf8',
  },
  search: { flex: 1, fontSize: 13, color: '#103a7a' },
  totalBar: {
    backgroundColor: '#103a7a', paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalLabel: { color: '#9fb8d4', fontSize: 11, fontWeight: '600' },
  totalValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
  list: { padding: 12, gap: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8',
    padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardLeft: { flex: 1, marginRight: 12 },
  poNum: { fontSize: 13, fontWeight: '700', color: '#0366ae' },
  supplier: { fontSize: 11, color: '#103a7a', marginTop: 2 },
  dateText: { fontSize: 10, color: '#9fb8d4', marginTop: 2 },
  amount: { fontSize: 13, fontWeight: '800', color: '#103a7a' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#9fb8d4' },
});
