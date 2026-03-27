import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData, deleteDataDoc } from '../../shared/utils/firestore';
import { formatCurrency, getName } from '../../shared/utils/helpers';
import { usePermission } from '../../shared/hooks/usePermission';
import { useToast } from '../../contexts/ToastContext';
import { hapticWarning } from '../../shared/utils/haptics';
import { exportToExcel, exportToPDF, buildTablePDF } from '../../shared/utils/exportUtils';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import AppHeader from '../../components/AppHeader';
import YearPicker from '../../components/YearPicker';
import SwipeableRow from '../../components/SwipeableRow';
import { COLLECTIONS } from '../../constants/collections';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getInvType = (item) => {
  if (item.invType === '2222' || item.invType === 'Credit Note') return 'cn';
  if (item.invType === '3333' || item.invType === 'Final Note') return 'fn';
  return 'invoice';
};

const getInvStatus = (item) => {
  if (item.canceled) return { label: 'Canceled', color: '#dc2626' };
  if (item.final) return { label: 'Final', color: '#16a34a' };
  return { label: 'Draft', color: '#d97706' };
};

const TYPE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'cn', label: 'CN' },
  { key: 'fn', label: 'FN' },
];

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const { canDelete } = usePermission();
  const { setToast } = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [detailItem, setDetailItem] = useState(null);

  const dateSelect = { start: `${year}-01-01`, end: `${year}-12-31` };

  const fetchData = async () => {
    if (!uidCollection) return;
    try {
      const rows = await loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect);
      const transformed = rows.map(z => ({
        ...z,
        containerNo: (z.productsDataInvoice || []).map(x => x.container).filter(Boolean).join(' '),
        poSupplierOrder: z.poSupplier?.order || '',
        etdDate: z.shipData?.etd?.endDate || '',
        etaDate: z.shipData?.eta?.endDate || '',
        totalPrepayment: parseFloat(z.totalPrepayment) || 0,
      }));
      setData(transformed);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, [uidCollection, year]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (item) => {
    Alert.alert('Delete Invoice', `Delete INV# ${item.invoice}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const yr = (item.date || '').substring(0, 4) || String(new Date().getFullYear());
          const ok = await deleteDataDoc(uidCollection, COLLECTIONS.INVOICES, yr, item.id);
          if (ok) {
            setData(prev => prev.filter(x => x.id !== item.id));
            setDetailItem(null);
            hapticWarning();
            setToast({ text: 'Invoice deleted', clr: 'error' });
          } else {
            setToast({ text: 'Failed to delete invoice', clr: 'error' });
          }
        },
      },
    ]);
  };

  // ─── Filtering ─────────────────────────────────────────────────────────────
  const filtered = data
    .filter(x => typeFilter === 'all' || getInvType(x) === typeFilter)
    .filter(x => selectedMonth === null || parseInt((x.date || '').substring(5, 7), 10) - 1 === selectedMonth)
    .filter(x => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        getName(settings, 'Client', x.client).toLowerCase().includes(q) ||
        String(x.invoice || '').includes(q) ||
        (x.poSupplierOrder || '').toLowerCase().includes(q) ||
        (x.containerNo || '').toLowerCase().includes(q)
      );
    });

  // ─── Summary totals ─────────────────────────────────────────────────────────
  const totalAmount = filtered.reduce((s, x) => s + (Number(x.totalAmount) || 0), 0);

  // ─── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const cols = [
      { key: 'invoiceNum', label: 'Invoice#' },
      { key: 'clientName', label: 'Client' },
      { key: 'date', label: 'Date' },
      { key: 'totalAmount', label: 'Amount' },
      { key: 'status', label: 'Status' },
      { key: 'type', label: 'Type' },
    ];
    const rows = filtered.map(x => {
      const prefix = getInvType(x) === 'cn' ? 'CN' : getInvType(x) === 'fn' ? 'FN' : '';
      return {
        ...x,
        invoiceNum: String(x.invoice || '').padStart(4, '0') + prefix,
        clientName: getName(settings, 'Client', x.client),
        status: getInvStatus(x).label,
        type: prefix || 'Invoice',
      };
    });
    exportToExcel(rows, cols, `invoices_${year}`);
  };

  const handleExportPDF = (item) => {
    const prefix = getInvType(item) === 'cn' ? 'CN' : getInvType(item) === 'fn' ? 'FN' : '';
    const invNum = String(item.invoice || '').padStart(4, '0') + prefix;
    const rows = [{
      invoice: invNum,
      client: getName(settings, 'Client', item.client),
      date: item.date || '',
      amount: formatCurrency(item.totalAmount),
      status: getInvStatus(item).label,
      po: item.poSupplierOrder || '',
      container: item.containerNo || '',
    }];
    const cols = [
      { key: 'invoice', label: 'Invoice#' },
      { key: 'client', label: 'Client' },
      { key: 'date', label: 'Date' },
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status' },
      { key: 'po', label: 'PO#' },
      { key: 'container', label: 'Container' },
    ];
    const html = buildTablePDF(`Invoice #${invNum}`, cols, rows);
    exportToPDF(html, `invoice_${invNum}`);
  };

  const formatDate = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }); }
    catch { return d; }
  };

  // ─── Render card ────────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const { label: statusLabel, color: statusColor } = getInvStatus(item);
    const invTypeKey = getInvType(item);
    const prefix = invTypeKey === 'cn' ? 'CN' : invTypeKey === 'fn' ? 'FN' : '';
    const invNum = String(item.invoice || '').padStart(4, '0') + prefix;
    const clientName = getName(settings, 'Client', item.client);
    const currency = getName(settings, 'Currency', item.cur, 'cur');
    const balanceDue = (parseFloat(item.totalAmount) || 0) - (item.totalPrepayment || 0);
    const typeColor = invTypeKey === 'cn' ? '#7c3aed' : invTypeKey === 'fn' ? '#0891b2' : '#0366ae';

    return (
      <SwipeableRow onDelete={() => handleDelete(item)} disabled={!canDelete}>
      <TouchableOpacity style={styles.card} onPress={() => setDetailItem(item)} activeOpacity={0.85}>
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <View style={styles.invNumRow}>
              <Text style={[styles.rowNum, { color: typeColor }]}>INV# {invNum}</Text>
              {prefix ? (
                <View style={[styles.typeTag, { backgroundColor: typeColor + '18' }]}>
                  <Text style={[styles.typeTagText, { color: typeColor }]}>{prefix}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.rowClient}>{clientName}</Text>
            <Text style={styles.rowDate}>{item.date || ''}</Text>
          </View>
          <View style={styles.topRight}>
            <Text style={styles.rowAmount}>{formatCurrency(item.totalAmount)}</Text>
            <View style={[styles.badge, { backgroundColor: statusColor + '18' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.details}>
          {item.poSupplierOrder ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>PO#</Text>
              <Text style={styles.infoValue}>{item.poSupplierOrder}</Text>
            </View>
          ) : null}
          {item.containerNo ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Container</Text>
              <Text style={styles.infoValue}>{item.containerNo}</Text>
            </View>
          ) : null}
          {(item.etdDate || item.etaDate) ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ETD / ETA</Text>
              <Text style={styles.infoValue}>{formatDate(item.etdDate) || '—'} / {formatDate(item.etaDate) || '—'}</Text>
            </View>
          ) : null}
        </View>
        {item.totalPrepayment > 0 ? (
          <>
            <View style={styles.divider} />
            <View style={styles.financialRow}>
              <View style={styles.finCell}>
                <Text style={styles.finLabel}>Prepaid{item.percentage ? ` (${item.percentage}%)` : ''}</Text>
                <Text style={styles.finValue}>{formatCurrency(item.totalPrepayment)}</Text>
              </View>
              <View style={styles.finCell}>
                <Text style={styles.finLabel}>Balance Due</Text>
                <Text style={[styles.finValue, { color: balanceDue > 0 ? '#dc2626' : '#16a34a' }]}>
                  {formatCurrency(balanceDue)}
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </TouchableOpacity>
      </SwipeableRow>
    );
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Invoices" />
      <YearPicker year={year} setYear={setYear} />

      {/* Type filter tabs */}
      <View style={styles.tabsRow}>
        {TYPE_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, typeFilter === t.key && styles.tabActive]}
            onPress={() => setTypeFilter(t.key)}
          >
            <Text style={[styles.tabText, typeFilter === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Month filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={styles.monthRow}>
        <TouchableOpacity
          style={[styles.monthChip, selectedMonth === null && styles.monthChipActive]}
          onPress={() => setSelectedMonth(null)}
        >
          <Text style={[styles.monthChipText, selectedMonth === null && styles.monthChipTextActive]}>All</Text>
        </TouchableOpacity>
        {MONTHS.map((m, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.monthChip, selectedMonth === i && styles.monthChipActive]}
            onPress={() => setSelectedMonth(selectedMonth === i ? null : i)}
          >
            <Text style={[styles.monthChipText, selectedMonth === i && styles.monthChipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search + Export */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#9fb8d4" />
          <TextInput
            style={styles.searchInput}
            placeholder="Invoice#, client..."
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
        <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={18} color="#0366ae" />
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.count}>{filtered.length} invoices</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0366ae" />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No invoices found" subtitle="Try changing the year or filters" />}
      />

      {/* ─── Invoice Detail Modal ──────────────────────────────────────────── */}
      <Modal visible={!!detailItem} animationType="slide" transparent onRequestClose={() => setDetailItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                INV# {detailItem && (String(detailItem.invoice || '').padStart(4, '0') + (getInvType(detailItem) === 'cn' ? 'CN' : getInvType(detailItem) === 'fn' ? 'FN' : ''))}
              </Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close" size={22} color="#103a7a" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {detailItem && (<>
                <DRow label="Client" value={getName(settings, 'Client', detailItem.client)} />
                <DRow label="Date" value={detailItem.date} />
                <DRow label="Status" value={getInvStatus(detailItem).label} valueColor={getInvStatus(detailItem).color} />
                <DRow label="Amount" value={formatCurrency(detailItem.totalAmount)} />
                <DRow label="Currency" value={getName(settings, 'Currency', detailItem.cur, 'cur')} />
                <DRow label="PO#" value={detailItem.poSupplierOrder} />
                <DRow label="Container" value={detailItem.containerNo} />
                <DRow label="ETD" value={formatDate(detailItem.etdDate)} />
                <DRow label="ETA" value={formatDate(detailItem.etaDate)} />
                <DRow label="Prepayment" value={detailItem.totalPrepayment > 0 ? formatCurrency(detailItem.totalPrepayment) : null} />
                <DRow label="Balance Due" value={detailItem.totalPrepayment > 0 ? formatCurrency((Number(detailItem.totalAmount) || 0) - detailItem.totalPrepayment) : null} />
                {detailItem.remarks ? <DRow label="Remarks" value={detailItem.remarks} /> : null}

                {/* Products */}
                {detailItem.productsDataInvoice?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Products</Text>
                    {detailItem.productsDataInvoice.map((p, i) => (
                      <View key={i} style={styles.productRow}>
                        <Text style={styles.productName}>{p.product || `Product ${i + 1}`}</Text>
                        <Text style={styles.productQty}>{p.qty || p.qnty} MT</Text>
                        {p.price ? <Text style={styles.productPrice}>${p.price}</Text> : null}
                      </View>
                    ))}
                  </View>
                )}

                {/* Payments */}
                {detailItem.payments?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payments</Text>
                    {detailItem.payments.map((pay, i) => (
                      <View key={i} style={styles.paymentRow}>
                        <Text style={styles.paymentDate}>{pay.date || ''}</Text>
                        <Text style={styles.paymentAmount}>{formatCurrency(pay.pmnt)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#f7fbff' }]}
                    onPress={() => handleExportPDF(detailItem)}
                  >
                    <Ionicons name="document-outline" size={16} color="#7c3aed" />
                    <Text style={[styles.actionBtnText, { color: '#7c3aed' }]}>PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#f7fbff' }]}
                    onPress={() => { handleExport(); }}
                  >
                    <Ionicons name="download-outline" size={16} color="#0366ae" />
                    <Text style={[styles.actionBtnText, { color: '#0366ae' }]}>Export</Text>
                  </TouchableOpacity>
                  {canDelete && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#fff5f5' }]}
                      onPress={() => { setDetailItem(null); handleDelete(detailItem); }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>)}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DRow({ label, value, valueColor }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },

  tabsRow: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 6, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#b8ddf8', overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#0366ae' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#0366ae' },
  tabTextActive: { color: '#fff' },

  monthScroll: { marginHorizontal: 12, marginBottom: 6 },
  monthRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  monthChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8ddf8' },
  monthChipActive: { backgroundColor: '#0366ae', borderColor: '#0366ae' },
  monthChipText: { fontSize: 11, fontWeight: '600', color: '#0366ae' },
  monthChipTextActive: { color: '#fff' },

  toolbar: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 4, gap: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 999, paddingHorizontal: 12, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: '#103a7a' },
  iconBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#b8ddf8' },

  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4 },
  count: { fontSize: 11, color: '#9fb8d4' },
  totalAmount: { fontSize: 12, fontWeight: '700', color: '#0366ae' },

  list: { padding: 12, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8', padding: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topLeft: { flex: 1, marginRight: 12 },
  topRight: { alignItems: 'flex-end', gap: 4 },
  invNumRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  rowNum: { fontSize: 13, fontWeight: '700', color: '#0366ae' },
  typeTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeTagText: { fontSize: 9, fontWeight: '800' },
  rowClient: { fontSize: 12, fontWeight: '600', color: '#103a7a', marginBottom: 2 },
  rowDate: { fontSize: 11, color: '#9fb8d4' },
  rowAmount: { fontSize: 13, fontWeight: '700', color: '#103a7a' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f0f4f8', marginVertical: 8 },
  details: { gap: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 10, color: '#9fb8d4', fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 11, color: '#103a7a', fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  financialRow: { flexDirection: 'row', gap: 8 },
  finCell: { flex: 1, backgroundColor: '#f8fbff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#dbeeff' },
  finLabel: { fontSize: 9, color: '#9fb8d4', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  finValue: { fontSize: 12, fontWeight: '700', color: '#103a7a' },
  empty: { textAlign: 'center', color: '#9fb8d4', marginTop: 40, fontSize: 14 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e3f0fb' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#103a7a' },
  modalBody: { padding: 20, gap: 10, paddingBottom: 32 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  detailLabel: { fontSize: 12, color: '#9fb8d4', flex: 1 },
  detailValue: { fontSize: 12, fontWeight: '600', color: '#103a7a', flex: 2, textAlign: 'right' },

  section: { marginTop: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9fb8d4', textTransform: 'uppercase', marginBottom: 6 },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  productName: { fontSize: 12, color: '#103a7a', flex: 2 },
  productQty: { fontSize: 12, fontWeight: '600', color: '#0366ae' },
  productPrice: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  paymentDate: { fontSize: 12, color: '#9fb8d4' },
  paymentAmount: { fontSize: 12, fontWeight: '600', color: '#16a34a' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
});
