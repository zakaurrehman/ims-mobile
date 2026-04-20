// Contracts Review — matches web's contractsreview/page.js
// Uses same data endpoints: contract.poInvoices[].pmnt for purchase value,
// contract.expenses[] for expenses, contract.invoices[] → invoice docs for financials
import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput,
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

// Matches web's ContractsValue(contract, 'pmnt', valCur, euroToUSD)
// No currency conversion — uses contract's native currency (mltTmp = 1)
function calcPurchaseValue(contract) {
  return (contract.poInvoices || []).reduce((s, z) => s + (parseFloat(z.pmnt) || 0), 0);
}

// Matches web's TotalArrsExp — uses contract.expenses[] directly
function calcExpenses(contract) {
  return (contract.expenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
}

// Matches web's Total() function — splits into totalInvoices (finalised) vs deviation (single standard)
// Also computes payments and prepayment in a single pass
function calcInvoiceTotals(contract, invoiceMap) {
  const linkedInvs = (contract.invoices || [])
    .map(r => invoiceMap[r.invoice])
    .filter(Boolean);

  let totalInvoices = 0;    // accumuLastInv  — final/confirmed invoice amounts
  let deviation = 0;        // accumuDeviation — single standard invoice (pre-final)
  let totalPrepayment = 0;
  let payments = 0;

  linkedInvs.forEach(inv => {
    if (inv.canceled) return;
    const amount = parseFloat(inv.totalAmount) || 0;
    const prepay = parseFloat(inv.totalPrepayment) || 0;

    // Web logic: only 1 invoice linked AND it's a standard type → deviation
    if (linkedInvs.length === 1 && (inv.invType === '1111' || inv.invType === 'Invoice')) {
      deviation += amount;
    } else {
      totalInvoices += amount;
    }
    totalPrepayment += prepay;
    (inv.payments || []).forEach(p => { payments += parseFloat(p.pmnt) || 0; });
  });

  const totalAll = totalInvoices + deviation;
  const prepaidPer = totalAll > 0 ? (totalPrepayment / totalAll * 100) : 0;
  const inDebt = totalAll - totalPrepayment;
  const debtaftr = inDebt - payments;
  const debtBlnc = totalAll - payments;

  return { totalInvoices, deviation, totalPrepayment, prepaidPer, inDebt, payments, debtaftr, debtBlnc, totalAll };
}

export default function ContractsReviewScreen({ navigation }) {
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
  const [currencyMode, setCurrencyMode] = useState('EUR');
  const DEFAULT_EUR_RATE = 1.1;

  const load = async () => {
    if (!uidCollection) return;
    try {
      const [contracts, invoices] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
      ]);

      // Build invoice lookup by invoice# — matches web's getInvoices logic
      const invoiceMap = {};
      for (const inv of invoices || []) {
        if (inv.invoice) invoiceMap[inv.invoice] = inv;
      }

      const enriched = (contracts || [])
        .filter(c => !c.canceled)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map(c => {
          const conValue  = calcPurchaseValue(c);
          const expenses1 = calcExpenses(c);
          const inv       = calcInvoiceTotals(c, invoiceMap);
          const profit    = inv.totalAll - conValue - expenses1;
          const currency  = getName(settings, 'Currency', c.cur, 'cur') || c.cur || 'USD';
          return { ...c, conValue, expenses1, profit, currency, ...inv };
        });

      setItems(enriched);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, dateRange]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(x =>
      (x.order || '').toLowerCase().includes(q) ||
      getName(settings, 'Supplier', x.supplier).toLowerCase().includes(q)
    );
  }, [items, search]);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Contracts Review" navigation={navigation} showBack />
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
          placeholder="Search contracts..."
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

      <Text style={styles.count}>{filtered.length} contracts</Text>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No contracts found" subtitle="Try changing the year or search" />}
        renderItem={({ item }) => {
          const supplierName = getName(settings, 'Supplier', item.supplier);
          const rate = currencyMode === 'USD' ? (item.euroToUSD || DEFAULT_EUR_RATE) : 1;
          const displayCur = currencyMode === 'USD' ? 'USD' : item.currency;
          const fmt = (n) => formatCurrency(n * rate, displayCur);
          const profitColor = item.profit >= 0 ? C.success : C.danger;

          return (
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.poNum}>PO# {item.order || '—'}</Text>
                  <Text style={styles.supplier}>{supplierName}</Text>
                </View>
                <View style={styles.dateWrap}>
                  <Text style={styles.dateText}>{safeDate(item.date) || '—'}</Text>
                  <Text style={styles.currency}>{item.currency}</Text>
                </View>
              </View>

              {/* Row 1: Purchase | Invoice | Deviation */}
              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <Text style={styles.mLabel}>Purchase</Text>
                  <Text style={styles.mValue}>{fmt(item.conValue)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.mLabel}>Invoice</Text>
                  <Text style={styles.mValue}>{fmt(item.totalInvoices)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.mLabel}>Deviation</Text>
                  <Text style={[styles.mValue, item.deviation > 0.01 && { color: C.warning }]}>
                    {fmt(item.deviation)}
                  </Text>
                </View>
              </View>

              {/* Row 2: Prepaid | Prepaid% | Initial Debt */}
              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <Text style={styles.mLabel}>Prepaid</Text>
                  <Text style={styles.mValue}>{fmt(item.totalPrepayment)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.mLabel}>Prepaid %</Text>
                  <Text style={styles.mValue}>{item.prepaidPer.toFixed(1)}%</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.mLabel}>Initial Debt</Text>
                  <Text style={[styles.mValue, { color: item.inDebt > 0.01 ? C.danger : C.success }]}>
                    {fmt(item.inDebt)}
                  </Text>
                </View>
              </View>

              {/* Row 3: Payments | Debt After Prepay | Debt Balance */}
              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <Text style={styles.mLabel}>Payments</Text>
                  <Text style={[styles.mValue, { color: C.success }]}>{fmt(item.payments)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.mLabel}>Debt After</Text>
                  <Text style={[styles.mValue, { color: item.debtaftr > 0.01 ? C.danger : C.success }]}>
                    {fmt(item.debtaftr)}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.mLabel}>Debt Balance</Text>
                  <Text style={[styles.mValue, { color: item.debtBlnc > 0.01 ? C.danger : C.success }]}>
                    {fmt(item.debtBlnc)}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Footer: Expenses + Profit */}
              <View style={styles.footerRow}>
                <View style={styles.footerItem}>
                  <Text style={styles.mLabel}>Expenses</Text>
                  <Text style={styles.mValue}>{fmt(item.expenses1)}</Text>
                </View>
                <View style={styles.footerItem}>
                  <Text style={styles.mLabel}>Profit</Text>
                  <Text style={[styles.footerValue, { color: profitColor }]}>{fmt(item.profit)}</Text>
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
  root: { flex: 1, backgroundColor: C.bgPrimary },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 4, marginBottom: 4,
    paddingHorizontal: 14, height: 40,
    backgroundColor: C.bg2, borderRadius: 999, borderWidth: 1, borderColor: C.border,
  },
  search: { flex: 1, fontSize: 13, color: C.text1 },
  count: { paddingHorizontal: 16, fontSize: 11, color: C.text2, marginBottom: 4 },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: C.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, padding: 12,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10,
  },
  poNum: { fontSize: 13, fontWeight: '700', color: C.accent },
  supplier: { fontSize: 12, color: C.text1, marginTop: 2 },
  dateWrap: { alignItems: 'flex-end' },
  dateText: { fontSize: 11, color: C.text2 },
  currency: { fontSize: 10, fontWeight: '700', color: C.text2, marginTop: 2 },
  currencyToggleRow: { flexDirection: 'row', gap: 6, marginHorizontal: 12, marginBottom: 4 },
  currencyBtn: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2,
  },
  currencyBtnActive: { backgroundColor: C.accent, borderColor: '#103a7a' },
  currencyBtnText: { fontSize: 11, fontWeight: '700', color: C.text2 },
  currencyBtnTextActive: { color: C.text1 },
  metricRow: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  metric: {
    flex: 1, backgroundColor: C.bg2, borderRadius: 8,
    padding: 7, borderWidth: 1, borderColor: C.border,
  },
  mLabel: { fontSize: 8, fontWeight: '700', color: C.text2, textTransform: 'uppercase', marginBottom: 3 },
  mValue: { fontSize: 10, fontWeight: '700', color: C.text1 },
  divider: { height: 1, backgroundColor: C.bgPrimary, marginVertical: 8 },
  footerRow: { flexDirection: 'row', gap: 5 },
  footerItem: {
    flex: 1, backgroundColor: C.bg2, borderRadius: 8,
    padding: 7, borderWidth: 1, borderColor: C.border,
  },
  footerValue: { fontSize: 13, fontWeight: '800', marginTop: 3 },
});
