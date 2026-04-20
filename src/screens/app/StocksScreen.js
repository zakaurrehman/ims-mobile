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
import { getBottomPad } from '../../theme/spacing';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import C from '../../theme/colors';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
  const [detailTab, setDetailTab] = useState('info'); // 'info' | 'movements'
  const [rawData, setRawData] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryTab, setSummaryTab] = useState('warehouse');

  const load = async () => {
    if (!uidCollection) return;
    try {
      const raw = await loadAllStockData(uidCollection);
      setRawData(raw || []);
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

  // GradeTable: grouped by description + unit type, shows total qty + avg cost/MT
  // Mirrors web's stocks/sumtables/gradeTable.js
  const gradeData = Object.values(
    filtered.reduce((acc, s) => {
      const key = `${s.descName}|${s.unit}`;
      if (!acc[key]) acc[key] = { descName: s.descName, unit: s.unit, totalQty: 0, totalValue: 0 };
      acc[key].totalQty += s.qnty;
      acc[key].totalValue += s.qnty * s.unitPrc;
      return acc;
    }, {})
  )
    .filter(r => r.totalQty > 0.1)
    .sort((a, b) => a.descName.localeCompare(b.descName))
    .map(r => ({ ...r, avgCost: r.totalQty > 0 ? r.totalValue / r.totalQty : 0 }));

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
  if (error) return <ErrorState message={error} onRetry={() => { setError(null); setLoading(true); load(); }} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Stocks" navigation={navigation} showBack />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={C.text2} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.search}
          placeholder="Search stocks..."
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
          <Ionicons name="bar-chart-outline" size={14} color={C.accent} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={16} color={C.accent} />
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={item => item.key}
        contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.accent} />}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="No stocks found" subtitle="Try adjusting the search or filter" />}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(280)}>
          <TouchableOpacity style={styles.card} onPress={() => { setDetailItem(item); setDetailTab('info'); }} activeOpacity={0.85}>
            <View style={[styles.accentBar, { backgroundColor: item.qnty > 0 ? C.accent : C.danger }]} />
            <View style={styles.cardContent}>
              <View style={styles.cardLeft}>
                <Text style={styles.descName}>{item.descName}</Text>
                <Text style={styles.supplierName}>{item.supplierName}</Text>
                <View style={styles.warehousePill}>
                  <Ionicons name="business-outline" size={10} color={C.accent} />
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
            </View>
          </TouchableOpacity>
          </Animated.View>
        )}
      />

      {/* ─── S1: Stock Detail Modal (Info + Movements tabs) ────────────── */}
      <Modal visible={!!detailItem} animationType="slide" transparent onRequestClose={() => setDetailItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{detailItem?.descName}</Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            {/* Detail tab bar */}
            <View style={styles.detailTabRow}>
              {[{ key: 'info', label: 'Info' }, { key: 'movements', label: 'Movements' }].map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.detailTab, detailTab === t.key && styles.detailTabActive]}
                  onPress={() => setDetailTab(t.key)}
                >
                  <Text style={[styles.detailTabText, detailTab === t.key && styles.detailTabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {detailItem && detailTab === 'info' && (<>
                <DRow label="Warehouse" value={detailItem.stockName} />
                <DRow label="Supplier" value={detailItem.supplierName} />
                <DRow label="Quantity" value={`${detailItem.qnty.toFixed(3)} ${detailItem.unit}`} />
                <DRow label="Unit Price" value={detailItem.unitPrc > 0 ? `$${detailItem.unitPrc.toFixed(2)}` : '—'} />
                <DRow label="Total Value" value={detailItem.unitPrc > 0 ? formatCurrency(detailItem.qnty * detailItem.unitPrc) : '—'} />
                <DRow label="Currency" value={detailItem.cur} />
              </>)}
              {detailItem && detailTab === 'movements' && (() => {
                // Filter raw movements for this stock item's (stock, description) pair
                const [stockId, descId] = (detailItem.key || '|').split('|');
                const movements = rawData
                  .filter(x => x.stock === stockId &&
                    (x.description === descId || x.descriptionId === descId))
                  .sort((a, b) => {
                    const da = a.date || a.indDate?.startDate || '';
                    const db2 = b.date || b.indDate?.startDate || '';
                    return da.localeCompare(db2);
                  });
                if (!movements.length) return <Text style={styles.emptyMov}>No movement records found</Text>;
                return movements.map((m, i) => {
                  const isIn = m.type === 'in';
                  const qty = parseFloat(m.qnty) || 0;
                  const date = m.date || m.indDate?.startDate || '—';
                  const trxType = m.invoice ? (isIn ? 'Purchase' : 'Shipment') : 'Movement';
                  const supName = getName(settings, 'Supplier', m.supplier) || m.supplier || '—';
                  const clientName = !isIn && m.client ? getName(settings, 'Client', m.client) || '' : '';
                  const invNo = m.invoice ? String(m.invoice).padStart(4, '0') : '';
                  return (
                    <View key={i} style={[styles.movRow, i % 2 === 1 && styles.movRowAlt]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.movDate}>{date.substring(0, 10)}</Text>
                        <Text style={styles.movName} numberOfLines={1}>{clientName || supName}</Text>
                        {invNo ? <Text style={styles.movInv}>INV# {invNo}</Text> : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={[styles.movTypeBadge, { backgroundColor: isIn ? '#f0fdf4' : '#fef2f2' }]}>
                          <Ionicons name={isIn ? 'arrow-down-outline' : 'arrow-up-outline'} size={10} color={isIn ? C.success : C.danger} />
                          <Text style={[styles.movTypeText, { color: isIn ? C.success : C.danger }]}>{trxType}</Text>
                        </View>
                        <Text style={[styles.movQty, { color: isIn ? C.success : C.danger }]}>
                          {isIn ? '+' : '−'}{qty.toFixed(3)} {detailItem.unit}
                        </Text>
                      </View>
                    </View>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Summary Table Modal (Warehouse + Grade tabs) ──────────────── */}
      <Modal visible={showSummary} animationType="slide" transparent onRequestClose={() => setShowSummary(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Summary</Text>
              <TouchableOpacity onPress={() => setShowSummary(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>

            {/* Tab bar inside modal */}
            <View style={styles.sumTabRow}>
              <TouchableOpacity
                style={[styles.sumTab, summaryTab === 'warehouse' && styles.sumTabActive]}
                onPress={() => setSummaryTab('warehouse')}
              >
                <Text style={[styles.sumTabText, summaryTab === 'warehouse' && styles.sumTabTextActive]}>By Warehouse</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sumTab, summaryTab === 'grade' && styles.sumTabActive]}
                onPress={() => setSummaryTab('grade')}
              >
                <Text style={[styles.sumTabText, summaryTab === 'grade' && styles.sumTabTextActive]}>Avg Cost / Grade</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {summaryTab === 'warehouse' ? (
                <>
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
                      <Text style={[styles.sumQty, { color: C.accent, fontWeight: '800' }]}>{totalQty.toFixed(3)} MT</Text>
                      {totalValue > 0 && <Text style={[styles.sumVal, { color: C.accent }]}>{formatCurrency(totalValue)}</Text>}
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {/* GradeTable header */}
                  <View style={styles.gradeHeader}>
                    <Text style={[styles.gradeCell, { flex: 3, textAlign: 'left' }]}>Description</Text>
                    <Text style={styles.gradeCell}>Total MT</Text>
                    <Text style={styles.gradeCell}>Avg $/MT</Text>
                  </View>
                  {gradeData.map((r, i) => (
                    <View key={i} style={[styles.gradeRow, i % 2 === 1 && styles.gradeRowAlt]}>
                      <Text style={[styles.gradeVal, { flex: 3, textAlign: 'left', fontWeight: '600' }]} numberOfLines={2}>{r.descName}</Text>
                      <Text style={styles.gradeVal}>{r.totalQty.toFixed(3)}</Text>
                      <Text style={[styles.gradeVal, { color: C.success, fontWeight: '700' }]}>
                        {r.avgCost > 0 ? `$${r.avgCost.toFixed(0)}` : '—'}
                      </Text>
                    </View>
                  ))}
                  {gradeData.length === 0 && (
                    <Text style={{ textAlign: 'center', color: C.text2, paddingVertical: 20 }}>No grade data</Text>
                  )}
                </>
              )}
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
  root: { flex: 1, backgroundColor: C.bgPrimary },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 14, height: 40,
    backgroundColor: C.bg2, borderRadius: 999,
    borderWidth: 1, borderColor: C.border,
  },
  search: { flex: 1, fontSize: 13, color: C.text1 },
  chipsBar: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 6, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 3,
    height: 26, justifyContent: 'center',
    borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 11, fontWeight: '600', color: C.text2 },
  chipTextActive: { color: C.text1 },
  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: C.bgTertiary, marginHorizontal: 12, borderRadius: 10, marginBottom: 4,
  },
  summaryText: { fontSize: 11, color: C.accent, fontWeight: '600', flex: 1 },
  summaryRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryValue: { fontSize: 11, color: C.text1, fontWeight: '700' },
  exportBtn: { width: 28, height: 28, borderRadius: 999, backgroundColor: C.bg2, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, marginLeft: 8 },
  list: { padding: 12, gap: 8 },
  card: {
    backgroundColor: C.bg1, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', overflow: 'hidden',
  },
  accentBar: { width: 3 },
  cardContent: { flex: 1, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flex: 1, marginRight: 12 },
  descName: { fontSize: 13, fontWeight: '700', color: C.text1, marginBottom: 2 },
  supplierName: { fontSize: 11, color: C.text2, marginBottom: 4 },
  warehousePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', backgroundColor: C.bgTertiary,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  warehouseText: { fontSize: 10, color: C.accent, fontWeight: '600' },
  cardRight: { alignItems: 'flex-end' },
  qty: { fontSize: 18, fontWeight: '800', color: C.accent },
  unit: { fontSize: 11, color: C.text2, marginTop: 2 },
  unitPrc: { fontSize: 10, color: C.text3, marginTop: 1 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: C.text2 },

  handle: { width: 36, height: 4, backgroundColor: C.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.text1, flex: 1, marginRight: 12 },
  modalBody: { padding: 20, gap: 8, paddingBottom: 32 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  detailLabel: { fontSize: 12, color: C.text2, flex: 1 },
  detailValue: { fontSize: 12, fontWeight: '600', color: C.text1, flex: 2, textAlign: 'right' },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  sumLeft: { flex: 1 },
  sumWH: { fontSize: 13, fontWeight: '700', color: C.text1 },
  sumItems: { fontSize: 10, color: C.text2 },
  sumRight: { alignItems: 'flex-end' },
  sumQty: { fontSize: 12, fontWeight: '700', color: C.text1 },
  sumVal: { fontSize: 11, color: C.text2 },
  sumTotalRow: { borderBottomWidth: 0, marginTop: 4, borderTopWidth: 1, borderTopColor: C.border2 },
  sumTotalLabel: { fontSize: 14, fontWeight: '700', color: C.text1 },

  sumTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  sumTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sumTabActive: { borderBottomColor: C.accent },
  sumTabText: { fontSize: 12, fontWeight: '600', color: C.text2 },
  sumTabTextActive: { color: C.accent },

  gradeHeader: {
    flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4,
    backgroundColor: C.bgTertiary, borderRadius: 8, marginBottom: 4,
  },
  gradeRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  gradeRowAlt: { backgroundColor: C.bg2 },
  gradeCell: { flex: 1, fontSize: 10, fontWeight: '700', color: C.accent, textAlign: 'center' },
  gradeVal: { flex: 1, fontSize: 11, color: C.text1, textAlign: 'center' },

  // S1: detail modal tabs
  detailTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bgSecondary },
  detailTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  detailTabActive: { borderBottomWidth: 2, borderBottomColor: C.accent },
  detailTabText: { fontSize: 12, fontWeight: '600', color: C.text2 },
  detailTabTextActive: { color: C.accent },

  // S1: movement rows
  emptyMov: { textAlign: 'center', color: C.text2, fontSize: 13, marginTop: 24 },
  movRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  movRowAlt: { backgroundColor: C.bg2 },
  movDate: { fontSize: 11, color: C.text2 },
  movName: { fontSize: 12, fontWeight: '600', color: C.text1, marginTop: 1 },
  movInv: { fontSize: 10, color: C.accent, marginTop: 1 },
  movTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, marginBottom: 4 },
  movTypeText: { fontSize: 9, fontWeight: '700' },
  movQty: { fontSize: 12, fontWeight: '700' },
});
