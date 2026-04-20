// Contracts Statement — matches web's contractsstatement/page.js
// Data endpoints: contracts + invoices, products matched by descriptionId
// Added: client/destination per product row, Grouped/Flat mode toggle
import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { getName, safeDate } from '../../shared/utils/helpers';
import { exportToExcel } from '../../shared/utils/exportUtils';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import DateRangeFilter from '../../components/DateRangeFilter';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';

const fmtWt = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '—' : new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n);
};

const fmtAmt = (v, cur) => {
  const n = parseFloat(v);
  if (!n) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', minimumFractionDigits: 2 }).format(n);
  } catch { return `${n.toFixed(2)} ${cur || ''}`; }
};

export default function ContractsStatementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const _cy = new Date().getFullYear();
  const [dateRange, setDateRange] = useState({ start: `${_cy}-01-01`, end: `${_cy}-12-31` });
  const dateSelect = dateRange;
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [flatMode, setFlatMode] = useState(false);

  const load = async () => {
    if (!uidCollection) return;
    try {
      setError(null);
      const [cons, invs] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
      ]);
      setContracts(cons || []);
      setInvoices(invs || []);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, dateRange]);

  // Build per-product rows — matches web's setCurFilterData logic
  const rows = useMemo(() => {
    const invByContract = {};
    (invoices || []).forEach(inv => {
      const cid = inv.poSupplier?.id;
      if (!cid) return;
      if (!invByContract[cid]) invByContract[cid] = [];
      invByContract[cid].push(inv);
    });

    const result = [];
    (contracts || []).forEach(con => {
      const supplierName = getName(settings, 'Supplier', con.supplier) || con.supplier || '—';
      const origSupplierName = getName(settings, 'Supplier', con.originSupplier) || '';
      const conInvoices = invByContract[con.id] || [];
      const cur = con.cur || 'USD';

      (con.productsData || []).forEach(product => {
        const poWeight = parseFloat(product.qnty) || 0;
        let shippedWeight = 0;
        const invoiceNums = [];
        const clients = [];
        const destinations = [];
        const pos = [];

        conInvoices.forEach(inv => {
          // Match by descriptionId — same as web's productsDataInvoice[].descriptionId === product.id
          (inv.productsDataInvoice || []).forEach(p => {
            if (p.descriptionId === product.id && p.qnty !== 's') {
              shippedWeight += parseFloat(p.qnty) || 0;
            }
            if (p.descriptionId === product.id && p.po && !pos.includes(p.po)) pos.push(p.po);
          });

          if (!invoiceNums.includes(inv.invoice)) invoiceNums.push(inv.invoice);

          // Client name — web checks inv.final for nname vs settings lookup
          const clientName = inv.final
            ? (inv.client?.nname || getName(settings, 'Client', inv.client))
            : getName(settings, 'Client', inv.client);
          if (clientName && !clients.includes(clientName)) clients.push(clientName);

          // Destination (POD) — matches web's totalDestination
          const pod = inv.final
            ? (inv.pod?.pod || getName(settings, 'POD', inv.pod, 'pod'))
            : getName(settings, 'POD', inv.pod, 'pod');
          if (pod && !destinations.includes(pod)) destinations.push(pod);
        });

        result.push({
          _conId: con.id,
          order: con.order || '—',
          date: con.date || '',
          supplier: supplierName,
          originSupplier: origSupplierName,
          description: product.description || '—',
          unitPrc: parseFloat(product.unitPrc) || 0,
          cur,
          poWeight,
          shippedWeight,
          remaining: poWeight - shippedWeight,
          invoiceNums,
          clients,
          destinations,
          pos,
          comments: con.comments || '',
        });
      });
    });

    return result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [contracts, invoices, settings]);

  const grouped = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (!map[r._conId]) map[r._conId] = [];
      map[r._conId].push(r);
    });
    return Object.values(map);
  }, [rows]);

  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped.filter(grp =>
      grp.some(r =>
        (r.order || '').toLowerCase().includes(q) ||
        (r.supplier || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      )
    );
  }, [grouped, search]);

  const filteredFlat = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      (r.order || '').toLowerCase().includes(q) ||
      (r.supplier || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const supplierTotals = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (!map[r.supplier]) map[r.supplier] = { supplier: r.supplier, poWeight: 0, shippedWeight: 0 };
      map[r.supplier].poWeight += r.poWeight;
      map[r.supplier].shippedWeight += r.shippedWeight;
    });
    return Object.values(map).map(s => ({ ...s, remaining: s.poWeight - s.shippedWeight }));
  }, [rows]);

  const handleExport = () => {
    const cols = [
      { key: 'order', label: 'PO#' }, { key: 'date', label: 'Date' },
      { key: 'supplier', label: 'Supplier' }, { key: 'originSupplier', label: 'Orig. Supplier' },
      { key: 'description', label: 'Description' }, { key: 'unitPrc', label: 'Unit Price' },
      { key: 'cur', label: 'Currency' }, { key: 'poWeight', label: 'PO Weight MT' },
      { key: 'shippedWeight', label: 'Shipped MT' }, { key: 'remaining', label: 'Remaining MT' },
      { key: 'invoiceNums', label: 'Invoice#' }, { key: 'clients', label: 'Client' },
      { key: 'destinations', label: 'Destination' }, { key: 'pos', label: 'PO Client' },
      { key: 'comments', label: 'Comments' },
    ];
    const data = rows.map(r => ({
      ...r,
      date: safeDate(r.date) || r.date,
      invoiceNums: r.invoiceNums.join(', '),
      clients: r.clients.join(', '),
      destinations: r.destinations.join(', '),
      pos: r.pos.join(', '),
    }));
    exportToExcel(data, cols, 'contracts_statement');
  };

  const toggleExpand = (conId) => setExpanded(prev => ({ ...prev, [conId]: !prev[conId] }));

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />;

  const renderGroup = ({ item: grp }) => {
    const first = grp[0];
    const conId = first._conId;
    const isExpanded = !!expanded[conId];
    const totalPoWt = grp.reduce((s, r) => s + r.poWeight, 0);
    const totalShipped = grp.reduce((s, r) => s + r.shippedWeight, 0);
    const totalRemaining = totalPoWt - totalShipped;
    const allInvNums = [...new Set(grp.flatMap(r => r.invoiceNums))];
    const allClients = [...new Set(grp.flatMap(r => r.clients))];

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(conId)} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTop}>
              <Text style={styles.poNum}>PO# {first.order}</Text>
              <Text style={styles.dateText}>{safeDate(first.date)}</Text>
            </View>
            <Text style={styles.supplierName}>{first.supplier}</Text>
            {first.originSupplier ? <Text style={styles.origSupplier}>{first.originSupplier}</Text> : null}
            {allClients.length > 0 && (
              <Text style={styles.clientText} numberOfLines={1}>
                <Text style={styles.dimLabel}>Client: </Text>{allClients.join(', ')}
              </Text>
            )}
          </View>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.text2} />
        </TouchableOpacity>

        <View style={styles.weightRow}>
          <View style={styles.wtCol}>
            <Text style={styles.wtLabel}>PO Weight</Text>
            <Text style={styles.wtVal}>{fmtWt(totalPoWt)} MT</Text>
          </View>
          <View style={styles.wtCol}>
            <Text style={styles.wtLabel}>Shipped</Text>
            <Text style={[styles.wtVal, { color: C.accent }]}>{fmtWt(totalShipped)} MT</Text>
          </View>
          <View style={styles.wtCol}>
            <Text style={styles.wtLabel}>Remaining</Text>
            <Text style={[styles.wtVal, { color: totalRemaining < 0 ? C.danger : C.success }]}>
              {fmtWt(Math.abs(totalRemaining))} MT
            </Text>
          </View>
        </View>

        {allInvNums.length > 0 && (
          <Text style={styles.invNums}>Invoice: {allInvNums.join(', ')}</Text>
        )}

        {isExpanded && (
          <View style={styles.productList}>
            <View style={styles.productHeader}>
              <Text style={[styles.productHeaderLabel, { flex: 2 }]}>Description</Text>
              <Text style={styles.productHeaderLabel}>Client</Text>
              <Text style={styles.productHeaderNum}>PO</Text>
              <Text style={styles.productHeaderNum}>Ship</Text>
              <Text style={styles.productHeaderNum}>Rem.</Text>
            </View>
            {grp.map((r, i) => (
              <View key={i} style={[styles.productRow, i % 2 === 1 && styles.productRowAlt]}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.productDesc} numberOfLines={2}>{r.description}</Text>
                  {r.unitPrc > 0 && <Text style={styles.unitPrc}>{fmtAmt(r.unitPrc, r.cur)}</Text>}
                  {r.destinations.length > 0 && <Text style={styles.destText} numberOfLines={1}>{r.destinations.join(', ')}</Text>}
                  {r.invoiceNums.length > 0 && <Text style={styles.invNumText} numberOfLines={1}>#{r.invoiceNums.join(', ')}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  {r.clients.length > 0
                    ? r.clients.map((c, ci) => <Text key={ci} style={styles.clientCell} numberOfLines={1}>{c}</Text>)
                    : <Text style={styles.clientCell}>—</Text>}
                </View>
                <View style={styles.productNums}>
                  <Text style={styles.productNum}>{fmtWt(r.poWeight)}</Text>
                  <Text style={[styles.productNum, { color: C.accent }]}>{fmtWt(r.shippedWeight)}</Text>
                  <Text style={[styles.productNum, { color: r.remaining < 0 ? C.danger : C.success }]}>
                    {fmtWt(Math.abs(r.remaining))}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderFlatRow = ({ item: r, index }) => (
    <View style={[styles.flatRow, index % 2 === 1 && styles.flatRowAlt]}>
      <View style={styles.flatLeft}>
        <Text style={styles.poNum}>PO# {r.order}</Text>
        <Text style={styles.supplierName}>{r.supplier}</Text>
        <Text style={styles.dateText}>{safeDate(r.date)}</Text>
      </View>
      <View style={styles.flatMid}>
        <Text style={styles.productDesc} numberOfLines={2}>{r.description}</Text>
        {r.clients.length > 0 && (
          <Text style={styles.clientText} numberOfLines={1}>
            <Text style={styles.dimLabel}>Client: </Text>{r.clients.join(', ')}
          </Text>
        )}
        {r.destinations.length > 0 && <Text style={styles.destText} numberOfLines={1}>{r.destinations.join(', ')}</Text>}
        {r.invoiceNums.length > 0 && <Text style={styles.invNumText} numberOfLines={1}>#{r.invoiceNums.join(', ')}</Text>}
      </View>
      <View style={styles.flatRight}>
        <View style={styles.flatWtRow}>
          <Text style={styles.wtLabel}>PO</Text>
          <Text style={styles.wtVal}>{fmtWt(r.poWeight)}</Text>
        </View>
        <View style={styles.flatWtRow}>
          <Text style={styles.wtLabel}>Ship</Text>
          <Text style={[styles.wtVal, { color: C.accent }]}>{fmtWt(r.shippedWeight)}</Text>
        </View>
        <View style={styles.flatWtRow}>
          <Text style={styles.wtLabel}>Rem.</Text>
          <Text style={[styles.wtVal, { color: r.remaining < 0 ? C.danger : C.success }]}>
            {fmtWt(Math.abs(r.remaining))}
          </Text>
        </View>
      </View>
    </View>
  );

  const ListFooter = () => (
    supplierTotals.length > 0 ? (
      <View style={styles.totalsCard}>
        <Text style={styles.totalsTitle}>Totals by Supplier</Text>
        <View style={[styles.totalsRow, styles.totalsHeader]}>
          <Text style={[styles.totalsSupplier, { color: C.text1 }]}>Supplier</Text>
          <View style={styles.totalsNums}>
            <Text style={styles.totalsHeaderNum}>PO MT</Text>
            <Text style={styles.totalsHeaderNum}>Shipped</Text>
            <Text style={styles.totalsHeaderNum}>Remaining</Text>
          </View>
        </View>
        {supplierTotals.map((s, i) => (
          <View key={i} style={[styles.totalsRow, i % 2 === 1 && { backgroundColor: C.bg2 }]}>
            <Text style={styles.totalsSupplier} numberOfLines={1}>{s.supplier}</Text>
            <View style={styles.totalsNums}>
              <Text style={styles.totalsNum}>{fmtWt(s.poWeight)}</Text>
              <Text style={[styles.totalsNum, { color: C.accent }]}>{fmtWt(s.shippedWeight)}</Text>
              <Text style={[styles.totalsNum, { color: s.remaining < 0 ? C.danger : C.success }]}>
                {fmtWt(Math.abs(s.remaining))}
              </Text>
            </View>
          </View>
        ))}
      </View>
    ) : null
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Contracts Statement" navigation={navigation} showBack />
      <DateRangeFilter
        onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
        initialYear={_cy}
      />

      <View style={styles.toolRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.text2} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
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
        <TouchableOpacity
          style={[styles.iconBtn, flatMode && styles.iconBtnActive]}
          onPress={() => setFlatMode(v => !v)}
        >
          <Ionicons name={flatMode ? 'list-outline' : 'albums-outline'} size={16} color={flatMode ? C.text1 : C.accent} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={16} color={C.accent} />
        </TouchableOpacity>
      </View>

      <Text style={styles.count}>
        {flatMode ? filteredFlat.length : filteredGrouped.length} {flatMode ? 'products' : 'contracts'} · {rows.length} total products
      </Text>

      <FlatList
        style={{ flex: 1 }}
        data={flatMode ? filteredFlat : filteredGrouped}
        keyExtractor={(item, i) => (flatMode ? `${item._conId}-${i}` : item[0]?._conId || String(i))}
        renderItem={flatMode ? renderFlatRow : renderGroup}
        contentContainerStyle={[flatMode ? styles.flatList : styles.list, { paddingBottom: getBottomPad(insets) }]}
        windowSize={10}
        maxToRenderPerBatch={12}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.accent} />}
        ListEmptyComponent={<EmptyState icon="document-outline" title="No contracts" subtitle="Try changing the year or search" />}
        ListFooterComponent={<ListFooter />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  toolRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 6, gap: 8 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 40,
    backgroundColor: C.bg2, borderRadius: 999, borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: C.text1 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999, backgroundColor: C.bg2,
    borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center',
  },
  iconBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  count: { paddingHorizontal: 16, fontSize: 11, color: C.text2, marginBottom: 4 },
  list: { padding: 12, gap: 10 },
  flatList: { paddingVertical: 4 },

  card: { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginHorizontal: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  poNum: { fontSize: 13, fontWeight: '700', color: C.accent },
  dateText: { fontSize: 11, color: C.text2 },
  supplierName: { fontSize: 12, fontWeight: '600', color: C.text1 },
  origSupplier: { fontSize: 11, color: C.text2, marginTop: 1 },
  clientText: { fontSize: 10, color: C.text1, marginTop: 2 },
  dimLabel: { color: C.text2, fontWeight: '700' },

  weightRow: {
    flexDirection: 'row', backgroundColor: C.bg2,
    borderTopWidth: 1, borderTopColor: '#e3f0fb', paddingHorizontal: 14, paddingVertical: 10,
  },
  wtCol: { flex: 1, alignItems: 'center' },
  wtLabel: { fontSize: 9, fontWeight: '600', color: C.text2, textTransform: 'uppercase', marginBottom: 3 },
  wtVal: { fontSize: 12, fontWeight: '700', color: C.text1 },
  invNums: { fontSize: 10, color: C.text2, paddingHorizontal: 14, paddingBottom: 8 },

  productList: { borderTopWidth: 1, borderTopColor: '#e3f0fb' },
  productHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.accent, paddingHorizontal: 10, paddingVertical: 6,
  },
  productHeaderLabel: { flex: 1, fontSize: 8, fontWeight: '700', color: C.text1 },
  productHeaderNum: { width: 48, fontSize: 8, fontWeight: '700', color: C.text1, textAlign: 'right' },
  productRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.bg2,
  },
  productRowAlt: { backgroundColor: C.bg2 },
  productDesc: { fontSize: 11, color: C.text1, fontWeight: '500' },
  unitPrc: { fontSize: 10, color: C.accent, marginTop: 2 },
  destText: { fontSize: 9, color: C.text2, marginTop: 1 },
  invNumText: { fontSize: 9, color: C.text2, marginTop: 1 },
  clientCell: { fontSize: 10, color: C.text1, fontWeight: '500' },
  productNums: { width: 144, flexDirection: 'row', justifyContent: 'flex-end' },
  productNum: { width: 48, fontSize: 10, fontWeight: '600', color: C.text1, textAlign: 'right' },

  flatRow: {
    flexDirection: 'row', backgroundColor: C.bg2,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  flatRowAlt: { backgroundColor: C.bg2 },
  flatLeft: { width: 90 },
  flatMid: { flex: 1, paddingHorizontal: 8 },
  flatRight: { width: 96, alignItems: 'flex-end' },
  flatWtRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3, justifyContent: 'space-between' },

  totalsCard: {
    marginHorizontal: 12, marginTop: 4, backgroundColor: C.bg2,
    borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  totalsTitle: { fontSize: 12, fontWeight: '700', color: C.text1, padding: 12, paddingBottom: 6 },
  totalsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.bg2,
  },
  totalsHeader: { backgroundColor: C.accent },
  totalsSupplier: { flex: 1.2, fontSize: 11, fontWeight: '600', color: C.text1, marginRight: 8 },
  totalsNums: { flex: 2, flexDirection: 'row', justifyContent: 'space-between' },
  totalsNum: { flex: 1, fontSize: 11, fontWeight: '700', color: C.text1, textAlign: 'right' },
  totalsHeaderNum: { flex: 1, fontSize: 9, fontWeight: '700', color: C.text1, textAlign: 'right' },
});
