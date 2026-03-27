import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput,
} from 'react-native';
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

// Purchase value = sum of productsData qty * unitPrc
function calcPurchaseValue(contract) {
  return (contract.productsData || []).reduce((sum, p) => {
    return sum + (parseFloat(p.qnty) || 0) * (parseFloat(p.unitPrc) || 0);
  }, 0);
}

// From linked invoices on the contract: sum totalAmount of final/only invoices
function calcInvoiceValue(contract, invoiceMap) {
  if (!contract.invoices?.length) return 0;
  let total = 0;
  for (const ref of contract.invoices) {
    const inv = invoiceMap[ref.invoice];
    if (!inv || inv.canceled) continue;
    // Only count original invoice if no final exists for same invoice#
    total += parseFloat(inv.totalAmount) || 0;
  }
  return total;
}

// Sum payments from linked invoices
function calcPayments(contract, invoiceMap) {
  if (!contract.invoices?.length) return 0;
  let total = 0;
  for (const ref of contract.invoices) {
    const inv = invoiceMap[ref.invoice];
    if (!inv || inv.canceled) continue;
    for (const p of inv.payments || []) {
      total += parseFloat(p.pmnt) || 0;
    }
  }
  return total;
}

export default function ContractsReviewScreen({ navigation }) {
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
      const [contracts, invoices] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
      ]);

      // Build invoice lookup by invoice# for financial calcs
      const invoiceMap = {};
      for (const inv of invoices || []) {
        if (inv.invoice) invoiceMap[inv.invoice] = inv;
      }

      // Also build contractId → expense totals map (from expenses linked via poSupplier)
      const expenses = await loadData(uidCollection, COLLECTIONS.EXPENSES, dateSelect);
      const expMap = {};
      for (const exp of expenses || []) {
        const cid = exp.poSupplier?.id;
        if (cid) {
          expMap[cid] = (expMap[cid] || 0) + (parseFloat(exp.amount) || 0);
        }
      }

      const enriched = (contracts || [])
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map(c => {
          const purchaseValue = calcPurchaseValue(c);
          const invoiceValue = calcInvoiceValue(c, invoiceMap);
          const payments = calcPayments(c, invoiceMap);
          const expensesTotal = expMap[c.id] || 0;
          const profit = invoiceValue - purchaseValue - expensesTotal;
          const debtBalance = invoiceValue - payments;
          const currency = getName(settings, 'Currency', c.cur, 'cur') || c.cur || 'USD';
          return {
            ...c,
            purchaseValue,
            invoiceValue,
            payments,
            expensesTotal,
            profit,
            debtBalance,
            currency,
          };
        });

      setItems(enriched);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, year]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = search.trim()
    ? items.filter(x => {
        const q = search.toLowerCase();
        return (
          (x.order || '').toLowerCase().includes(q) ||
          getName(settings, 'Supplier', x.supplier).toLowerCase().includes(q)
        );
      })
    : items;

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Contracts Review" navigation={navigation} showBack />
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
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9fb8d4" />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.count}>{filtered.length} contracts</Text>

      <FlatList
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        contentContainerStyle={styles.list}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0366ae" />}
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No contracts found" subtitle="Try changing the year or search" />}
        renderItem={({ item }) => {
          const supplierName = getName(settings, 'Supplier', item.supplier);
          const profitColor = item.profit >= 0 ? '#16a34a' : '#dc2626';
          const debtColor = item.debtBalance > 0 ? '#dc2626' : '#16a34a';
          const fmt = (n) => formatCurrency(n, item.currency);

          return (
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.poNum}>PO# {item.order || '—'}</Text>
                  <Text style={styles.supplier}>{supplierName}</Text>
                </View>
                <View style={styles.dateWrap}>
                  <Text style={styles.dateText}>{item.date || '—'}</Text>
                  <Text style={styles.currency}>{item.currency}</Text>
                </View>
              </View>

              {/* Financial grid */}
              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Purchase</Text>
                  <Text style={styles.gridValue}>{fmt(item.purchaseValue)}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Invoice</Text>
                  <Text style={styles.gridValue}>{fmt(item.invoiceValue)}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Expenses</Text>
                  <Text style={styles.gridValue}>{fmt(item.expensesTotal)}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Payments</Text>
                  <Text style={styles.gridValue}>{fmt(item.payments)}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Profit + Debt */}
              <View style={styles.footerRow}>
                <View style={styles.footerItem}>
                  <Text style={styles.gridLabel}>Profit</Text>
                  <Text style={[styles.footerValue, { color: profitColor }]}>{fmt(item.profit)}</Text>
                </View>
                <View style={styles.footerItem}>
                  <Text style={styles.gridLabel}>Debt Balance</Text>
                  <Text style={[styles.footerValue, { color: debtColor }]}>{fmt(item.debtBalance)}</Text>
                </View>
              </View>
            </View>
          );
        }}
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
    backgroundColor: '#fff', borderRadius: 999,
    borderWidth: 1, borderColor: '#b8ddf8',
  },
  search: { flex: 1, fontSize: 13, color: '#103a7a' },
  count: { paddingHorizontal: 16, fontSize: 11, color: '#9fb8d4', marginBottom: 4 },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#b8ddf8', padding: 14,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  poNum: { fontSize: 13, fontWeight: '700', color: '#0366ae' },
  supplier: { fontSize: 12, color: '#103a7a', marginTop: 2 },
  dateWrap: { alignItems: 'flex-end' },
  dateText: { fontSize: 11, color: '#9fb8d4' },
  currency: { fontSize: 10, fontWeight: '700', color: '#9fb8d4', marginTop: 2 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  gridItem: {
    width: '47%', backgroundColor: '#f8fbff',
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#e3f3ff',
  },
  gridLabel: { fontSize: 9, fontWeight: '700', color: '#9fb8d4', textTransform: 'uppercase', marginBottom: 4 },
  gridValue: { fontSize: 12, fontWeight: '700', color: '#103a7a' },
  divider: { height: 1, backgroundColor: '#f0f8ff', marginVertical: 10 },
  footerRow: { flexDirection: 'row', gap: 8 },
  footerItem: {
    flex: 1, backgroundColor: '#f8fbff',
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#e3f3ff',
  },
  footerValue: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#9fb8d4' },
});
