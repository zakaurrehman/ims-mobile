import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, ScrollView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadAllStockData } from '../../shared/utils/firestore';
import { getName, formatCurrency } from '../../shared/utils/helpers';
import { exportToExcel } from '../../shared/utils/exportUtils';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';

// Port of web's filteredArray: if invoice has both original and final, keep final
function filteredArray(arr) {
  const grouped = arr.reduce((acc, obj) => {
    const key = obj.invoice || obj.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(obj);
    return acc;
  }, {});

  return Object.values(grouped).flatMap(group => {
    const types = new Set(group.map(o => parseInt(o.invType, 10)));
    if (types.size === 1) return group;
    const maxType = Math.max(...types);
    return group.filter(o => parseInt(o.invType, 10) === maxType);
  });
}

function aggregateStocks(rawData, settings) {
  // Build description name for each record
  const withDesc = rawData.map(x => ({
    ...x,
    descriptionName:
      x.type === 'in' && x.description
        ? x.productsData?.find(y => y.id === x.description)?.description
        : x.mtrlStatus === 'select' || x.isSelection
        ? x.productsData?.find(y => y.id === x.descriptionId)?.description
        : x.type === 'out' && x.moveType === 'out'
        ? x.descriptionName
        : x.descriptionText,
  }));

  // Unique (stock, description) pairs
  let pairs = withDesc
    .filter(x => x.stock)
    .map(x => ({ stock: x.stock, description: x.description || x.descriptionId }));
  pairs = Array.from(
    new Map(pairs.map(p => [`${p.stock}|${p.description}`, p])).values()
  );

  const result = [];
  for (const pair of pairs) {
    let group = withDesc.filter(
      x =>
        (x.description === pair.description || x.descriptionId === pair.description) &&
        x.stock === pair.stock
    );
    group = filteredArray(group);

    let totalQty = 0;
    let refObj = null;

    for (const x of group) {
      if (x.type === 'in') {
        const baseQty = Math.abs(parseFloat(x.qnty) || 0);
        const finalAdj =
          x.finalqnty && x.finalqnty * 1 !== x.qnty * 1
            ? (x.qnty * 1 - x.finalqnty * 1) * -1
            : 0;
        totalQty += baseQty + finalAdj;
        if (x.description) refObj = x; // contract invoice as reference
      } else {
        totalQty -= Math.abs(parseFloat(x.qnty) || 0);
      }
    }

    if (totalQty <= 0.1) continue;

    const ref = refObj || group[0] || {};
    const stockName = getName(settings, 'Stocks', ref.stock, 'stock') || ref.stock || '—';
    const descName =
      ref.descriptionName ||
      ref.productsData?.[0]?.description ||
      pair.description ||
      '—';
    const unit = getName(settings, 'Quantity', ref.qTypeTable, 'qTypeTable') || ref.qTypeTable || '';
    const supplierName = getName(settings, 'Supplier', ref.supplier) || '—';

    result.push({
      key: `${pair.stock}|${pair.description}`,
      stockName,
      descName,
      supplierName,
      qnty: parseFloat(totalQty.toFixed(3)),
      unit,
      cur: ref.cur || '',
      unitPrc: parseFloat(ref.unitPrc) || 0,
    });
  }

  return result.sort((a, b) => a.stockName.localeCompare(b.stockName));
}

