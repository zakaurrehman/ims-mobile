import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData, saveDataDoc, deleteDataDoc } from '../../shared/utils/firestore';
import { formatCurrency, getName, safeDate } from '../../shared/utils/helpers';
import { usePermission } from '../../shared/hooks/usePermission';
import { useToast } from '../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../shared/utils/haptics';
import { exportToExcel, exportToPDF, buildTablePDF } from '../../shared/utils/exportUtils';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import AppHeader from '../../components/AppHeader';
import DateRangeFilter from '../../components/DateRangeFilter';
import SwipeableRow from '../../components/SwipeableRow';
import { COLLECTIONS } from '../../constants/collections';
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';
import Animated, { FadeInDown } from 'react-native-reanimated';


const INV_TYPES = [
  { id: '1111', label: 'Invoice' },
  { id: '2222', label: 'Credit Note (CN)' },
  { id: '3333', label: 'Final Note (FN)' },
];

const BLANK = {
  client: '', date: '', cur: '', invoice: '', invType: '1111',
  shpType: '', origin: '', delTerm: '', pol: '', pod: '', packing: '',
  bankNname: '', ttlGross: '', ttlPackages: '',
  remarks: '', comments: '',
};

const getInvType = (item) => {
  if (item.invType === '2222' || item.invType === 'Credit Note') return 'cn';
  if (item.invType === '3333' || item.invType === 'Final Note') return 'fn';
  return 'invoice';
};

const getInvTypeName = (item) => {
  if (item.invType === '2222' || item.invType === 'Credit Note') return 'Credit Note';
  if (item.invType === '3333' || item.invType === 'Final Note') return 'Final Note';
  return 'Invoice';
};

