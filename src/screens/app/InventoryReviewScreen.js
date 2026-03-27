// Inventory Review — matches web's inventoryreview/page.js
// Shows contracts with: supplier, PO#, Purchase QTY, Shipped (invoices), Remaining, Stocks
import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData, loadAllStockData } from '../../shared/utils/firestore';
import { getName } from '../../shared/utils/helpers';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import AppHeader from '../../components/AppHeader';
import YearPicker from '../../components/YearPicker';
import { exportToExcel } from '../../shared/utils/exportUtils';
import { COLLECTIONS } from '../../constants/collections';

// ─── Web's setNum logic: convert KGS/LB → MT ──────────────────────────────────
const toMT = (value, qUnit) => {
  if (qUnit === 'KGS') return value / 1000;
  if (qUnit === 'LB') return value / 2000;
  return value;
};

// ─── Web's getReduced: keep CN/FN over original if exists ─────────────────────
const getReduced = (dt) => {
  const arr = [];
  for (const obj of dt) {
    const q = dt.filter(x => x.invoice === obj.invoice);
    if (q.length === 1 || (q.length > 1 && obj.invType !== '1111' && obj.invType !== 'Invoice')) {
      arr.push(obj);
    }
  }
  return arr;
};

export default function InventoryReviewScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  const dateSelect = { start: `${year}-01-01`, end: `${year}-12-31` };

  const fetchData = async () => {
    if (!uidCollection) return;
    try {
      // Load contracts
      const contracts = await loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect);

      // Load all invoices for this year for matching
      const invoiceDocs = await loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect);
      const reducedInvoices = getReduced(invoiceDocs);

      // Load all stock data
      const allStocks = await loadAllStockData(uidCollection);

      // Build inventory rows (matching web's logic)
      const qUnit = settings?.Quantity?.Quantity?.[0]?.qTypeTable || 'MT';

      const rows = contracts.map(con => {
        // Stocks linked to this contract
        const contractStockIds = con.stock || [];
        const linkedStocks = allStocks.filter(s => contractStockIds.includes(s.id));
        const stockNames = [...new Set(linkedStocks.map(s =>
          getName(settings, 'Stocks', s.stock, 'stock') || s.stock || ''
        ))];

        // conQnty = sum of stock.qnty values converted to MT (matches web's stockPurchase logic)
        const rawStockTotal = linkedStocks.reduce((sum, s) => sum + (parseFloat(s.qnty) || 0), 0);
        const conQntyMT = toMT(rawStockTotal, qUnit);

        // Shipped: sum of productsDataInvoice[n].qnty from invoices linked to this contract
        // (web's Total(invoicesData, 'productsDataInvoice', 'qnty'))
        const contractInvNumbers = (con.invoices || []).map(i => i.invoice);
        const matchedInvoices = reducedInvoices.filter(inv =>
          contractInvNumbers.includes(String(inv.invoice))
        );
        const shippedMT = matchedInvoices.reduce((sum, inv) => {
          if (inv.canceled) return sum;
          return sum + (inv.productsDataInvoice || []).reduce((pSum, p) => {
            if (!p || p.qnty === '' || p.qnty == null) return pSum;
            return pSum + (parseFloat(p.qnty) || 0);
          }, 0);
        }, 0);

        const remainingMT = conQntyMT - shippedMT;

        return {
          ...con,
          supplierName: getName(settings, 'Supplier', con.supplier),
          conQntyMT,
          shippedMT,
          remainingMT,
          stockNames,
          stockQty: rawStockTotal,
        };
      });

      setData(rows);
    } catch (e) {
      console.error('InventoryReviewScreen:', e);
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [uidCollection, year]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filtered = search
    ? data.filter(x =>
        (x.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
        (x.order || '').toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleExport = () => {
    const cols = [
      { key: 'supplierName', label: 'Supplier' },
      { key: 'order', label: 'PO#' },
      { key: 'date', label: 'Date' },
      { key: 'conQntyMT', label: 'Purchase QTY (MT)' },
      { key: 'shippedMT', label: 'Invoiced (MT)' },
      { key: 'remainingMT', label: 'Remaining (MT)' },
      { key: 'stockQty', label: 'Stock QTY' },
    ];
    exportToExcel(filtered, cols, `inventory_review_${year}`);
  };

  const fmt = n => n != null ? Number(n).toFixed(3) : '0.000';

  const renderItem = ({ item }) => {
    const isExp = expanded[item.id || item.order];
    const remColor = item.remainingMT > 0 ? '#d97706' : item.remainingMT < 0 ? '#dc2626' : '#16a34a';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => toggleExpand(item.id || item.order)}
        activeOpacity={0.85}
      >
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.order}>PO# {item.order || '—'}</Text>
            <Text style={styles.supplier}>{item.supplierName}</Text>
            <Text style={styles.date}>{item.date || ''}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.remBadge, { backgroundColor: remColor + '18' }]}>
              <Text style={[styles.remText, { color: remColor }]}>
                {fmt(item.remainingMT)} MT
              </Text>
              <Text style={[styles.remLabel, { color: remColor }]}>Remaining</Text>
            </View>
            <Ionicons
              name={isExp ? 'chevron-up' : 'chevron-down'}
              size={16} color="#9fb8d4"
            />
          </View>
        </View>

        {/* Expanded detail */}
        {isExp && (
          <View style={styles.detail}>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Purchase QTY</Text>
                <Text style={styles.statValue}>{fmt(item.conQntyMT)} MT</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Invoiced</Text>
                <Text style={[styles.statValue, { color: '#0366ae' }]}>{fmt(item.shippedMT)} MT</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>In Stock</Text>
                <Text style={[styles.statValue, { color: '#7c3aed' }]}>{fmt(item.stockQty)} MT</Text>
              </View>
            </View>

            {/* Stock locations */}
            {item.stockNames?.length > 0 && (
              <View style={styles.stocksWrap}>
                <Text style={styles.stocksLabel}>Stock Locations</Text>
                <View style={styles.stocksRow}>
                  {item.stockNames.map((s, i) => (
                    <View key={i} style={styles.stockChip}>
                      <Text style={styles.stockChipText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Summary totals
  const totalQty = data.reduce((s, x) => s + (x.conQntyMT || 0), 0);
  const totalShipped = data.reduce((s, x) => s + (x.shippedMT || 0), 0);
  const totalRemaining = data.reduce((s, x) => s + (x.remainingMT || 0), 0);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Inventory Review" navigation={navigation} showBack />
      <YearPicker year={year} setYear={setYear} />

      {/* Summary bar */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryVal}>{totalQty.toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>Total MT</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal,{color:'#0366ae'}]}>{totalShipped.toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>Invoiced MT</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal,{color:'#d97706'}]}>{totalRemaining.toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>Remaining MT</Text>
        </View>
      </View>

      {/* Search + Export */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#9fb8d4" />
          <TextInput
            style={styles.searchInput}
            placeholder="Supplier or PO#..."
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
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={18} color="#0366ae" />
        </TouchableOpacity>
      </View>

      <Text style={styles.count}>{filtered.length} contracts</Text>

      <FlatList
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0366ae" />}
        ListEmptyComponent={<EmptyState icon="layers-outline" title="No inventory records found" subtitle="Try changing the year or filters" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  summary: {
    flexDirection: 'row', backgroundColor: '#fff',
    marginHorizontal: 12, marginBottom: 4, borderRadius: 14,
    borderWidth: 1, borderColor: '#b8ddf8', padding: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 14, fontWeight: '800', color: '#103a7a' },
  summaryLabel: { fontSize: 9, color: '#9fb8d4', fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: '#e3f0fb' },
  toolbar: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 4, gap: 8 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8ddf8',
    borderRadius: 999, paddingHorizontal: 12, height: 38,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#103a7a' },
  exportBtn: {
    width: 38, height: 38, borderRadius: 999,
    backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#b8ddf8',
  },
  count: { paddingHorizontal: 16, fontSize: 11, color: '#9fb8d4', marginBottom: 4 },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#b8ddf8', padding: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1, gap: 2 },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  order: { fontSize: 13, fontWeight: '700', color: '#0366ae' },
  supplier: { fontSize: 12, fontWeight: '600', color: '#103a7a' },
  date: { fontSize: 11, color: '#9fb8d4' },
  remBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' },
  remText: { fontSize: 13, fontWeight: '800' },
  remLabel: { fontSize: 8, fontWeight: '600', textTransform: 'uppercase' },
  detail: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f4f8', paddingTop: 12, gap: 10 },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: '#f7fbff', borderRadius: 10, padding: 8 },
  statLabel: { fontSize: 9, color: '#9fb8d4', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  statValue: { fontSize: 13, fontWeight: '700', color: '#103a7a' },
  stocksWrap: { gap: 4 },
  stocksLabel: { fontSize: 10, fontWeight: '700', color: '#9fb8d4', textTransform: 'uppercase' },
  stocksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stockChip: {
    backgroundColor: '#7c3aed18', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  stockChipText: { fontSize: 11, fontWeight: '600', color: '#7c3aed' },
  empty: { textAlign: 'center', color: '#9fb8d4', marginTop: 40, fontSize: 14 },
});