export default function StocksScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [detailItem, setDetailItem] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  const load = async () => {
    if (!uidCollection) return;
    try {
      const raw = await loadAllStockData(uidCollection);
      setStocks(aggregateStocks(raw, settings));
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection]);

  const warehouses = ['all', ...new Set(stocks.map(s => s.stockName))];

  const filtered = stocks.filter(s => {
    const matchWH = selectedWarehouse === 'all' || s.stockName === selectedWarehouse;
    if (!matchWH) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.descName.toLowerCase().includes(q) || s.supplierName.toLowerCase().includes(q);
  });

  const totalValue = filtered.reduce((sum, s) => sum + s.qnty * s.unitPrc, 0);
  const totalQty = filtered.reduce((sum, s) => sum + s.qnty, 0);

  // Summary table per warehouse
  const warehouseSummary = filtered.reduce((acc, s) => {
    if (!acc[s.stockName]) acc[s.stockName] = { qty: 0, value: 0, items: 0 };
    acc[s.stockName].qty += s.qnty;
    acc[s.stockName].value += s.qnty * s.unitPrc;
    acc[s.stockName].items += 1;
    return acc;
  }, {});

  const handleExport = () => {
    const cols = [
      { key: 'descName', label: 'Description' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'stockName', label: 'Warehouse' },
      { key: 'qnty', label: 'Quantity' },
      { key: 'unit', label: 'Unit' },
      { key: 'unitPrc', label: 'Unit Price' },
    ];
    exportToExcel(filtered, cols, 'stocks_inventory');
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Stocks" navigation={navigation} showBack />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9fb8d4" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.search}
          placeholder="Search stocks..."
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

      {/* Warehouse filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBar} contentContainerStyle={styles.chipsContent}>
        {warehouses.map(wh => (
          <TouchableOpacity
            key={wh}
            style={[styles.chip, selectedWarehouse === wh && styles.chipActive]}
            onPress={() => setSelectedWarehouse(wh)}
          >
            <Text style={[styles.chipText, selectedWarehouse === wh && styles.chipTextActive]}>
              {wh === 'all' ? 'All Warehouses' : wh}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>{filtered.length} items · {totalQty.toFixed(3)} MT</Text>
        <TouchableOpacity onPress={() => setShowSummary(true)} style={styles.summaryRight}>
          <Text style={styles.summaryValue}>
            {new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(totalValue)}
          </Text>
          <Ionicons name="bar-chart-outline" size={14} color="#0366ae" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={16} color="#0366ae" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.key}
        contentContainerStyle={styles.list}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0366ae" />}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="No stocks found" subtitle="Try adjusting the search or filter" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setDetailItem(item)} activeOpacity={0.85}>
            <View style={styles.cardLeft}>
              <Text style={styles.descName}>{item.descName}</Text>
              <Text style={styles.supplierName}>{item.supplierName}</Text>
              <View style={styles.warehousePill}>
                <Ionicons name="business-outline" size={10} color="#0366ae" />
                <Text style={styles.warehouseText}>{item.stockName}</Text>
              </View>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.qty}>
                {new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(item.qnty)}
              </Text>
              <Text style={styles.unit}>{item.unit}</Text>
              {item.unitPrc > 0 && (
                <Text style={styles.unitPrc}>${item.unitPrc.toFixed(2)}/MT</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* ─── Stock Detail Modal ─────────────────────────────────────────── */}
      <Modal visible={!!detailItem} animationType="slide" transparent onRequestClose={() => setDetailItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{detailItem?.descName}</Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close" size={22} color="#103a7a" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {detailItem && (<>
                <DRow label="Warehouse" value={detailItem.stockName} />
                <DRow label="Supplier" value={detailItem.supplierName} />
                <DRow label="Quantity" value={`${detailItem.qnty.toFixed(3)} ${detailItem.unit}`} />
                <DRow label="Unit Price" value={detailItem.unitPrc > 0 ? `$${detailItem.unitPrc.toFixed(2)}` : '—'} />
                <DRow label="Total Value" value={detailItem.unitPrc > 0 ? formatCurrency(detailItem.qnty * detailItem.unitPrc) : '—'} />
                <DRow label="Currency" value={detailItem.cur} />
              </>)}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Summary Table Modal ────────────────────────────────────────── */}
      <Modal visible={showSummary} animationType="slide" transparent onRequestClose={() => setShowSummary(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Summary by Warehouse</Text>
              <TouchableOpacity onPress={() => setShowSummary(false)}>
                <Ionicons name="close" size={22} color="#103a7a" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {Object.entries(warehouseSummary).map(([wh, data]) => (
                <View key={wh} style={styles.sumRow}>
                  <View style={styles.sumLeft}>
                    <Text style={styles.sumWH}>{wh}</Text>
                    <Text style={styles.sumItems}>{data.items} items</Text>
                  </View>
                  <View style={styles.sumRight}>
                    <Text style={styles.sumQty}>{data.qty.toFixed(3)} MT</Text>
                    {data.value > 0 && <Text style={styles.sumVal}>{formatCurrency(data.value)}</Text>}
                  </View>
                </View>
              ))}
              <View style={[styles.sumRow, styles.sumTotalRow]}>
                <Text style={styles.sumTotalLabel}>Total</Text>
                <View style={styles.sumRight}>
                  <Text style={[styles.sumQty, { color: '#0366ae', fontWeight: '800' }]}>{totalQty.toFixed(3)} MT</Text>
                  {totalValue > 0 && <Text style={[styles.sumVal, { color: '#0366ae' }]}>{formatCurrency(totalValue)}</Text>}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 14, height: 40,
    backgroundColor: '#fff', borderRadius: 999,
    borderWidth: 1, borderColor: '#b8ddf8',
  },
  search: { flex: 1, fontSize: 13, color: '#103a7a' },
  chipsBar: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 6, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: '#b8ddf8', backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#103a7a', borderColor: '#103a7a' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#9fb8d4' },
  chipTextActive: { color: '#fff' },
  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: '#ebf2fc', marginHorizontal: 12, borderRadius: 10, marginBottom: 4,
  },
  summaryText: { fontSize: 11, color: '#0366ae', fontWeight: '600', flex: 1 },
  summaryRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryValue: { fontSize: 11, color: '#103a7a', fontWeight: '700' },
  exportBtn: { width: 28, height: 28, borderRadius: 999, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#b8ddf8', marginLeft: 8 },
  list: { padding: 12, gap: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#b8ddf8', padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardLeft: { flex: 1, marginRight: 12 },
  descName: { fontSize: 13, fontWeight: '700', color: '#103a7a', marginBottom: 2 },
  supplierName: { fontSize: 11, color: '#9fb8d4', marginBottom: 4 },
  warehousePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', backgroundColor: '#ebf2fc',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  warehouseText: { fontSize: 10, color: '#0366ae', fontWeight: '600' },
  cardRight: { alignItems: 'flex-end' },
  qty: { fontSize: 18, fontWeight: '800', color: '#0366ae' },
  unit: { fontSize: 11, color: '#9fb8d4', marginTop: 2 },
  unitPrc: { fontSize: 10, color: '#b8ddf8', marginTop: 1 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#9fb8d4' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e3f0fb' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#103a7a', flex: 1, marginRight: 12 },
  modalBody: { padding: 20, gap: 8, paddingBottom: 32 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  detailLabel: { fontSize: 12, color: '#9fb8d4', flex: 1 },
  detailValue: { fontSize: 12, fontWeight: '600', color: '#103a7a', flex: 2, textAlign: 'right' },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  sumLeft: { flex: 1 },
  sumWH: { fontSize: 13, fontWeight: '700', color: '#103a7a' },
  sumItems: { fontSize: 10, color: '#9fb8d4' },
  sumRight: { alignItems: 'flex-end' },
  sumQty: { fontSize: 12, fontWeight: '700', color: '#103a7a' },
  sumVal: { fontSize: 11, color: '#9fb8d4' },
  sumTotalRow: { borderBottomWidth: 0, marginTop: 4, borderTopWidth: 1, borderTopColor: '#b8ddf8' },
  sumTotalLabel: { fontSize: 14, fontWeight: '700', color: '#103a7a' },
});
