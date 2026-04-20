import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { formatCurrency, getName, safeDate } from '../../shared/utils/helpers';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import DateRangeFilter from '../../components/DateRangeFilter';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';

const INV_PREFIX = { '1111': 'FN', '2222': 'CN', '3333': 'DN' };
const STATUS_FILTER = ['All', 'Paid', 'Unpaid', 'Canceled'];

function sumPayments(payments) {
  return (payments || []).reduce((s, p) => s + (parseFloat(p.pmnt) || 0), 0);
}

function getStatusStyle(inv) {
  if (inv.canceled) return { bg: '#fee2e2', border: '#fca5a5', text: C.danger, label: 'Canceled' };
  const paid = sumPayments(inv.payments);
  const balance = (parseFloat(inv.totalAmount) || 0) - paid;
  if (balance <= 0.01) return { bg: '#dcfce7', border: '#86efac', text: C.success, label: 'Paid' };
  return { bg: '#fef9c3', border: '#fde68a', text: '#92400e', label: 'Unpaid' };
}

export default function InvoicesReviewScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const _cy = new Date().getFullYear();
  const [dateRange, setDateRange] = useState({ start: `${_cy}-01-01`, end: `${_cy}-12-31` });
  const dateSelect = dateRange;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currencyMode, setCurrencyMode] = useState('EUR');
  const DEFAULT_EUR_RATE = 1.1;

  const load = async () => {
    if (!uidCollection) return;
    try {
      const data = await loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect);
      const enriched = (data || [])
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map(inv => {
          const payments = sumPayments(inv.payments);
          const totalAmount = parseFloat(inv.totalAmount) || 0;
          const totalPrepayment = parseFloat(inv.totalPrepayment) || 0;
          const balanceDue = totalAmount - payments;
          const prefix = INV_PREFIX[inv.invType] || '';
          const currency = getName(settings, 'Currency', inv.cur, 'cur') || inv.cur || 'USD';
          const clientName = getName(settings, 'Client', inv.client);
          const status = getStatusStyle(inv);
          return {
            ...inv,
            _payments: payments,
            _totalAmount: totalAmount,
            _totalPrepayment: totalPrepayment,
            _balanceDue: balanceDue,
            _prefix: prefix,
            _currency: currency,
            _clientName: clientName,
            _status: status,
          };
        });
      setItems(enriched);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, dateRange]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = items.filter(x => {
    const matchStatus =
      statusFilter === 'All' ||
      x._status.label === statusFilter;
    if (!matchStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (x.invoice || '').toLowerCase().includes(q) ||
      x._clientName.toLowerCase().includes(q) ||
      (x.poSupplier?.order || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Invoices Review" navigation={navigation} showBack />
      <DateRangeFilter
        onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
        initialYear={_cy}
      />

      <View style={styles.currencyToggleRow}>
        {['EUR', 'USD'].map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.currencyBtn, currencyMode === c && styles.currencyBtnActive]}
            onPress={() => setCurrencyMode(c)}
          >
            <Text style={[styles.currencyBtnText, currencyMode === c && styles.currencyBtnTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={C.text2} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.search}
          placeholder="Search invoices..."
          placeholderTextColor={C.text3}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.text2} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBar} contentContainerStyle={styles.chipsContent}>
        {STATUS_FILTER.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.count}>{filtered.length} invoices</Text>

      <FlatList
        style={styles.flatList}
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No invoices found" subtitle="Try changing the year or filters" />}
        renderItem={({ item }) => {
          const st = item._status;
          const rate = currencyMode === 'USD' ? DEFAULT_EUR_RATE : 1;
          const displayCur = currencyMode === 'USD' ? 'USD' : item._currency;
          const fmt = (n) => formatCurrency(n * rate, displayCur);
          return (
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.invNum}>
                    {item._prefix ? `${item._prefix} ` : ''}{item.invoice || '—'}
                  </Text>
                  <Text style={styles.clientName}>{item._clientName}</Text>
                  <Text style={styles.dateText}>{safeDate(item.date) || '—'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
                  <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                </View>
              </View>

              {/* Financial rows */}
              <View style={styles.divider} />
              <View style={styles.finRow}>
                <Text style={styles.finLabel}>Invoice Total</Text>
                <Text style={styles.finValue}>{fmt(item._totalAmount)}</Text>
              </View>
              <View style={styles.finRow}>
                <Text style={styles.finLabel}>Prepaid</Text>
                <Text style={styles.finValue}>{fmt(item._totalPrepayment)}</Text>
              </View>
              <View style={styles.finRow}>
                <Text style={styles.finLabel}>Payments Received</Text>
                <Text style={styles.finValue}>{fmt(item._payments)}</Text>
              </View>
              <View style={[styles.finRow, styles.finRowBalance]}>
                <Text style={styles.finLabelBold}>Balance Due</Text>
                <Text style={[styles.finValueBold, { color: item._balanceDue > 0.01 ? C.danger : C.success }]}>
                  {fmt(item._balanceDue)}
                </Text>
              </View>

              {/* PO ref */}
              {item.poSupplier?.order ? (
                <View style={styles.poRow}>
                  <Ionicons name="link-outline" size={12} color={C.text2} />
                  <Text style={styles.poText}>PO# {item.poSupplier.order}</Text>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 4, marginBottom: 4,
    paddingHorizontal: 14, height: 40,
    backgroundColor: C.bg2, borderRadius: 999,
    borderWidth: 1, borderColor: C.border,
  },
  search: { flex: 1, fontSize: 13, color: C.text1 },
  chipsBar: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 6, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 5, height: 26,
    borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: C.accent, borderColor: '#103a7a' },
  chipText: { fontSize: 11, fontWeight: '600', color: C.text2 },
  chipTextActive: { color: C.text1 },
  count: { paddingHorizontal: 16, fontSize: 11, color: C.text2, marginBottom: 4 },
  flatList: { flex: 1 },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: C.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, padding: 14,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10,
  },
  invNum: { fontSize: 14, fontWeight: '700', color: C.accent },
  clientName: { fontSize: 12, color: C.text1, marginTop: 2 },
  dateText: { fontSize: 11, color: C.text2, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.bgPrimary, marginBottom: 8 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  finRowBalance: {
    marginTop: 4, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#EBF4FB',
  },
  finLabel: { fontSize: 11, color: C.text2, fontWeight: '600' },
  finValue: { fontSize: 12, color: C.text1, fontWeight: '600' },
  finLabelBold: { fontSize: 12, color: C.text1, fontWeight: '700' },
  finValueBold: { fontSize: 14, fontWeight: '800' },
  poRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#EBF4FB',
  },
  poText: { fontSize: 11, color: C.text2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: C.text2 },
  currencyToggleRow: { flexDirection: 'row', gap: 6, marginHorizontal: 12, marginBottom: 4 },
  currencyBtn: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2,
  },
  currencyBtnActive: { backgroundColor: C.accent, borderColor: '#103a7a' },
  currencyBtnText: { fontSize: 11, fontWeight: '700', color: C.text2 },
  currencyBtnTextActive: { color: C.text1 },
});
