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

const INV_PREFIX = { '1111': 'FN', '2222': 'CN', '3333': 'DN' };

function sumPayments(payments) {
  return (payments || []).reduce((s, p) => s + (parseFloat(p.pmnt) || 0), 0);
}

export default function InvoicesStatementScreen({ navigation }) {
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
      const data = await loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect);
      const enriched = (data || [])
        .filter(inv => !inv.canceled)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map(inv => {
          const totalAmount = parseFloat(inv.totalAmount) || 0;
          const paid = sumPayments(inv.payments);
          const balance = totalAmount - paid;
          const currency = getName(settings, 'Currency', inv.cur, 'cur') || inv.cur || 'USD';
          const clientName = getName(settings, 'Client', inv.client);
          const prefix = INV_PREFIX[inv.invType] || '';
          return { ...inv, _total: totalAmount, _paid: paid, _balance: balance, _currency: currency, _clientName: clientName, _prefix: prefix };
        });
      setItems(enriched);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, year]);

  const filtered = search.trim()
    ? items.filter(x => {
        const q = search.toLowerCase();
        return (x.invoice || '').toLowerCase().includes(q) || x._clientName.toLowerCase().includes(q);
      })
    : items;

  const totalInvoiced = filtered.reduce((s, x) => s + x._total, 0);
  const totalPaid = filtered.reduce((s, x) => s + x._paid, 0);
  const totalOutstanding = filtered.reduce((s, x) => s + x._balance, 0);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Invoices Statement" navigation={navigation} showBack />
      <YearPicker year={year} setYear={setYear} />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9fb8d4" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.search}
          placeholder="Search invoices..."
          placeholderTextColor="#b8ddf8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color="#9fb8d4" /></TouchableOpacity> : null}
      </View>

      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalInvoiced)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Paid</Text>
          <Text style={[styles.summaryValue, { color: '#4ade80' }]}>{formatCurrency(totalPaid)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Outstanding</Text>
          <Text style={[styles.summaryValue, { color: '#fca5a5' }]}>{formatCurrency(totalOutstanding)}</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        contentContainerStyle={styles.list}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0366ae" />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No invoices" subtitle="Try changing the year or search" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.invNum}>{item._prefix ? `${item._prefix} ` : ''}{item.invoice || '—'}</Text>
              <Text style={styles.clientName}>{item._clientName}</Text>
              <Text style={styles.dateText}>{item.date || '—'}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.total}>{formatCurrency(item._total, item._currency)}</Text>
              <Text style={[styles.balance, { color: item._balance > 0.01 ? '#dc2626' : '#16a34a' }]}>
                {item._balance > 0.01 ? `Due: ${formatCurrency(item._balance, item._currency)}` : 'Paid'}
              </Text>
            </View>
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
  summaryBar: { backgroundColor: '#103a7a', flexDirection: 'row', paddingVertical: 10 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: '#9fb8d4', fontSize: 10, fontWeight: '600', marginBottom: 2 },
  summaryValue: { color: '#fff', fontSize: 12, fontWeight: '800' },
  divider: { width: 1, backgroundColor: '#1d4e8f', marginVertical: 4 },
  list: { padding: 12, gap: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8',
    padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardLeft: { flex: 1, marginRight: 8 },
  invNum: { fontSize: 13, fontWeight: '700', color: '#0366ae' },
  clientName: { fontSize: 11, color: '#103a7a', marginTop: 2 },
  dateText: { fontSize: 10, color: '#9fb8d4', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  total: { fontSize: 13, fontWeight: '700', color: '#103a7a' },
  balance: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#9fb8d4' },
});