const getInvStatus = (item) => {
  if (item.canceled) return { label: 'Canceled', color: C.danger };
  if (item.final) return { label: 'Final', color: C.success };
  return { label: 'Draft', color: C.warning };
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
  const { canEdit, canDelete } = usePermission();
  const { setToast } = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const _cy = new Date().getFullYear();
  const [dateRange, setDateRange] = useState({ start: `${_cy}-01-01`, end: `${_cy}-12-31` });
  const dateSelect = dateRange;
  const year = dateRange.start?.substring(0, 4) || String(_cy);
  const [typeFilter, setTypeFilter] = useState('all');
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickerState, setPickerState] = useState(null);
  const [showDelayed, setShowDelayed] = useState(false); // I3: delayed response modal

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

  useEffect(() => { fetchData(); }, [uidCollection, dateRange]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ─── I3: Delayed invoices ───────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delayed = data.filter(x => {
    if (x.canceled || x.final) return false;
    const eta = x.shipData?.eta?.endDate || x.etaDate;
    if (!eta) return false;
    return new Date(eta) < today;
  });

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (item) => {
    Alert.alert('Delete Invoice', `Delete INV# ${item.invoice}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const yr = (item.date || '').substring(0, 4) || String(_cy);
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

  // ─── I4: Save invoice ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editItem.client || !editItem.invoice || !editItem.date) {
      Alert.alert('Required', 'Client, Invoice#, and Date are required.');
      return;
    }
    setSaving(true);
    const yr = editItem.date.substring(0, 4) || String(year);
    const id = editItem.id || uuidv4();
    const toSave = { ...editItem, id };
    const ok = await saveDataDoc(uidCollection, COLLECTIONS.INVOICES, yr, id, toSave);
    if (ok) {
      setData(prev => {
        const idx = prev.findIndex(x => x.id === id);
        if (idx >= 0) { const copy = [...prev]; copy[idx] = toSave; return copy; }
        return [...prev, toSave];
      });
      setEditItem(null);
      hapticSuccess();
      setToast({ text: editItem.id ? 'Invoice updated' : 'Invoice added', clr: 'success' });
    } else {
      Alert.alert('Error', 'Failed to save invoice.');
    }
    setSaving(false);
  };

  // ─── Filtering ─────────────────────────────────────────────────────────────
  const filtered = data
    .filter(x => typeFilter === 'all' || getInvType(x) === typeFilter)
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

  // ─── Picker helpers ─────────────────────────────────────────────────────────
  const openPicker = (field, settingsKey, nameField, title) => {
    const arr = settings?.[settingsKey]?.[settingsKey] || [];
    const options = arr.filter(x => !x.deleted).map(x => ({ id: x.id, label: x[nameField] || x.id }));
    setPickerState({ field, options, title });
  };

  const openTypePicker = () => {
    setPickerState({ field: 'invType', options: INV_TYPES, title: 'Invoice Type' });
  };

  const getLabel = (settingsKey, id, nameField = 'nname') =>
    getName(settings, settingsKey, id, nameField) || '';

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

  const daysDiff = (dateStr) => {
    if (!dateStr) return null;
    const diff = Math.floor((today - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // ─── Render card ────────────────────────────────────────────────────────────
  const renderItem = ({ item, index }) => {
    const { label: statusLabel, color: statusColor } = getInvStatus(item);
    const invTypeKey = getInvType(item);
    const prefix = invTypeKey === 'cn' ? 'CN' : invTypeKey === 'fn' ? 'FN' : '';
    const invNum = String(item.invoice || '').padStart(4, '0') + prefix;
    const clientName = getName(settings, 'Client', item.client);
    const balanceDue = (parseFloat(item.totalAmount) || 0) - (item.totalPrepayment || 0);
    const typeColor = invTypeKey === 'cn' ? C.purple : invTypeKey === 'fn' ? C.info : C.accent;

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(280)}>
      <SwipeableRow onDelete={() => handleDelete(item)} disabled={!canDelete}>
      <TouchableOpacity style={styles.card} onPress={() => setDetailItem(item)} activeOpacity={0.85}>
        <View style={[styles.accentBar, { backgroundColor: statusColor }]} />
        <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <View style={styles.invNumRow}>
              <Text style={[styles.rowNum, { color: typeColor }]}>INV# {invNum}</Text>
              {prefix ? (
                <View style={[styles.typeTag, { backgroundColor: typeColor + '22' }]}>
                  <Text style={[styles.typeTagText, { color: typeColor }]}>{prefix}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.rowClient}>{clientName}</Text>
            <Text style={styles.rowDate}>{safeDate(item.date)}</Text>
          </View>
          <View style={styles.topRight}>
            <Text style={styles.rowAmount}>{formatCurrency(item.totalAmount)}</Text>
            <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            {!item.canceled && balanceDue > 0.01 && item.delDate?.endDate && new Date(item.delDate.endDate) < new Date() && (
              <View style={styles.overdueBadge}>
                <Text style={styles.overdueBadgeText}>Overdue</Text>
              </View>
            )}
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
                <Text style={[styles.finValue, { color: balanceDue > 0 ? C.danger : C.success }]}>
                  {formatCurrency(balanceDue)}
                </Text>
              </View>
            </View>
          </>
        ) : null}
        </View>
      </TouchableOpacity>
      </SwipeableRow>

      </Animated.View>
    );
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Invoices" />
      <DateRangeFilter
        onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
        initialYear={_cy}
      />

      {/* I3: Delayed Response Alert banner */}
      {delayed.length > 0 && (
        <TouchableOpacity style={styles.delayedBanner} onPress={() => setShowDelayed(true)}>
          <Ionicons name="warning-outline" size={14} color={C.danger} />
          <Text style={styles.delayedBannerText}>
            {delayed.length} delayed invoice{delayed.length !== 1 ? 's' : ''} — ETA overdue
          </Text>
          <Ionicons name="chevron-forward" size={14} color={C.danger} />
        </TouchableOpacity>
      )}

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

      {/* Search + Export + Add */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.text2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Invoice#, client..."
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
        <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={18} color={C.text2} />
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.count}>{filtered.length} invoices</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) + (canEdit ? 80 : 0) }]}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No invoices found" subtitle="Try changing the year or filters" />}
      />

      {canEdit && (
        <TouchableOpacity
          style={[styles.fab, { bottom: getBottomPad(insets) + 16 }]}
          onPress={() => setEditItem({ ...BLANK, date: `${year}-01-01` })}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color={C.text1} />
        </TouchableOpacity>
      )}

      {/* ─── I1+I2: Invoice Detail Modal ─────────────────────────────────────── */}
      <Modal visible={!!detailItem} animationType="slide" transparent onRequestClose={() => setDetailItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                INV# {detailItem && (String(detailItem.invoice || '').padStart(4, '0') + (getInvType(detailItem) === 'cn' ? 'CN' : getInvType(detailItem) === 'fn' ? 'FN' : ''))}
              </Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {detailItem && (<>
                {/* I2: Invoice Type display */}
                <DRow label="Type" value={getInvTypeName(detailItem)} />
                <DRow label="Client" value={getName(settings, 'Client', detailItem.client)} />
                {/* I1: Client address */}
                {(() => {
                  const cl = settings?.Client?.Client?.find(c => c.id === detailItem.client);
                  if (!cl) return null;
                  const addr = [cl.street, cl.city, cl.country].filter(Boolean).join(', ');
                  return addr ? <DRow label="Address" value={addr} /> : null;
                })()}
                <DRow label="Date" value={safeDate(detailItem.date)} />
                <DRow label="Status" value={getInvStatus(detailItem).label} valueColor={getInvStatus(detailItem).color} />
                <DRow label="Amount" value={formatCurrency(detailItem.totalAmount)} />
                <DRow label="Currency" value={getName(settings, 'Currency', detailItem.cur, 'cur')} />
                {/* I1: Bank Account */}
                <DRow label="Bank Account" value={getName(settings, 'Bank Account', detailItem.bankNname, 'bankNname')} />
                <DRow label="Shipment" value={getName(settings, 'Shipment', detailItem.shpType, 'shpType')} />
                <DRow label="Origin" value={getName(settings, 'Origin', detailItem.origin, 'origin')} />
                <DRow label="POL" value={getName(settings, 'POL', detailItem.pol, 'pol')} />
                <DRow label="POD" value={getName(settings, 'POD', detailItem.pod, 'pod')} />
                <DRow label="Packing" value={getName(settings, 'Packing', detailItem.packing, 'packing')} />
                <DRow label="Del. Terms" value={getName(settings, 'Delivery Terms', detailItem.delTerm, 'delTerm')} />
                {/* I1: Delivery Date */}
                <DRow label="Del. Date" value={formatDate(detailItem.delDate?.endDate || detailItem.delDate)} />
                <DRow label="PO#" value={detailItem.poSupplierOrder} />
                <DRow label="Container" value={detailItem.containerNo} />
                <DRow label="ETD" value={formatDate(detailItem.etdDate)} />
                <DRow label="ETA" value={formatDate(detailItem.etaDate)} />
                {/* I1: Gross WT + Packages */}
                {detailItem.ttlGross ? <DRow label="Gross WT (kg)" value={String(detailItem.ttlGross)} /> : null}
                {detailItem.ttlPackages ? <DRow label="Packages" value={String(detailItem.ttlPackages)} /> : null}
                <DRow label="Prepayment" value={detailItem.totalPrepayment > 0 ? formatCurrency(detailItem.totalPrepayment) : null} />
                <DRow label="Balance Due" value={detailItem.totalPrepayment > 0 ? formatCurrency((Number(detailItem.totalAmount) || 0) - detailItem.totalPrepayment) : null} />
                {detailItem.remarks ? <DRow label="Remarks" value={detailItem.remarks} /> : null}
                {/* I1: Comments */}
                {detailItem.comments ? <DRow label="Comments" value={detailItem.comments} /> : null}

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
                        <Text style={styles.paymentDate}>{safeDate(pay.date)}</Text>
                        <Text style={styles.paymentAmount}>{formatCurrency(pay.pmnt)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.actionRow}>
                  {canEdit && !detailItem.final && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: C.bgTertiary }]}
                      onPress={() => { setDetailItem(null); setEditItem({ ...detailItem }); }}
                    >
                      <Ionicons name="pencil-outline" size={16} color={C.accent} />
                      <Text style={[styles.actionBtnText, { color: C.accent }]}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: C.bgSecondary }]}
                    onPress={() => handleExportPDF(detailItem)}
                  >
                    <Ionicons name="document-outline" size={16} color={C.purple} />
                    <Text style={[styles.actionBtnText, { color: C.purple }]}>PDF</Text>
                  </TouchableOpacity>
                  {canDelete && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: C.dangerSoft }]}
                      onPress={() => { setDetailItem(null); handleDelete(detailItem); }}
                    >
                      <Ionicons name="trash-outline" size={16} color={C.danger} />
                      <Text style={[styles.actionBtnText, { color: C.danger }]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>)}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── I3: Delayed Response Modal ──────────────────────────────────────── */}
      <Modal visible={showDelayed} animationType="slide" transparent onRequestClose={() => setShowDelayed(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Delayed Invoices</Text>
                <Text style={styles.modalSubtitle}>{delayed.length} invoice{delayed.length !== 1 ? 's' : ''} past ETA</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDelayed(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={[styles.modalBody, { gap: 0, padding: 0 }]}>
              {delayed.map((inv) => {
                const etaDays = daysDiff(inv.shipData?.eta?.endDate || inv.etaDate);
                const etdDays = daysDiff(inv.shipData?.etd?.endDate || inv.etdDate);
                const prefix = getInvType(inv) === 'cn' ? 'CN' : getInvType(inv) === 'fn' ? 'FN' : '';
                return (
                  <View key={inv.id} style={styles.delayedRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.delayedInvNo}>INV# {String(inv.invoice || '').padStart(4, '0')}{prefix}</Text>
                      <Text style={styles.delayedClient}>{getName(settings, 'Client', inv.client)}</Text>
                    </View>
                    <View style={styles.delayedDates}>
                      <Text style={styles.delayedDateLabel}>ETA</Text>
                      <Text style={styles.delayedDateVal}>{formatDate(inv.shipData?.eta?.endDate || inv.etaDate)}</Text>
                      {etaDays != null && etaDays > 0 && (
                        <Text style={styles.delayedDelta}>+{etaDays}d</Text>
                      )}
                    </View>
                    <View style={styles.delayedDates}>
                      <Text style={styles.delayedDateLabel}>ETD</Text>
                      <Text style={styles.delayedDateVal}>{formatDate(inv.shipData?.etd?.endDate || inv.etdDate) || '—'}</Text>
                      {etdDays != null && etdDays > 0 && (
                        <Text style={styles.delayedDelta}>+{etdDays}d</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── I4: Add/Edit Invoice Modal ───────────────────────────────────────── */}
      <Modal visible={!!editItem} animationType="slide" transparent onRequestClose={() => setEditItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editItem?.id ? 'Edit Invoice' : 'New Invoice'}</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {editItem && (<>
                <FormField label="Invoice #" value={String(editItem.invoice || '')}
                  onChangeText={v => setEditItem(p => ({ ...p, invoice: v }))} />
                <FormField label="Date (YYYY-MM-DD)" value={editItem.date}
                  onChangeText={v => setEditItem(p => ({ ...p, date: v }))} />

                {/* I2: Invoice Type picker */}
                <PickerField
                  label="Invoice Type"
                  value={INV_TYPES.find(t => t.id === editItem.invType)?.label || 'Invoice'}
                  onPress={openTypePicker}
                />

                <PickerField label="Client *" value={getLabel('Client', editItem.client)}
                  onPress={() => openPicker('client', 'Client', 'nname', 'Select Client')} />
                <PickerField label="Currency" value={getLabel('Currency', editItem.cur, 'cur')}
                  onPress={() => openPicker('cur', 'Currency', 'cur', 'Select Currency')} />
                <PickerField label="Shipment" value={getLabel('Shipment', editItem.shpType, 'shpType')}
                  onPress={() => openPicker('shpType', 'Shipment', 'shpType', 'Select Shipment')} />
                <PickerField label="Origin" value={getLabel('Origin', editItem.origin, 'origin')}
                  onPress={() => openPicker('origin', 'Origin', 'origin', 'Select Origin')} />
                <PickerField label="Delivery Terms" value={getLabel('Delivery Terms', editItem.delTerm, 'delTerm')}
                  onPress={() => openPicker('delTerm', 'Delivery Terms', 'delTerm', 'Select Delivery Terms')} />
                <PickerField label="POL" value={getLabel('POL', editItem.pol, 'pol')}
                  onPress={() => openPicker('pol', 'POL', 'pol', 'Select POL')} />
                <PickerField label="POD" value={getLabel('POD', editItem.pod, 'pod')}
                  onPress={() => openPicker('pod', 'POD', 'pod', 'Select POD')} />
                <PickerField label="Packing" value={getLabel('Packing', editItem.packing, 'packing')}
                  onPress={() => openPicker('packing', 'Packing', 'packing', 'Select Packing')} />
                <PickerField label="Bank Account" value={getLabel('Bank Account', editItem.bankNname, 'bankNname')}
                  onPress={() => openPicker('bankNname', 'Bank Account', 'bankNname', 'Select Bank Account')} />

                <FormField label="Gross WT (kg)" value={String(editItem.ttlGross || '')}
                  onChangeText={v => setEditItem(p => ({ ...p, ttlGross: v }))} />
                <FormField label="Packages" value={String(editItem.ttlPackages || '')}
                  onChangeText={v => setEditItem(p => ({ ...p, ttlPackages: v }))} />
                <FormField label="Remarks" value={editItem.remarks || ''}
                  onChangeText={v => setEditItem(p => ({ ...p, remarks: v }))} multiline />
                <FormField label="Comments" value={editItem.comments || ''}
                  onChangeText={v => setEditItem(p => ({ ...p, comments: v }))} multiline />

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color={C.text1} size="small" />
                    : <Text style={styles.saveBtnText}>{editItem?.id ? 'Update' : 'Add Invoice'}</Text>}
                </TouchableOpacity>
              </>)}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Picker Modal ─────────────────────────────────────────────────── */}
      <Modal visible={!!pickerState} animationType="slide" transparent onRequestClose={() => setPickerState(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerState?.title}</Text>
              <TouchableOpacity onPress={() => setPickerState(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerState?.options || []}
              keyExtractor={(item, i) => item.id || String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    setEditItem(p => ({ ...p, [pickerState.field]: item.id }));
                    setPickerState(null);
                  }}
                >
                  <Text style={styles.pickerItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DRow({ label, value, valueColor }) {
  if (!value) return null;
  const safe = typeof value === 'object' ? (value.id || value.rmrk || '') : value;
  if (!safe) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor && { color: valueColor }]}>{safe}</Text>
    </View>
  );
}

function FormField({ label, value, onChangeText, multiline }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, multiline && styles.formInputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={C.text3}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

function PickerField({ label, value, onPress }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={onPress}>
        <Text style={[styles.pickerBtnText, !value && { color: C.text3 }]}>
          {value || `Select ${label}`}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C.text2} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },

  // I3: Delayed banner
  delayedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 12, marginBottom: 6,
    backgroundColor: C.dangerDim, borderRadius: 10,
    borderWidth: 1, borderColor: C.danger,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  delayedBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: C.danger },

  tabsRow: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 6, backgroundColor: C.bg2, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { backgroundColor: C.accent },
  tabText: { fontSize: 12, fontWeight: '600', color: C.accent },
  tabTextActive: { color: C.text1 },

  toolbar: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 4, gap: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: C.text1 },
  iconBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: C.bgTertiary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },

  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4 },
  count: { fontSize: 11, color: C.text2 },
  totalAmount: { fontSize: 12, fontWeight: '700', color: C.accent },

  list: { padding: 12, gap: 10 },
  card: { backgroundColor: C.bg1, borderRadius: 14, borderWidth: 1, borderColor: C.border, flexDirection: 'row', overflow: 'hidden' },
  accentBar: { width: 3 },
  cardContent: { flex: 1, padding: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topLeft: { flex: 1, marginRight: 12 },
  topRight: { alignItems: 'flex-end', gap: 4 },
  invNumRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  rowNum: { fontSize: 13, fontWeight: '700', color: C.accent },
  typeTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeTagText: { fontSize: 9, fontWeight: '800' },
  rowClient: { fontSize: 12, fontWeight: '600', color: C.text1, marginBottom: 2 },
  rowDate: { fontSize: 11, color: C.text2 },
  rowAmount: { fontSize: 13, fontWeight: '700', color: C.text1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  overdueBadge: { backgroundColor: C.dangerDim, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  overdueBadgeText: { fontSize: 10, fontWeight: '700', color: C.danger },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  details: { gap: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 10, color: C.text2, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 11, color: C.text1, fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  financialRow: { flexDirection: 'row', gap: 8 },
  finCell: { flex: 1, backgroundColor: C.bg2, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.border },
  finLabel: { fontSize: 9, color: C.text2, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  finValue: { fontSize: 12, fontWeight: '700', color: C.text1 },

  // Modal
  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.accent, shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  handle: { width: 36, height: 4, backgroundColor: C.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: C.bg1, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.text1 },
  modalSubtitle: { fontSize: 11, color: C.danger, marginTop: 2 },
  modalBody: { padding: 20, gap: 10, paddingBottom: 32 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  detailLabel: { fontSize: 12, color: C.text2, flex: 1 },
  detailValue: { fontSize: 12, fontWeight: '600', color: C.text1, flex: 2, textAlign: 'right' },

  section: { marginTop: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', marginBottom: 6 },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  productName: { fontSize: 12, color: C.text1, flex: 2 },
  productQty: { fontSize: 12, fontWeight: '600', color: C.accent },
  productPrice: { fontSize: 12, fontWeight: '600', color: C.success },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  paymentDate: { fontSize: 12, color: C.text2 },
  paymentAmount: { fontSize: 12, fontWeight: '600', color: C.success },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  // I3: Delayed modal rows
  delayedRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  delayedInvNo: { fontSize: 12, fontWeight: '700', color: C.text1 },
  delayedClient: { fontSize: 11, color: C.text2, marginTop: 1 },
  delayedDates: { flex: 1, alignItems: 'center' },
  delayedDateLabel: { fontSize: 9, color: C.text2, fontWeight: '700', textTransform: 'uppercase' },
  delayedDateVal: { fontSize: 11, color: C.text1, fontWeight: '600' },
  delayedDelta: { fontSize: 10, fontWeight: '700', color: C.danger },

  // I4: Edit form
  formField: { gap: 4 },
  formLabel: { fontSize: 11, fontWeight: '700', color: C.text1, textTransform: 'uppercase' },
  formInput: { backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text1 },
  formInputMulti: { height: 80, textAlignVertical: 'top' },
  pickerBtn: { backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerBtnText: { fontSize: 14, color: C.text1 },
  pickerItem: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerItemText: { fontSize: 14, color: C.text1 },
  saveBtn: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: C.text1, fontSize: 15, fontWeight: '700' },
});
