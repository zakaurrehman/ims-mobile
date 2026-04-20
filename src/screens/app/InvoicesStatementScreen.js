import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TextInput, TouchableOpacity, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { formatCurrency, getName, safeDate, sortArr } from '../../shared/utils/helpers';
import { exportToExcel } from '../../shared/utils/exportUtils';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import DateRangeFilter from '../../components/DateRangeFilter';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';

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
  const [invoices, setInvoices] = useState([]);
  const [contracts, setContracts] = useState([]);
  const _cy = new Date().getFullYear();
  const [dateRange, setDateRange] = useState({ start: `${_cy}-01-01`, end: `${_cy}-12-31` });
  const dateSelect = dateRange;
  const year = dateRange.start?.substring(0, 4) || String(_cy);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('invoices'); // 'invoices' | 'suppliers' | 'clients'

  const load = async () => {
    if (!uidCollection) return;
    try {
      const [invData, conData] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
        loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
      ]);
      setInvoices(invData || []);
      setContracts(conData || []);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, dateRange]);

  const onRefresh = () => { setRefreshing(true); load(); };

  // Build contract map by id
  const contractMap = useMemo(() => {
    const m = {};
    contracts.forEach(c => { if (c.id) m[c.id] = c; });
    return m;
  }, [contracts]);

  // Build enriched invoice rows
  const rows = useMemo(() => {
    return invoices
      .filter(inv => !inv.canceled)
      .map(inv => {
        const contract = contractMap[inv.poSupplier?.id] || null;
        const supplierId = contract?.supplier || null;
        const supplierName = supplierId ? (getName(settings, 'Supplier', supplierId) || supplierId) : '—';
        const clientName = getName(settings, 'Client', inv.client) || '—';
        const currency = getName(settings, 'Currency', inv.cur, 'cur') || inv.cur || 'USD';
        const prefix = INV_PREFIX[inv.invType] || '';
        const amount = parseFloat(inv.totalAmount) || 0;
        const paid = sumPayments(inv.payments);
        const balance = amount - paid;
        const etd = inv.shipData?.etd?.startDate ? safeDate(inv.shipData.etd.startDate) : null;
        const eta = inv.shipData?.eta?.startDate ? safeDate(inv.shipData.eta.startDate) : null;
        const order = contract?.order || '';
        return {
          ...inv,
          _prefix: prefix,
          _supplierName: supplierName,
          _supplierId: supplierId,
          _clientName: clientName,
          _currency: currency,
          _amount: amount,
          _paid: paid,
          _balance: balance,
          _etd: etd,
          _eta: eta,
          _order: order,
        };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [invoices, contractMap, settings]);

  // Filtered rows
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      (r.invoice || '').toString().toLowerCase().includes(q) ||
      r._clientName.toLowerCase().includes(q) ||
      r._supplierName.toLowerCase().includes(q) ||
      r._order.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Supplier summary
  const supplierTotals = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const key = r._supplierId || '__none__';
      if (!map[key]) map[key] = { supplierId: r._supplierId, supplierName: r._supplierName, amount: 0, paid: 0, balance: 0, cur: r._currency };
      map[key].amount += r._amount;
      map[key].paid += r._paid;
      map[key].balance += r._balance;
    });
    return sortArr(Object.values(map), 'supplierName');
  }, [filtered]);

  // Client summary
  const clientTotals = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const key = r.client || '__none__';
      if (!map[key]) map[key] = { clientId: r.client, clientName: r._clientName, amount: 0, paid: 0, balance: 0, cur: r._currency };
      map[key].amount += r._amount;
      map[key].paid += r._paid;
      map[key].balance += r._balance;
    });
    return sortArr(Object.values(map), 'clientName');
  }, [filtered]);

  const totalAmount = filtered.reduce((s, r) => s + r._amount, 0);
  const totalPaid = filtered.reduce((s, r) => s + r._paid, 0);
  const totalBalance = filtered.reduce((s, r) => s + r._balance, 0);

  const handleExport = () => {
    const cols = [
      { key: 'invoice', label: 'Invoice #' },
      { key: 'date', label: 'Date' },
      { key: 'client', label: 'Client' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'contract', label: 'Contract' },
      { key: 'type', label: 'Type' },
      { key: 'currency', label: 'Currency' },
      { key: 'amount', label: 'Amount' },
      { key: 'paid', label: 'Paid' },
      { key: 'balance', label: 'Balance' },
      { key: 'etd', label: 'ETD' },
      { key: 'eta', label: 'ETA' },
    ];
    const data = filtered.map(r => ({
      invoice: `${r._prefix ? r._prefix + ' ' : ''}${r.invoice || ''}`,
      date: safeDate(r.date) || '',
      client: r._clientName,
      supplier: r._supplierName,
      contract: r._order,
      type: r.invType === '1111' ? 'FN' : r.invType === '2222' ? 'CN' : r.invType === '3333' ? 'DN' : 'Invoice',
      currency: r._currency,
      amount: r._amount.toFixed(2),
      paid: r._paid.toFixed(2),
      balance: r._balance.toFixed(2),
      etd: r._etd || '',
      eta: r._eta || '',
    }));
    exportToExcel(data, cols, `invoices_statement_${year}`);
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Invoices Statement" navigation={navigation} showBack />
      <DateRangeFilter
        onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
        initialYear={_cy}
      />

      {/* Search + Export */}
      <View style={styles.toolRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.text2} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.search}
            placeholder="Search by invoice, client, supplier..."
            placeholderTextColor={C.text3}
            value={search}
            onChangeText={setSearch}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={C.text2} /></TouchableOpacity> : null}
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={18} color={C.accent} />
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Invoiced</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Paid</Text>
          <Text style={[styles.summaryValue, { color: C.success }]}>{formatCurrency(totalPaid)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Balance</Text>
          <Text style={[styles.summaryValue, { color: totalBalance > 0.01 ? '#fca5a5' : C.success }]}>{formatCurrency(totalBalance)}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {['invoices', 'suppliers', 'clients'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'invoices' ? 'Invoices' : t === 'suppliers' ? 'By Supplier' : 'By Client'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'invoices' && (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => item.id || String(i)}
          contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
          windowSize={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={C.text2} />
              <Text style={styles.emptyText}>No invoices found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.invNum}>{item._prefix ? `${item._prefix} ` : ''}{item.invoice || '—'}</Text>
                  {item._order ? <Text style={styles.contractRef}>PO: {item._order}</Text> : null}
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.amountText}>{formatCurrency(item._amount, item._currency)}</Text>
                  <Text style={[styles.balanceText, { color: item._balance > 0.01 ? C.danger : C.success }]}>
                    {item._balance > 0.01 ? `Due: ${formatCurrency(item._balance, item._currency)}` : 'Paid'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>{item._clientName}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{item._supplierName}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaDate}>{safeDate(item.date) || '—'}</Text>
              </View>
              {(item._etd || item._eta) ? (
                <View style={styles.shipRow}>
                  {item._etd ? <Text style={styles.shipText}>ETD: {item._etd}</Text> : null}
                  {item._eta ? <Text style={styles.shipText}>ETA: {item._eta}</Text> : null}
                </View>
              ) : null}
            </View>
          )}
        />
      )}

      {tab === 'suppliers' && (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}>
          <View style={styles.tableWrap}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.th, { flex: 2 }]}>Supplier</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Amount</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Paid</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Balance</Text>
            </View>
            {supplierTotals.map((s, i) => (
              <View key={s.supplierId || i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                <Text style={[styles.td, { flex: 2, fontWeight: '600', color: C.text1 }]} numberOfLines={1}>{s.supplierName}</Text>
                <Text style={[styles.td, { flex: 1.2, textAlign: 'right' }]}>{formatCurrency(s.amount, s.cur)}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right', color: C.success }]}>{formatCurrency(s.paid, s.cur)}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right', color: s.balance > 0.01 ? C.danger : C.success }]}>{formatCurrency(s.balance, s.cur)}</Text>
              </View>
            ))}
            {supplierTotals.length === 0 && (
              <Text style={styles.emptyTable}>No data</Text>
            )}
          </View>
        </ScrollView>
      )}

      {tab === 'clients' && (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}>
          <View style={styles.tableWrap}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.th, { flex: 2 }]}>Client</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Amount</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Paid</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Balance</Text>
            </View>
            {clientTotals.map((c, i) => (
              <View key={c.clientId || i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                <Text style={[styles.td, { flex: 2, fontWeight: '600', color: C.text1 }]} numberOfLines={1}>{c.clientName}</Text>
                <Text style={[styles.td, { flex: 1.2, textAlign: 'right' }]}>{formatCurrency(c.amount, c.cur)}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right', color: C.success }]}>{formatCurrency(c.paid, c.cur)}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right', color: c.balance > 0.01 ? C.danger : C.success }]}>{formatCurrency(c.balance, c.cur)}</Text>
              </View>
            ))}
            {clientTotals.length === 0 && (
              <Text style={styles.emptyTable}>No data</Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  toolRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 4, marginBottom: 4,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 40,
    backgroundColor: C.bg2, borderRadius: 999, borderWidth: 1, borderColor: C.border,
  },
  search: { flex: 1, fontSize: 13, color: C.text1 },
  exportBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryBar: { backgroundColor: C.accent, flexDirection: 'row', paddingVertical: 10 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: C.text2, fontSize: 10, fontWeight: '600', marginBottom: 2 },
  summaryValue: { color: C.text1, fontSize: 12, fontWeight: '800' },
  divider: { width: 1, backgroundColor: C.border2, marginVertical: 4 },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    backgroundColor: C.bgTertiary, borderRadius: 10, padding: 3,
  },
  tab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: C.bg2, shadowColor: C.accent, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 11, fontWeight: '600', color: C.text2 },
  tabTextActive: { color: C.accent },
  list: { padding: 12, gap: 8 },
  card: {
    backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardLeft: { flex: 1, marginRight: 8 },
  cardRight: { alignItems: 'flex-end' },
  invNum: { fontSize: 13, fontWeight: '700', color: C.accent },
  contractRef: { fontSize: 10, color: C.text2, marginTop: 2 },
  amountText: { fontSize: 13, fontWeight: '700', color: C.text1 },
  balanceText: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  metaText: { fontSize: 11, color: C.text1 },
  metaDot: { fontSize: 11, color: C.text2 },
  metaDate: { fontSize: 11, color: C.text2 },
  shipRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  shipText: { fontSize: 10, color: C.text2 },
  tableWrap: {
    backgroundColor: C.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  tableHeader: { backgroundColor: C.bgTertiary },
  tableRow: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRowAlt: { backgroundColor: C.bg1 },
  th: { fontSize: 9, fontWeight: '700', color: C.text2, textTransform: 'uppercase' },
  td: { fontSize: 11, color: C.text1 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: C.text2, textAlign: 'center', paddingHorizontal: 32 },
  emptyTable: { textAlign: 'center', color: C.text2, padding: 20, fontSize: 13 },
});
