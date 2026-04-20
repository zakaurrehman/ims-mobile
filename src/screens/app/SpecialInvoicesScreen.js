import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../shared/firebase';
import { UserAuth } from '../../contexts/AuthContext';
import { getName, safeDate } from '../../shared/utils/helpers';
import { exportToExcel } from '../../shared/utils/exportUtils';
import { getBottomPad } from '../../theme/spacing';
import AppHeader from '../../components/AppHeader';
import DateRangeFilter from '../../components/DateRangeFilter';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import C from '../../theme/colors';

const STATUS_CHIPS = ['All', 'Paid', 'Unpaid'];

const getCurrency = (cur) => {
  if (!cur) return 'USD';
  const c = String(cur).toLowerCase();
  if (c === 'us' || c === 'usd') return 'USD';
  if (c === 'eu' || c === 'eur') return 'EUR';
  return String(cur).toUpperCase();
};

function StatusBadge({ status }) {
  const paid = status === 'Paid';
  return (
    <View style={[styles.badge, paid ? styles.badgePaid : styles.badgeUnpaid]}>
      <Text style={[styles.badgeText, paid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
        {status || 'Unpaid'}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export default function SpecialInvoicesScreen({ navigation }) {
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

  const resolveSupplier = (id) => getName(settings, 'Supplier', id) || id || '';

  const load = async () => {
    if (!uidCollection) return;
    try {
      setError(null);
      const col = collection(db, uidCollection, 'data', 'specialInvoices');
      const q = query(col, where('date', '>=', dateSelect.start), where('date', '<=', dateSelect.end));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(docs);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, dateRange]);

  const filtered = useMemo(() => {
    let arr = items;
    if (statusFilter !== 'All') {
      arr = arr.filter(x =>
        statusFilter === 'Paid' ? x.paidNotPaid === 'Paid' : x.paidNotPaid !== 'Paid'
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(x =>
        (x.compName || '').toLowerCase().includes(q) ||
        resolveSupplier(x.supplier).toLowerCase().includes(q) ||
        (x.invoice || '').toLowerCase().includes(q) ||
        (x.description || '').toLowerCase().includes(q) ||
        (x.order || '').toLowerCase().includes(q) ||
        (x.salesInvoice || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [items, statusFilter, search]);

  // Summary — unpaid only, grouped by supplier + currency
  const summaryUnpaid = useMemo(() => {
    const map = {};
    filtered.filter(x => x.paidNotPaid !== 'Paid').forEach(x => {
      const sup = resolveSupplier(x.supplier) || '—';
      const cur = getCurrency(x.cur);
      const key = `${sup}|${cur}`;
      if (!map[key]) map[key] = { supplier: sup, cur, total: 0 };
      map[key].total += Number(x.total) || 0;
    });
    return Object.values(map);
  }, [filtered]);

  // Summary — all, grouped by supplier + currency
  const summaryAll = useMemo(() => {
    const map = {};
    filtered.forEach(x => {
      const sup = resolveSupplier(x.supplier) || '—';
      const cur = getCurrency(x.cur);
      const key = `${sup}|${cur}`;
      if (!map[key]) map[key] = { supplier: sup, cur, total: 0 };
      map[key].total += Number(x.total) || 0;
    });
    return Object.values(map);
  }, [filtered]);

  const handleExport = () => {
    const cols = [
      { key: 'compName', label: 'Company' },
      { key: 'date', label: 'Date' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'originSupplier', label: 'Original Supplier' },
      { key: 'order', label: 'PO#' },
      { key: 'salesInvoice', label: 'Sales Invoice' },
      { key: 'invoice', label: 'Invoice' },
      { key: 'description', label: 'Description' },
      { key: 'qnty', label: 'Weight' },
      { key: 'unitPrc', label: 'Unit Price' },
      { key: 'total', label: 'Total' },
      { key: 'paidNotPaid', label: 'Status' },
    ];
    const exportData = filtered.map(x => ({
      ...x,
      supplier: resolveSupplier(x.supplier),
      originSupplier: resolveSupplier(x.originSupplier),
    }));
    exportToExcel(exportData, cols, 'misc_invoices');
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />;

  const renderItem = ({ item }) => {
    const cur = getCurrency(item.cur);
    const fmtAmt = (v) => v ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(Number(v)) : null;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.compName} numberOfLines={1}>{item.compName || item.invoiceNo || '—'}</Text>
            <Text style={styles.dateText}>{safeDate(item.date)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
            <Text style={styles.totalAmt}>{fmtAmt(item.total) || '—'}</Text>
            <StatusBadge status={item.paidNotPaid} />
          </View>
        </View>
        <View style={styles.infoGrid}>
          <InfoRow label="Supplier" value={resolveSupplier(item.supplier)} />
          <InfoRow label="Orig. Supplier" value={resolveSupplier(item.originSupplier)} />
          <InfoRow label="PO#" value={item.order} />
          <InfoRow label="Sales Invoice" value={item.salesInvoice} />
          <InfoRow label="Invoice" value={item.invoice} />
          <InfoRow label="Description" value={item.description} />
          {item.qnty ? <InfoRow label="Weight" value={`${item.qnty} ${item.unit || ''}`} /> : null}
          {item.unitPrc ? <InfoRow label="Unit Price" value={fmtAmt(item.unitPrc)} /> : null}
        </View>
      </View>
    );
  };

  const ListFooter = () => (
    <>
      {summaryUnpaid.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary — Unpaid</Text>
          {summaryUnpaid.map((r, i) => (
            <View key={i} style={styles.sumRow}>
              <Text style={styles.sumSupplier} numberOfLines={1}>{r.supplier}</Text>
              <Text style={styles.sumTotal}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: r.cur, minimumFractionDigits: 2 }).format(r.total)}
              </Text>
            </View>
          ))}
        </View>
      )}
      {summaryAll.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary — All</Text>
          {summaryAll.map((r, i) => (
            <View key={i} style={styles.sumRow}>
              <Text style={styles.sumSupplier} numberOfLines={1}>{r.supplier}</Text>
              <Text style={styles.sumTotal}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: r.cur, minimumFractionDigits: 2 }).format(r.total)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Misc Invoices" navigation={navigation} showBack />
      <DateRangeFilter
        onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
        initialYear={_cy}
      />

      {/* Search + Export */}
      <View style={styles.toolRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.text2} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
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
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={16} color={C.accent} />
        </TouchableOpacity>
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chipsContent}>
        {STATUS_CHIPS.map(chip => (
          <TouchableOpacity
            key={chip}
            style={[styles.chip, statusFilter === chip && styles.chipActive]}
            onPress={() => setStatusFilter(chip)}
          >
            <Text style={[styles.chipText, statusFilter === chip && styles.chipTextActive]}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.count}>{filtered.length} invoices</Text>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.accent} />}
        ListEmptyComponent={<EmptyState icon="document-outline" title="No misc invoices" subtitle="Try changing the year or filter" />}
        ListFooterComponent={<ListFooter />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  toolRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 6, gap: 8,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 40,
    backgroundColor: C.bg2, borderRadius: 999,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: C.text1 },
  exportBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: C.bg2, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 2, gap: 6, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 3, height: 26,
    justifyContent: 'center', borderRadius: 999,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2,
  },
  chipActive: { backgroundColor: C.accent, borderColor: '#103a7a' },
  chipText: { fontSize: 11, fontWeight: '600', color: C.text2 },
  chipTextActive: { color: C.text1 },
  count: { paddingHorizontal: 16, fontSize: 11, color: C.text2, marginTop: 4, marginBottom: 2 },
  list: { padding: 12, gap: 10 },

  card: {
    backgroundColor: C.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, padding: 14,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10,
  },
  compName: { fontSize: 13, fontWeight: '700', color: C.text1 },
  dateText: { fontSize: 11, color: C.text2, marginTop: 2 },
  totalAmt: { fontSize: 14, fontWeight: '800', color: C.accent, marginBottom: 4 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999, borderWidth: 1, alignSelf: 'flex-end',
  },
  badgePaid: { backgroundColor: C.successDim, borderColor: C.success },
  badgeUnpaid: { backgroundColor: C.warningDim, borderColor: C.warning },
  badgeText: { fontSize: 10, fontWeight: '600' },
  badgeTextPaid: { color: C.success },
  badgeTextUnpaid: { color: C.warning },
  infoGrid: { gap: 5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoLabel: { fontSize: 10, color: C.text2, fontWeight: '600', textTransform: 'uppercase', flex: 1 },
  infoValue: { fontSize: 11, color: C.text1, fontWeight: '500', flex: 2, textAlign: 'right', marginLeft: 8 },

  summaryCard: {
    marginHorizontal: 0, marginTop: 10,
    backgroundColor: C.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, padding: 14,
  },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: C.text1, marginBottom: 10 },
  sumRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sumSupplier: { fontSize: 12, color: C.text1, fontWeight: '500', flex: 1, marginRight: 8 },
  sumTotal: { fontSize: 12, fontWeight: '700', color: C.accent },
});
