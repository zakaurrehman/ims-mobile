import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, Pressable, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { sortArr } from '../../shared/utils/helpers';
import { exportToExcel } from '../../shared/utils/exportUtils';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import DateRangeFilter from '../../components/DateRangeFilter';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';

function fmtN(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  return isNaN(n) ? String(v) : n.toFixed(3);
}

function diff(a, b) {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (isNaN(na) || isNaN(nb)) return null;
  return na - nb;
}

function fmtDiff(v) {
  if (v === null) return '—';
  const s = v.toFixed(3);
  return v > 0.0001 ? `+${s}` : s;
}

export default function AnalysisScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const [loading, setLoading] = useState(false);
  const [loadingInv, setLoadingInv] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const _cy = new Date().getFullYear();
  const [dateRange, setDateRange] = useState({ start: `${_cy}-01-01`, end: `${_cy}-12-31` });
  const dateSelect = dateRange;
  const year = dateRange.start?.substring(0, 4) || String(_cy);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const suppliers = useMemo(() =>
    sortArr((settings?.Supplier?.Supplier || []).filter(x => !x.deleted), 'nname'),
    [settings]
  );

  const loadContracts = async () => {
    if (!uidCollection || !selectedSupplier) return;
    setLoading(true);
    setError(null);
    try {
      const allContracts = await loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect);
      const filtered = (allContracts || []).filter(c => c.supplier === selectedSupplier.id);
      setContracts(filtered);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const loadInvoices = async () => {
    if (!uidCollection || contracts.length === 0) return;
    setLoadingInv(true);
    try {
      const allInvoices = await loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect);
      setInvoices(allInvoices || []);
    } catch (e) { console.error(e); }
    finally { setLoadingInv(false); setRefreshing(false); }
  };

  useEffect(() => {
    if (selectedSupplier) loadContracts();
    else { setContracts([]); setInvoices([]); }
  }, [uidCollection, dateRange, selectedSupplier]);

  useEffect(() => {
    if (contracts.length > 0) loadInvoices();
    else setInvoices([]);
  }, [contracts]);

  const onRefresh = () => { setRefreshing(true); loadContracts(); };

  // Build analysis rows from contracts + invoices
  const rows = useMemo(() => {
    if (contracts.length === 0) return [];

    // Index invoices by contract id (poSupplier.id)
    const invByContract = {};
    invoices.forEach(inv => {
      const cid = inv.poSupplier?.id;
      if (!cid) return;
      if (!invByContract[cid]) invByContract[cid] = [];
      invByContract[cid].push(inv);
    });

    const result = [];
    contracts.forEach(contract => {
      const conInvoices = invByContract[contract.id] || [];
      conInvoices.forEach(inv => {
        const products = inv.productsDataInvoice || [];
        products.forEach(p => {
          if (p.qnty === 's' || p.qnty === '') return;
          // Match contract product for spec data
          const conProduct = (contract.productsData || []).find(cp => cp.id === p.descriptionId);
          const ToNi = conProduct?.ni ?? conProduct?.ToNi ?? null;
          const ToCr = conProduct?.cr ?? conProduct?.ToCr ?? null;
          const ToMo = conProduct?.mo ?? conProduct?.ToMo ?? null;
          const Toqnty = conProduct?.qnty ?? null;
          const BackNi = p.ni ?? p.BackNi ?? null;
          const BackCr = p.cr ?? p.BackCr ?? null;
          const BackMo = p.mo ?? p.BackMo ?? null;
          const Backqnty = parseFloat(p.qnty) || 0;
          result.push({
            _contractId: contract.id,
            order: contract.order || '—',
            date: contract.date || '',
            cert: p.cert || '',
            ToNi, ToCr, ToMo, Toqnty,
            invoice: inv.invoice || '',
            BackNi, BackCr, BackMo, Backqnty,
            diffNi: diff(BackNi, ToNi),
            diffCr: diff(BackCr, ToCr),
            diffMo: diff(BackMo, ToMo),
            diffqnty: Toqnty ? diff(Backqnty, parseFloat(Toqnty) || 0) : null,
          });
        });
      });
    });

    return result.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  }, [contracts, invoices]);

  const handleExport = () => {
    const cols = [
      { key: 'order', label: 'PO#' },
      { key: 'cert', label: 'Cert' },
      { key: 'ToNi', label: 'Ni (spec)' },
      { key: 'ToCr', label: 'Cr (spec)' },
      { key: 'ToMo', label: 'Mo (spec)' },
      { key: 'Toqnty', label: 'Weight (spec)' },
      { key: 'invoice', label: 'Invoice Ref' },
      { key: 'BackNi', label: 'Ni (back)' },
      { key: 'BackCr', label: 'Cr (back)' },
      { key: 'BackMo', label: 'Mo (back)' },
      { key: 'Backqnty', label: 'Weight (back)' },
      { key: 'diffNi', label: 'Diff Ni' },
      { key: 'diffCr', label: 'Diff Cr' },
      { key: 'diffMo', label: 'Diff Mo' },
      { key: 'diffqnty', label: 'Diff Weight' },
    ];
    const data = rows.map(r => ({
      order: r.order,
      cert: r.cert,
      ToNi: r.ToNi ?? '',
      ToCr: r.ToCr ?? '',
      ToMo: r.ToMo ?? '',
      Toqnty: r.Toqnty ?? '',
      invoice: r.invoice,
      BackNi: r.BackNi ?? '',
      BackCr: r.BackCr ?? '',
      BackMo: r.BackMo ?? '',
      Backqnty: r.Backqnty,
      diffNi: r.diffNi ?? '',
      diffCr: r.diffCr ?? '',
      diffMo: r.diffMo ?? '',
      diffqnty: r.diffqnty ?? '',
    }));
    exportToExcel(data, cols, `weight_analysis_${year}`);
  };

  if (error) return <ErrorState message={error} onRetry={loadContracts} />;

  const isLoading = loading || loadingInv;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Weight Analysis" navigation={navigation} showBack />
      <DateRangeFilter
        onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
        initialYear={_cy}
      />

      {/* Supplier selector */}
      <TouchableOpacity style={styles.supplierSelector} onPress={() => setPickerVisible(true)} activeOpacity={0.8}>
        <Ionicons name="business-outline" size={16} color={C.accent} />
        <Text style={[styles.supplierText, !selectedSupplier && styles.supplierPlaceholder]}>
          {selectedSupplier ? selectedSupplier.nname || selectedSupplier.supplier : 'Select supplier...'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C.text2} />
      </TouchableOpacity>

      {isLoading && (
        <View style={styles.loadingRow}>
          <Spinner />
        </View>
      )}

      {!selectedSupplier && !isLoading && (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={48} color={C.text2} />
          <Text style={styles.emptyText}>Select a supplier to view weight analysis</Text>
        </View>
      )}

      {selectedSupplier && !isLoading && rows.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color={C.text2} />
          <Text style={styles.emptyText}>No analysis data found for this supplier</Text>
        </View>
      )}

      {selectedSupplier && !isLoading && rows.length > 0 && (
        <>
          {/* Export button */}
          <TouchableOpacity style={styles.exportBar} onPress={handleExport}>
            <Ionicons name="download-outline" size={14} color={C.accent} />
            <Text style={styles.exportBarText}>Export Excel</Text>
          </TouchableOpacity>

          {/* Column headers — horizontally scrollable table */}
          <View style={styles.tableContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Header */}
                <View style={styles.headerRow}>
                  <Text style={[styles.th, styles.colOrder]}>PO#</Text>
                  <Text style={[styles.th, styles.colCert]}>Cert</Text>
                  <Text style={[styles.th, styles.colElem]}>Ni{'\n'}(spec)</Text>
                  <Text style={[styles.th, styles.colElem]}>Cr{'\n'}(spec)</Text>
                  <Text style={[styles.th, styles.colElem]}>Mo{'\n'}(spec)</Text>
                  <Text style={[styles.th, styles.colQty]}>MT{'\n'}(spec)</Text>
                  <Text style={[styles.th, styles.colInv]}>Inv#</Text>
                  <Text style={[styles.th, styles.colElem]}>Ni{'\n'}(back)</Text>
                  <Text style={[styles.th, styles.colElem]}>Cr{'\n'}(back)</Text>
                  <Text style={[styles.th, styles.colElem]}>Mo{'\n'}(back)</Text>
                  <Text style={[styles.th, styles.colQty]}>MT{'\n'}(back)</Text>
                  <Text style={[styles.th, styles.colDiff]}>ΔNi</Text>
                  <Text style={[styles.th, styles.colDiff]}>ΔCr</Text>
                  <Text style={[styles.th, styles.colDiff]}>ΔMo</Text>
                  <Text style={[styles.th, styles.colDiff]}>ΔMT</Text>
                </View>
                {/* Rows */}
                <FlatList
                  data={rows}
                  keyExtractor={(item, i) => `${item._contractId}-${item.invoice}-${i}`}
                  scrollEnabled={false}
                  contentContainerStyle={{ paddingBottom: getBottomPad(insets) }}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
                  renderItem={({ item, index }) => {
                    const isAvg = item.cert === 'Average';
                    return (
                      <View style={[styles.dataRow, index % 2 === 1 && styles.dataRowAlt, isAvg && styles.dataRowAvg]}>
                        <Text style={[styles.td, styles.colOrder, { fontWeight: '600', color: C.accent }]} numberOfLines={1}>{item.order}</Text>
                        <Text style={[styles.td, styles.colCert]} numberOfLines={1}>{item.cert || '—'}</Text>
                        <Text style={[styles.td, styles.colElem]}>{fmtN(item.ToNi)}</Text>
                        <Text style={[styles.td, styles.colElem]}>{fmtN(item.ToCr)}</Text>
                        <Text style={[styles.td, styles.colElem]}>{fmtN(item.ToMo)}</Text>
                        <Text style={[styles.td, styles.colQty]}>{fmtN(item.Toqnty)}</Text>
                        <Text style={[styles.td, styles.colInv]} numberOfLines={1}>{item.invoice || '—'}</Text>
                        <Text style={[styles.td, styles.colElem]}>{fmtN(item.BackNi)}</Text>
                        <Text style={[styles.td, styles.colElem]}>{fmtN(item.BackCr)}</Text>
                        <Text style={[styles.td, styles.colElem]}>{fmtN(item.BackMo)}</Text>
                        <Text style={[styles.td, styles.colQty]}>{fmtN(item.Backqnty)}</Text>
                        <Text style={[styles.td, styles.colDiff, item.diffNi !== null && item.diffNi > 0.001 && styles.diffPos, item.diffNi !== null && item.diffNi < -0.001 && styles.diffNeg]}>
                          {fmtDiff(item.diffNi)}
                        </Text>
                        <Text style={[styles.td, styles.colDiff, item.diffCr !== null && item.diffCr > 0.001 && styles.diffPos, item.diffCr !== null && item.diffCr < -0.001 && styles.diffNeg]}>
                          {fmtDiff(item.diffCr)}
                        </Text>
                        <Text style={[styles.td, styles.colDiff, item.diffMo !== null && item.diffMo > 0.001 && styles.diffPos, item.diffMo !== null && item.diffMo < -0.001 && styles.diffNeg]}>
                          {fmtDiff(item.diffMo)}
                        </Text>
                        <Text style={[styles.td, styles.colDiff, item.diffqnty !== null && item.diffqnty > 0.001 && styles.diffPos, item.diffqnty !== null && item.diffqnty < -0.001 && styles.diffNeg]}>
                          {fmtDiff(item.diffqnty)}
                        </Text>
                      </View>
                    );
                  }}
                />
              </View>
            </ScrollView>
          </View>
        </>
      )}

      {/* Supplier picker modal */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Select Supplier</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {suppliers.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.pickerItem, selectedSupplier?.id === s.id && styles.pickerItemActive]}
                  onPress={() => { setSelectedSupplier(s); setPickerVisible(false); }}
                >
                  <Text style={[styles.pickerItemText, selectedSupplier?.id === s.id && styles.pickerItemTextActive]}>
                    {s.nname || s.supplier}
                  </Text>
                  {selectedSupplier?.id === s.id && <Ionicons name="checkmark" size={16} color={C.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const COL_ORDER = 80;
const COL_CERT = 60;
const COL_ELEM = 62;
const COL_QTY = 62;
const COL_INV = 56;
const COL_DIFF = 56;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  supplierSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginTop: 4, marginBottom: 8,
    backgroundColor: C.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  supplierText: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text1 },
  supplierPlaceholder: { color: C.text2, fontWeight: '400' },
  loadingRow: { flex: 1, justifyContent: 'center' },
  exportBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 12, marginBottom: 6,
    backgroundColor: C.bgTertiary, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  exportBarText: { fontSize: 12, fontWeight: '600', color: C.accent },
  tableContainer: { flex: 1, marginHorizontal: 4 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: C.bgTertiary,
    borderTopLeftRadius: 10, borderTopRightRadius: 10,
    paddingVertical: 6, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dataRow: {
    flexDirection: 'row',
    backgroundColor: C.bg2,
    paddingVertical: 7, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dataRowAlt: { backgroundColor: C.bg1 },
  dataRowAvg: { backgroundColor: C.warningDim },
  th: { fontSize: 9, fontWeight: '700', color: C.text2, textTransform: 'uppercase', textAlign: 'center' },
  td: { fontSize: 10, color: C.text1, textAlign: 'center' },
  diffPos: { color: C.success, fontWeight: '600' },
  diffNeg: { color: C.danger, fontWeight: '600' },
  colOrder: { width: COL_ORDER },
  colCert: { width: COL_CERT },
  colElem: { width: COL_ELEM },
  colQty: { width: COL_QTY },
  colInv: { width: COL_INV },
  colDiff: { width: COL_DIFF },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: C.text2, textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: C.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20,
  },
  pickerTitle: { fontSize: 14, fontWeight: '700', color: C.text1, marginBottom: 12 },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerItemActive: { backgroundColor: C.bgTertiary, borderRadius: 8 },
  pickerItemText: { fontSize: 14, color: C.text1 },
  pickerItemTextActive: { fontWeight: '700', color: C.accent },
});
