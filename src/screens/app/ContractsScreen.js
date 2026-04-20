import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../shared/firebase';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData, saveDataDoc, deleteDataDoc } from '../../shared/utils/firestore';
import { getName, safeDate } from '../../shared/utils/helpers';
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


const BLANK = {
  supplier: '', originSupplier: '', showOriginSupplier: false,
  client: '', order: '', date: '', cur: '', qTypeTable: '',
  shpType: '', delTerm: '', termPmnt: '', pol: '', pod: '', origin: '',
  packing: '', contType: '', size: '', deltime: '',
  remarks: '', comments: '', completed: false,
  productsData: [], invoices: [], expenses: [], stock: [], poInvoices: [],
};

export default function ContractsScreen() {
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
  const [statusFilter, setStatusFilter] = useState('all'); // 'all'|'open'|'completed'

  // Modals
  const [detailItem, setDetailItem] = useState(null);
  const [detailTab, setDetailTab] = useState('info'); // 'info' | 'invoices' | 'pnl'
  const [linkedInvoices, setLinkedInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickerState, setPickerState] = useState(null);

  // C8: Remarks sub-modal
  const [remarksModal, setRemarksModal] = useState(false);
  const [remarksEdit, setRemarksEdit] = useState(null); // {id, rmrk} being edited
  const [remarkInput, setRemarkInput] = useState('');

  // C4: Price Remarks sub-modal
  const [priceRemarksModal, setPriceRemarksModal] = useState(false);
  const [priceRemarksEdit, setPriceRemarksEdit] = useState(null);
  const [priceRemarkInput, setPriceRemarkInput] = useState('');

  // C5: Products sub-modal
  const [productsModal, setProductsModal] = useState(false);
  const [productsData, setProductsData] = useState([]);

  // C7: PO/Invoice sub-modal
  const [poInvModal, setPoInvModal] = useState(false);
  const [poInvoices, setPoInvoices] = useState([]);

  // C3: Final Settlement sub-modal
  const [finalModal, setFinalModal] = useState(false);
  const [finalData, setFinalData] = useState([]);
  const [loadingFinal, setLoadingFinal] = useState(false);

  // C9: Delayed contracts alert
  const [showDelayed, setShowDelayed] = useState(false);

  // C5/C7: row editing state
  const [productsEditIdx, setProductsEditIdx] = useState(null);
  const [productsEditRow, setProductsEditRow] = useState({ description: '', qnty: '', unitPrc: '' });
  const [poInvEditIdx, setPoInvEditIdx] = useState(null);
  const [poInvEditRow, setPoInvEditRow] = useState({ inv: '', invValue: '', pmnt: '', pmntDate: '' });

  const fetchData = async () => {
    if (!uidCollection) return;
    try {
      setError(null);
      const rows = await loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect);
      setData(rows);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load contracts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [uidCollection, dateRange]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };
  const delayed = data.filter(x => x.alert === true);

  // ─── Filtering ─────────────────────────────────────────────────────────────
  const filtered = data
    .filter(x => {
      if (statusFilter === 'open') return !x.completed;
      if (statusFilter === 'completed') return !!x.completed;
      return true;
    })
    .filter(x => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        getName(settings, 'Supplier', x.supplier).toLowerCase().includes(q) ||
        (x.order || '').toLowerCase().includes(q) ||
        getName(settings, 'POL', x.pol, 'pol').toLowerCase().includes(q) ||
        getName(settings, 'POD', x.pod, 'pod').toLowerCase().includes(q)
      );
    });

  // ─── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const cols = [
      { key: 'order', label: 'PO#' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'date', label: 'Date' },
      { key: 'pol', label: 'POL' },
      { key: 'pod', label: 'POD' },
      { key: 'completed', label: 'Status' },
    ];
    const rows = filtered.map(x => ({
      ...x,
      supplierName: getName(settings, 'Supplier', x.supplier),
      pol: getName(settings, 'POL', x.pol, 'pol'),
      pod: getName(settings, 'POD', x.pod, 'pod'),
      completed: x.completed ? 'Completed' : 'Open',
    }));
    exportToExcel(rows, cols, `contracts_${year}`);
  };

  const handleExportPDF = (item) => {
    const rows = [{
      order: item.order || '—',
      supplier: getName(settings, 'Supplier', item.supplier),
      date: item.date || '',
      pol: getName(settings, 'POL', item.pol, 'pol'),
      pod: getName(settings, 'POD', item.pod, 'pod'),
      status: item.completed ? 'Completed' : 'Open',
      remarks: item.remarks || '',
    }];
    const cols = [
      { key: 'order', label: 'PO#' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'date', label: 'Date' },
      { key: 'pol', label: 'POL' },
      { key: 'pod', label: 'POD' },
      { key: 'status', label: 'Status' },
      { key: 'remarks', label: 'Remarks' },
    ];
    const html = buildTablePDF(`Contract PO# ${item.order || ''}`, cols, rows);
    exportToPDF(html, `contract_${item.order || item.id}`);
  };

  // ─── Save contract ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editItem.supplier || !editItem.order || !editItem.date) {
      Alert.alert('Required', 'Supplier, PO#, and Date are required.');
      return;
    }
    setSaving(true);
    const yr = editItem.date.substring(0, 4) || String(year);
    const id = editItem.id || uuidv4();
    const toSave = { ...editItem, id };
    const ok = await saveDataDoc(uidCollection, COLLECTIONS.CONTRACTS, yr, id, toSave);
    if (ok) {
      setData(prev => {
        const idx = prev.findIndex(x => x.id === id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = toSave;
          return copy;
        }
        return [...prev, toSave];
      });
      setEditItem(null);
      hapticSuccess();
      setToast({ text: editItem.id ? 'Contract updated' : 'Contract added', clr: 'success' });
    } else {
      Alert.alert('Error', 'Failed to save contract.');
    }
    setSaving(false);
  };

  // ─── Toggle complete ────────────────────────────────────────────────────────
  const toggleComplete = async (item) => {
    const updated = { ...item, completed: !item.completed };
    const yr = item.date?.substring(0, 4) || String(year);
    const ok = await saveDataDoc(uidCollection, COLLECTIONS.CONTRACTS, yr, item.id, updated);
    if (ok) {
      setData(prev => prev.map(x => x.id === item.id ? updated : x));
      setDetailItem(updated);
    }
  };

  // ─── Delete contract ───────────────────────────────────────────────────────
  const handleDelete = (item) => {
    Alert.alert('Delete Contract', `Delete PO# ${item.order}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const yr = item.date?.substring(0, 4) || String(year);
          const ok = await deleteDataDoc(uidCollection, COLLECTIONS.CONTRACTS, yr, item.id);
          if (ok) {
            setData(prev => prev.filter(x => x.id !== item.id));
            setDetailItem(null);
            hapticWarning();
            setToast({ text: 'Contract deleted', clr: 'error' });
          } else {
            Alert.alert('Error', 'Failed to delete contract.');
          }
        },
      },
    ]);
  };

  // ─── Picker helpers ─────────────────────────────────────────────────────────
  const openPicker = (field, settingsKey, nameField, title) => {
    const arr = settings?.[settingsKey]?.[settingsKey] || [];
    const options = arr.filter(x => !x.deleted).map(x => ({ id: x.id, label: x[nameField] || x.id }));
    setPickerState({ field, options, title });
  };

  const getLabel = (settingsKey, id, nameField = 'nname') =>
    getName(settings, settingsKey, id, nameField) || '';

  // ─── C3–C9 Sub-modal helpers ────────────────────────────────────────────────
  const saveSubField = async (field, value) => {
    if (!detailItem) return false;
    const yr = detailItem.date?.substring(0, 4) || String(year);
    const updated = { ...detailItem, [field]: value };
    const ok = await saveDataDoc(uidCollection, COLLECTIONS.CONTRACTS, yr, detailItem.id, updated);
    if (ok) {
      setData(prev => prev.map(x => x.id === detailItem.id ? updated : x));
      setDetailItem(updated);
      hapticSuccess();
      setToast({ text: 'Saved', clr: 'success' });
    } else {
      hapticWarning();
      setToast({ text: 'Save failed', clr: 'error' });
    }
    return ok;
  };

  // C8: Remarks
  const openRemarksModal = () => { setRemarksEdit(null); setRemarkInput(''); setRemarksModal(true); };
  const saveRemark = async () => {
    if (!remarkInput.trim()) return;
    const arr = Array.isArray(detailItem?.remarks) ? [...detailItem.remarks] : [];
    if (remarksEdit) {
      const idx = arr.findIndex(r => r.id === remarksEdit.id);
      if (idx >= 0) arr[idx] = { ...arr[idx], rmrk: remarkInput.trim() };
    } else {
      arr.push({ id: uuidv4(), rmrk: remarkInput.trim() });
    }
    const ok = await saveSubField('remarks', arr);
    if (ok) { setRemarksEdit(null); setRemarkInput(''); }
  };
  const deleteRemark = async (id) => {
    const arr = (Array.isArray(detailItem?.remarks) ? detailItem.remarks : []).filter(r => r.id !== id);
    await saveSubField('remarks', arr);
  };

  // C4: Price Remarks
  const openPriceRemarksModal = () => { setPriceRemarksEdit(null); setPriceRemarkInput(''); setPriceRemarksModal(true); };
  const savePriceRemark = async () => {
    if (!priceRemarkInput.trim()) return;
    const arr = Array.isArray(detailItem?.priceRemarks) ? [...detailItem.priceRemarks] : [];
    if (priceRemarksEdit) {
      const idx = arr.findIndex(r => r.id === priceRemarksEdit.id);
      if (idx >= 0) arr[idx] = { ...arr[idx], rmrk: priceRemarkInput.trim() };
    } else {
      arr.push({ id: uuidv4(), rmrk: priceRemarkInput.trim() });
    }
    const ok = await saveSubField('priceRemarks', arr);
    if (ok) { setPriceRemarksEdit(null); setPriceRemarkInput(''); }
  };
  const deletePriceRemark = async (id) => {
    const arr = (Array.isArray(detailItem?.priceRemarks) ? detailItem.priceRemarks : []).filter(r => r.id !== id);
    await saveSubField('priceRemarks', arr);
  };

  // C5: Products
  const openProductsModal = () => {
    setProductsData(Array.isArray(detailItem?.productsData) ? [...detailItem.productsData] : []);
    setProductsEditIdx(null);
    setProductsModal(true);
  };
  const saveProducts = async () => {
    const ok = await saveSubField('productsData', productsData);
    if (ok) setProductsModal(false);
  };

  // C7: PO/Invoices
  const openPoInvModal = () => {
    setPoInvoices(Array.isArray(detailItem?.poInvoices) ? [...detailItem.poInvoices] : []);
    setPoInvEditIdx(null);
    setPoInvModal(true);
  };
  const savePoInvoices = async () => {
    const ok = await saveSubField('poInvoices', poInvoices);
    if (ok) setPoInvModal(false);
  };

  // C3: Final Settlement — load stock docs by ID from Firestore
  const openFinalModal = async () => {
    setFinalData([]);
    setFinalModal(true);
    setLoadingFinal(true);
    const stockIds = Array.isArray(detailItem?.stock) ? detailItem.stock : [];
    if (!stockIds.length) { setLoadingFinal(false); return; }
    try {
      const yr = detailItem.date?.substring(0, 4) || String(year);
      const results = [];
      for (const id of stockIds) {
        try {
          const snap = await getDoc(doc(db, uidCollection, 'data', `stocks_${yr}`, id));
          if (snap.exists()) {
            const d = snap.data();
            results.push({ id: snap.id, ...d, _finalqnty: d.finalqnty || '', _unitPrcFinal: d.unitPrcFinal || '', _remark: d.remark || '' });
          }
        } catch { /* skip missing */ }
      }
      setFinalData(results);
    } finally {
      setLoadingFinal(false);
    }
  };
  const saveFinalSettlement = async () => {
    const yr = detailItem.date?.substring(0, 4) || String(year);
    let allOk = true;
    for (const item of finalData) {
      try {
        await updateDoc(doc(db, uidCollection, 'data', `stocks_${yr}`, item.id), {
          finalqnty: item._finalqnty,
          unitPrcFinal: item._unitPrcFinal,
          remark: item._remark,
        });
      } catch { allOk = false; }
    }
    if (allOk) {
      hapticSuccess();
      setToast({ text: 'Final settlement saved', clr: 'success' });
      setFinalModal(false);
    } else {
      hapticWarning();
      setToast({ text: 'Some saves failed', clr: 'error' });
    }
  };

  // ─── C10: Load invoices linked to a contract ────────────────────────────────
  // Mirrors web pnl.js — uses contract.invoices refs: [{ date, invoice }]
  const loadLinkedInvoices = useCallback(async (contract) => {
    if (!uidCollection || !contract) return;
    const refs = Array.isArray(contract.invoices) ? contract.invoices : [];
    if (!refs.length) { setLinkedInvoices([]); return; }
    setLoadingInvoices(true);
    try {
      const results = [];
      const seen = new Set();
      for (const r of refs) {
        if (!r || typeof r !== 'object') continue;
        const yr = (r.date || '').substring(0, 4);
        const invId = r.invoice || r.id;
        if (!yr || !invId || seen.has(invId)) continue;
        seen.add(invId);
        try {
          const snap = await getDoc(doc(db, uidCollection, 'data', `invoices_${yr}`, invId));
          if (snap.exists()) results.push({ id: snap.id, ...snap.data() });
        } catch { /* skip missing docs */ }
      }
      setLinkedInvoices(results);
    } catch (e) {
      console.error('loadLinkedInvoices', e);
    } finally {
      setLoadingInvoices(false);
    }
  }, [uidCollection]);

  // ─── getTotalQty ────────────────────────────────────────────────────────────
  const getTotalQty = (item) => {
    if (!Array.isArray(item.productsData) || !item.productsData.length) return null;
    const total = item.productsData.reduce((s, p) => s + (parseFloat(p.qnty) || 0), 0);
    const unit = getName(settings, 'Quantity', item.qTypeTable, 'qTypeTable') || 'MT';
    return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 1 }).format(total)} ${unit}`;
  };

  // ─── Render contract card ───────────────────────────────────────────────────
  const InfoChip = ({ label, value }) => {
    if (!value || value === label) return null;
    return (
      <View style={styles.chip}>
        <Text style={styles.chipLabel}>{label}</Text>
        <Text style={styles.chipValue}>{value}</Text>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    const pol = getName(settings, 'POL', item.pol, 'pol');
    const pod = getName(settings, 'POD', item.pod, 'pod');
    const packing = getName(settings, 'Packing', item.packing, 'packing');
    const contType = getName(settings, 'Container Type', item.contType, 'contType');
    const size = getName(settings, 'Size', item.size, 'size');
    const delTerm = getName(settings, 'Delivery Terms', item.delTerm, 'delTerm');
    const currency = getName(settings, 'Currency', item.cur, 'cur');
    const origin = getName(settings, 'Origin', item.origin, 'origin');
    const shipment = getName(settings, 'Shipment', item.shpType, 'shpType');
    const qty = getTotalQty(item);
    const route = pol && pod ? `${pol} → ${pod}` : pol || pod || null;
    const container = [contType, size].filter(Boolean).join(' / ') || null;

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(280)}>
      <SwipeableRow onDelete={() => handleDelete(item)} disabled={!canDelete}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => { setDetailItem(item); setDetailTab('info'); setLinkedInvoices([]); }}
        activeOpacity={0.85}
      >
        <View style={[styles.accentBar, { backgroundColor: item.completed ? C.success : C.accent }]} />
        <View style={styles.cardContent}>
          <View style={styles.topRow}>
            <View style={styles.topLeft}>
              <Text style={styles.rowNum}>PO# {item.order || '—'}</Text>
              <Text style={styles.rowSupplier}>{getName(settings, 'Supplier', item.supplier)}</Text>
              <Text style={styles.rowDate}>{safeDate(item.date)}</Text>
            </View>
            <View style={styles.topRight}>
              {qty ? <Text style={styles.qty}>{qty}</Text> : null}
              <View style={[styles.badge, item.completed ? styles.badgeClosed : styles.badgeOpen]}>
                <Text style={[styles.badgeText, item.completed && { color: C.success }]}>
                  {item.completed ? 'Completed' : 'Open'}
                </Text>
              </View>
              {!item.invoices?.length && (
                <View style={styles.noSalesBadge}>
                  <Text style={styles.noSalesBadgeText}>No Sales</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.chips}>
            {route ? <InfoChip label="Route" value={route} /> : null}
            {packing ? <InfoChip label="Packing" value={packing} /> : null}
            {container ? <InfoChip label="Container" value={container} /> : null}
            {origin ? <InfoChip label="Origin" value={origin} /> : null}
            {shipment ? <InfoChip label="Shipment" value={shipment} /> : null}
            {delTerm ? <InfoChip label="Del. Terms" value={delTerm} /> : null}
            {currency ? <InfoChip label="Currency" value={currency} /> : null}
          </View>
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
      <AppHeader title="Contracts" />
      <DateRangeFilter
        onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
        initialYear={_cy}
      />

      {/* C9: Delayed contracts banner */}
      {delayed.length > 0 && (
        <TouchableOpacity style={styles.delayedBanner} onPress={() => setShowDelayed(true)}>
          <Ionicons name="warning-outline" size={16} color={C.warning} />
          <Text style={styles.delayedBannerText}>Delayed contracts</Text>
          <Text style={styles.delayedBannerCount}>{delayed.length}</Text>
          <Ionicons name="chevron-forward" size={14} color={C.warning} />
        </TouchableOpacity>
      )}

      {/* Status filter tabs */}
      <View style={styles.tabsRow}>
        {['all', 'open', 'completed'].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, statusFilter === s && styles.tabActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.tabText, statusFilter === s && styles.tabTextActive]}>
              {s === 'all' ? 'All' : s === 'open' ? 'Open' : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search + Export + Add */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.text2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Supplier or PO#..."
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

      <Text style={styles.count}>{filtered.length} contracts</Text>

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
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No contracts found" subtitle="Try changing the year or filters" />}
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

      {/* ─── Detail Modal (C10: 3 tabs — Info / Invoices / P&L) ──────────── */}
      <Modal
        visible={!!detailItem}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailItem(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>PO# {detailItem?.order || '—'}</Text>
                {/* C11: opDate + lstSaved */}
                {(detailItem?.opDate || detailItem?.lstSaved) ? (
                  <Text style={styles.modalMeta}>
                    {detailItem.opDate ? `Created: ${detailItem.opDate}` : ''}
                    {detailItem.opDate && detailItem.lstSaved ? '  ·  ' : ''}
                    {detailItem.lstSaved ? `Saved: ${detailItem.lstSaved}` : ''}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>

            {/* Tab bar */}
            <View style={styles.detailTabRow}>
              {[
                { key: 'info',     label: 'Contract' },
                { key: 'invoices', label: `Invoices${detailItem?.invoices?.length ? ` (${detailItem.invoices.length})` : ''}` },
                { key: 'pnl',      label: 'P&L' },
              ].map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.detailTab, detailTab === t.key && styles.detailTabActive]}
                  onPress={() => {
                    setDetailTab(t.key);
                    if (t.key === 'invoices' && !linkedInvoices.length && !loadingInvoices) {
                      loadLinkedInvoices(detailItem);
                    }
                    if (t.key === 'pnl' && !linkedInvoices.length && !loadingInvoices) {
                      loadLinkedInvoices(detailItem);
                    }
                  }}
                >
                  <Text style={[styles.detailTabText, detailTab === t.key && styles.detailTabTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tab content */}
            {detailItem && (
              <ScrollView contentContainerStyle={styles.modalBody}>

                {/* ── TAB 1: Contract Info ─────────────────────────────── */}
                {detailTab === 'info' && (<>
                  <DetailRow label="Supplier" value={getName(settings, 'Supplier', detailItem.supplier)} />
                  {detailItem.originSupplier ? <DetailRow label="Orig. Supplier" value={getName(settings, 'Supplier', detailItem.originSupplier)} /> : null}
                  <DetailRow label="Date" value={safeDate(detailItem.date)} />
                  <DetailRow label="Status" value={detailItem.completed ? 'Completed' : 'Open'} valueColor={detailItem.completed ? C.success : C.warning} />
                  <DetailRow label="Currency" value={getName(settings, 'Currency', detailItem.cur, 'cur')} />
                  <DetailRow label="Shipment" value={getName(settings, 'Shipment', detailItem.shpType, 'shpType')} />
                  <DetailRow label="POL" value={getName(settings, 'POL', detailItem.pol, 'pol')} />
                  <DetailRow label="POD" value={getName(settings, 'POD', detailItem.pod, 'pod')} />
                  <DetailRow label="Origin" value={getName(settings, 'Origin', detailItem.origin, 'origin')} />
                  <DetailRow label="Packing" value={getName(settings, 'Packing', detailItem.packing, 'packing')} />
                  <DetailRow label="Container Type" value={getName(settings, 'Container Type', detailItem.contType, 'contType')} />
                  <DetailRow label="Size" value={getName(settings, 'Size', detailItem.size, 'size')} />
                  <DetailRow label="Del. Terms" value={getName(settings, 'Delivery Terms', detailItem.delTerm, 'delTerm')} />
                  <DetailRow label="Del. Time" value={getName(settings, 'Delivery Time', detailItem.deltime, 'deltime')} />
                  <DetailRow label="Payment Terms" value={getName(settings, 'Payment Terms', detailItem.termPmnt, 'termPmnt')} />
                  <DetailRow label="Qty Type" value={getName(settings, 'Quantity', detailItem.qTypeTable, 'qTypeTable')} />

                  {/* Remarks — C8: handle as array or plain string */}
                  {Array.isArray(detailItem.remarks) ? (
                    detailItem.remarks.length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Remarks</Text>
                        {detailItem.remarks.map((r, i) => (
                          <Text key={r.id || i} style={styles.linkedItem}>• {r.rmrk || r}</Text>
                        ))}
                      </View>
                    )
                  ) : detailItem.remarks ? (
                    <DetailRow label="Remarks" value={detailItem.remarks} />
                  ) : null}

                  {detailItem.comments ? <DetailRow label="Comments" value={detailItem.comments} /> : null}

                  {/* Products */}
                  {detailItem.productsData?.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Products</Text>
                      {detailItem.productsData.map((p, i) => (
                        <View key={i} style={styles.productRow}>
                          <Text style={styles.productName} numberOfLines={1}>{p.description || p.product || `Product ${i + 1}`}</Text>
                          <Text style={styles.productQty}>{p.qnty} {getName(settings, 'Quantity', p.qTypeTable, 'qTypeTable') || 'MT'}</Text>
                          {p.price ? <Text style={styles.productPrice}>${p.price}/MT</Text> : null}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: detailItem.completed ? '#fef2f2' : '#f0fdf4' }]}
                      onPress={() => toggleComplete(detailItem)}
                    >
                      <Ionicons name={detailItem.completed ? 'refresh-outline' : 'checkmark-circle-outline'} size={16} color={detailItem.completed ? C.danger : C.success} />
                      <Text style={[styles.actionBtnText, { color: detailItem.completed ? C.danger : C.success }]}>
                        {detailItem.completed ? 'Reopen' : 'Complete'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: C.bgTertiary }]}
                      onPress={() => { setDetailItem(null); setEditItem({ ...detailItem }); }}
                    >
                      <Ionicons name="pencil-outline" size={16} color={C.accent} />
                      <Text style={[styles.actionBtnText, { color: C.accent }]}>{canEdit ? 'Edit' : 'View'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: C.bgSecondary }]}
                      onPress={() => handleExportPDF(detailItem)}
                    >
                      <Ionicons name="document-outline" size={16} color={C.purple} />
                      <Text style={[styles.actionBtnText, { color: C.purple }]}>PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: C.dangerDim, opacity: canDelete ? 1 : 0.4 }]}
                      onPress={() => canDelete && handleDelete(detailItem)}
                    >
                      <Ionicons name="trash-outline" size={16} color={C.danger} />
                      <Text style={[styles.actionBtnText, { color: C.danger }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>

                  {/* C4/C5/C7/C8/C3 sub-modal buttons */}
                  <View style={styles.subActionRow}>
                    <TouchableOpacity style={styles.subActionBtn} onPress={openRemarksModal}>
                      <Ionicons name="chatbubble-outline" size={13} color={C.accent} />
                      <Text style={styles.subActionBtnText}>Remarks</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.subActionBtn} onPress={openPriceRemarksModal}>
                      <Ionicons name="pricetag-outline" size={13} color={C.accent} />
                      <Text style={styles.subActionBtnText}>Price Rmks</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.subActionBtn} onPress={openProductsModal}>
                      <Ionicons name="layers-outline" size={13} color={C.accent} />
                      <Text style={styles.subActionBtnText}>Products</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.subActionBtn} onPress={openPoInvModal}>
                      <Ionicons name="receipt-outline" size={13} color={C.accent} />
                      <Text style={styles.subActionBtnText}>PO/Inv</Text>
                    </TouchableOpacity>
                    {detailItem?.stock?.length > 0 && (
                      <TouchableOpacity style={styles.subActionBtn} onPress={openFinalModal}>
                        <Ionicons name="checkmark-done-outline" size={13} color={C.success} />
                        <Text style={[styles.subActionBtnText, { color: C.success }]}>Final Stl.</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>)}

                {/* ── TAB 2: Linked Invoices ───────────────────────────── */}
                {detailTab === 'invoices' && (
                  loadingInvoices
                    ? <ActivityIndicator color={C.accent} style={{ marginTop: 32 }} />
                    : linkedInvoices.length === 0
                      ? <Text style={styles.emptyTabText}>No linked invoices found</Text>
                      : linkedInvoices.map((inv) => {
                          const cur = getName(settings, 'Currency', inv.cur, 'cur') || inv.cur || 'USD';
                          const fmtAmt = (v) => v != null
                            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(Number(v))
                            : '—';
                          const statusColor = inv.canceled ? C.danger : inv.final ? C.success : C.warning;
                          const statusLabel = inv.canceled ? 'Canceled' : inv.final ? 'Final' : 'Open';
                          // C1: Payments summary
                          const payments = Array.isArray(inv.payments) ? inv.payments : [];
                          const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.pmnt) || 0), 0);
                          return (
                            <View key={inv.id} style={styles.invCard}>
                              <View style={styles.invCardTop}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.invNo}>{inv.invoiceNo || inv.invoice || inv.id}</Text>
                                  <Text style={styles.invDate}>{safeDate(inv.date)}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={styles.invAmt}>{fmtAmt(inv.totalAmount)}</Text>
                                  <View style={[styles.invBadge, { backgroundColor: statusColor + '18' }]}>
                                    <Text style={[styles.invBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                                  </View>
                                </View>
                              </View>
                              {/* C1: Payments */}
                              {payments.length > 0 && (
                                <View style={styles.paymentsRow}>
                                  <Ionicons name="card-outline" size={12} color={C.text2} />
                                  <Text style={styles.paymentsText}>
                                    {payments.length} payment{payments.length !== 1 ? 's' : ''} · {fmtAmt(totalPaid)} paid
                                  </Text>
                                </View>
                              )}
                              {inv.client ? (
                                <Text style={styles.invClient}>{getName(settings, 'Client', inv.client)}</Text>
                              ) : null}
                            </View>
                          );
                        })
                )}

                {/* ── TAB 3: P&L ──────────────────────────────────────── */}
                {detailTab === 'pnl' && (() => {
                  if (loadingInvoices) return <ActivityIndicator color={C.accent} style={{ marginTop: 32 }} />;
                  // Purchase value = sum of poInvoices[].pmnt
                  const poInvoices = Array.isArray(detailItem.poInvoices) ? detailItem.poInvoices : [];
                  const purchase = poInvoices.reduce((s, p) => s + (parseFloat(p.pmnt) || 0), 0);
                  // Revenue = sum of non-canceled linked invoice totalAmounts
                  const revenue = linkedInvoices
                    .filter(inv => !inv.canceled)
                    .reduce((s, inv) => s + (parseFloat(inv.totalAmount) || 0), 0);
                  // Expenses = sum of all expenses on linked invoices
                  const expenses = linkedInvoices.reduce((s, inv) => {
                    const expArr = Array.isArray(inv.expenses) ? inv.expenses : [];
                    return s + expArr.reduce((es, e) => es + (parseFloat(e.amount) || 0), 0);
                  }, 0);
                  const pnl = revenue - purchase - expenses;
                  const cur = getName(settings, 'Currency', detailItem.cur, 'cur') || 'USD';
                  const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(v);
                  const pnlColor = pnl >= 0 ? C.success : C.danger;
                  return (
                    <View>
                      <Text style={styles.pnlTitle}>Contract P&L — {cur}</Text>
                      <PnlRow label="Revenue (Invoices)" value={fmt(revenue)} color={C.text1} />
                      <PnlRow label="Purchase Cost" value={`− ${fmt(purchase)}`} color={C.danger} />
                      <PnlRow label="Expenses" value={`− ${fmt(expenses)}`} color={C.warning} />
                      <View style={styles.pnlDivider} />
                      <PnlRow label="Net P&L" value={fmt(pnl)} color={pnlColor} bold />
                      {linkedInvoices.length === 0 && (
                        <Text style={styles.emptyTabText}>Load Invoices tab first to see full P&L</Text>
                      )}
                    </View>
                  );
                })()}

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── Add/Edit Modal ───────────────────────────────────────────────── */}
      <Modal visible={!!editItem} animationType="slide" transparent onRequestClose={() => setEditItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editItem?.id ? 'Edit Contract' : 'New Contract'}</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {editItem && (<>
                <FormField label="PO#" value={editItem.order}
                  onChangeText={v => setEditItem(p => ({ ...p, order: v }))} />
                <FormField label="Date (YYYY-MM-DD)" value={editItem.date}
                  onChangeText={v => setEditItem(p => ({ ...p, date: v }))} />

                <PickerField label="Supplier *" value={getLabel('Supplier', editItem.supplier)}
                  onPress={() => openPicker('supplier', 'Supplier', 'nname', 'Select Supplier')} />
                <PickerField label="Original Supplier" value={getLabel('Supplier', editItem.originSupplier)}
                  onPress={() => openPicker('originSupplier', 'Supplier', 'nname', 'Select Original Supplier')} />
                <PickerField label="Client" value={getLabel('Client', editItem.client)}
                  onPress={() => openPicker('client', 'Client', 'nname', 'Select Client')} />
                <PickerField label="Currency" value={getLabel('Currency', editItem.cur, 'cur')}
                  onPress={() => openPicker('cur', 'Currency', 'cur', 'Select Currency')} />
                <PickerField label="Quantity Type" value={getLabel('Quantity', editItem.qTypeTable, 'qTypeTable')}
                  onPress={() => openPicker('qTypeTable', 'Quantity', 'qTypeTable', 'Select Quantity Type')} />
                <PickerField label="Shipment Type" value={getLabel('Shipment', editItem.shpType, 'shpType')}
                  onPress={() => openPicker('shpType', 'Shipment', 'shpType', 'Select Shipment Type')} />
                <PickerField label="Delivery Terms" value={getLabel('Delivery Terms', editItem.delTerm, 'delTerm')}
                  onPress={() => openPicker('delTerm', 'Delivery Terms', 'delTerm', 'Select Delivery Terms')} />
                <PickerField label="POL" value={getLabel('POL', editItem.pol, 'pol')}
                  onPress={() => openPicker('pol', 'POL', 'pol', 'Select POL')} />
                <PickerField label="POD" value={getLabel('POD', editItem.pod, 'pod')}
                  onPress={() => openPicker('pod', 'POD', 'pod', 'Select POD')} />
                <PickerField label="Origin" value={getLabel('Origin', editItem.origin, 'origin')}
                  onPress={() => openPicker('origin', 'Origin', 'origin', 'Select Origin')} />
                <PickerField label="Packing" value={getLabel('Packing', editItem.packing, 'packing')}
                  onPress={() => openPicker('packing', 'Packing', 'packing', 'Select Packing')} />
                <PickerField label="Container Type" value={getLabel('Container Type', editItem.contType, 'contType')}
                  onPress={() => openPicker('contType', 'Container Type', 'contType', 'Select Container Type')} />
                <PickerField label="Size" value={getLabel('Size', editItem.size, 'size')}
                  onPress={() => openPicker('size', 'Size', 'size', 'Select Size')} />
                <PickerField label="Delivery Time" value={getLabel('Delivery Time', editItem.deltime, 'deltime')}
                  onPress={() => openPicker('deltime', 'Delivery Time', 'deltime', 'Select Delivery Time')} />
                <PickerField label="Payment Terms" value={getLabel('Payment Terms', editItem.termPmnt, 'termPmnt')}
                  onPress={() => openPicker('termPmnt', 'Payment Terms', 'termPmnt', 'Select Payment Terms')} />

                <FormField label="Remarks" value={editItem.remarks || ''}
                  onChangeText={v => setEditItem(p => ({ ...p, remarks: v }))}
                  multiline />
                <FormField label="Comments" value={editItem.comments || ''}
                  onChangeText={v => setEditItem(p => ({ ...p, comments: v }))}
                  multiline />

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color={C.text1} size="small" />
                    : <Text style={styles.saveBtnText}>{editItem?.id ? 'Update' : 'Add Contract'}</Text>}
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
              style={{ marginHorizontal: 0 }}
            />
          </View>
        </View>
      </Modal>

      {/* ─── C9: Delayed Contracts Modal ──────────────────────────────────── */}
      <Modal visible={showDelayed} animationType="slide" transparent onRequestClose={() => setShowDelayed(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delayed Contracts ({delayed.length})</Text>
              <TouchableOpacity onPress={() => setShowDelayed(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {delayed.length === 0
                ? <Text style={styles.emptyTabText}>No delayed contracts</Text>
                : delayed.map(c => {
                    const daysDiff = c.date ? Math.floor((Date.now() - new Date(c.date)) / 86400000) : 0;
                    return (
                      <View key={c.id} style={styles.delayedRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.delayedPo}>PO# {c.order || '—'}</Text>
                          <Text style={styles.delayedSupplier}>{getName(settings, 'Supplier', c.supplier)}</Text>
                          <Text style={styles.delayedDate}>{safeDate(c.date)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <View style={styles.delayedBadge}>
                            <Text style={styles.delayedBadgeText}>+{daysDiff}d</Text>
                          </View>
                          {canEdit && (
                            <TouchableOpacity
                              style={styles.dismissBtn}
                              onPress={async () => {
                                const yr = c.date?.substring(0, 4) || String(year);
                                const updated = { ...c, alert: false };
                                const ok = await saveDataDoc(uidCollection, COLLECTIONS.CONTRACTS, yr, c.id, updated);
                                if (ok) {
                                  setData(prev => prev.map(x => x.id === c.id ? updated : x));
                                  hapticSuccess();
                                  setToast({ text: 'Alert dismissed', clr: 'success' });
                                }
                              }}
                            >
                              <Text style={styles.dismissBtnText}>Dismiss</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── C8: Remarks Sub-modal ────────────────────────────────────────── */}
      <Modal visible={remarksModal} animationType="slide" transparent onRequestClose={() => setRemarksModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Remarks — PO# {detailItem?.order}</Text>
              <TouchableOpacity onPress={() => setRemarksModal(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {(Array.isArray(detailItem?.remarks) ? detailItem.remarks : []).map(r => (
                <View key={r.id} style={styles.remarkRow}>
                  {remarksEdit?.id === r.id ? (
                    <TextInput style={[styles.formInput, { flex: 1 }]} value={remarkInput}
                      onChangeText={setRemarkInput} autoFocus multiline />
                  ) : (
                    <Text style={styles.remarkText}>{r.rmrk}</Text>
                  )}
                  <View style={styles.remarkActions}>
                    {remarksEdit?.id === r.id ? (
                      <TouchableOpacity onPress={saveRemark} style={styles.remarkSaveBtn}>
                        <Ionicons name="checkmark" size={16} color={C.text1} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => { setRemarksEdit(r); setRemarkInput(r.rmrk); }}>
                        <Ionicons name="pencil-outline" size={16} color={C.accent} />
                      </TouchableOpacity>
                    )}
                    {canEdit && (
                      <TouchableOpacity onPress={() => deleteRemark(r.id)}>
                        <Ionicons name="trash-outline" size={16} color={C.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {canEdit && !remarksEdit && (
                <View style={styles.remarkRow}>
                  <TextInput style={[styles.formInput, { flex: 1 }]} value={remarkInput}
                    onChangeText={setRemarkInput} placeholder="Add remark…" placeholderTextColor={C.text3} multiline />
                  <TouchableOpacity onPress={saveRemark} style={[styles.remarkSaveBtn, !remarkInput.trim() && { opacity: 0.4 }]}
                    disabled={!remarkInput.trim()}>
                    <Ionicons name="add" size={16} color={C.text1} />
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── C4: Price Remarks Sub-modal ──────────────────────────────────── */}
      <Modal visible={priceRemarksModal} animationType="slide" transparent onRequestClose={() => setPriceRemarksModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Price Remarks — PO# {detailItem?.order}</Text>
              <TouchableOpacity onPress={() => setPriceRemarksModal(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {(Array.isArray(detailItem?.priceRemarks) ? detailItem.priceRemarks : []).map(r => (
                <View key={r.id} style={styles.remarkRow}>
                  {priceRemarksEdit?.id === r.id ? (
                    <TextInput style={[styles.formInput, { flex: 1 }]} value={priceRemarkInput}
                      onChangeText={setPriceRemarkInput} autoFocus multiline />
                  ) : (
                    <Text style={styles.remarkText}>{r.rmrk}</Text>
                  )}
                  <View style={styles.remarkActions}>
                    {priceRemarksEdit?.id === r.id ? (
                      <TouchableOpacity onPress={savePriceRemark} style={styles.remarkSaveBtn}>
                        <Ionicons name="checkmark" size={16} color={C.text1} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => { setPriceRemarksEdit(r); setPriceRemarkInput(r.rmrk); }}>
                        <Ionicons name="pencil-outline" size={16} color={C.accent} />
                      </TouchableOpacity>
                    )}
                    {canEdit && (
                      <TouchableOpacity onPress={() => deletePriceRemark(r.id)}>
                        <Ionicons name="trash-outline" size={16} color={C.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {canEdit && !priceRemarksEdit && (
                <View style={styles.remarkRow}>
                  <TextInput style={[styles.formInput, { flex: 1 }]} value={priceRemarkInput}
                    onChangeText={setPriceRemarkInput} placeholder="Add price remark…" placeholderTextColor={C.text3} multiline />
                  <TouchableOpacity onPress={savePriceRemark} style={[styles.remarkSaveBtn, !priceRemarkInput.trim() && { opacity: 0.4 }]}
                    disabled={!priceRemarkInput.trim()}>
                    <Ionicons name="add" size={16} color={C.text1} />
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── C5: Products Sub-modal ───────────────────────────────────────── */}
      <Modal visible={productsModal} animationType="slide" transparent onRequestClose={() => setProductsModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Products — PO# {detailItem?.order}</Text>
              <TouchableOpacity onPress={() => setProductsModal(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.prodTableHeader}>
                <Text style={[styles.prodHeaderCell, { flex: 3 }]}>Description</Text>
                <Text style={[styles.prodHeaderCell, { flex: 1.2 }]}>Qty</Text>
                <Text style={[styles.prodHeaderCell, { flex: 1.2 }]}>Price</Text>
                <Text style={[styles.prodHeaderCell, { width: 48 }]}></Text>
              </View>
              {productsData.map((p, i) => (
                <View key={p.id || i} style={styles.prodTableRow}>
                  {productsEditIdx === i ? (<>
                    <TextInput style={[styles.prodInput, { flex: 3 }]} value={productsEditRow.description}
                      onChangeText={v => setProductsEditRow(r => ({ ...r, description: v }))} placeholder="Description" placeholderTextColor={C.text3} autoFocus />
                    <TextInput style={[styles.prodInput, { flex: 1.2 }]} value={productsEditRow.qnty}
                      onChangeText={v => setProductsEditRow(r => ({ ...r, qnty: v }))} keyboardType="numeric" placeholder="Qty" placeholderTextColor={C.text3} />
                    <TextInput style={[styles.prodInput, { flex: 1.2 }]} value={productsEditRow.unitPrc}
                      onChangeText={v => setProductsEditRow(r => ({ ...r, unitPrc: v }))} keyboardType="numeric" placeholder="Price" placeholderTextColor={C.text3} />
                    <TouchableOpacity style={[styles.remarkSaveBtn, { width: 32 }]} onPress={() => {
                      const updated = [...productsData];
                      updated[i] = { ...updated[i], ...productsEditRow };
                      setProductsData(updated);
                      setProductsEditIdx(null);
                    }}>
                      <Ionicons name="checkmark" size={14} color={C.text1} />
                    </TouchableOpacity>
                  </>) : (<>
                    <Text style={[styles.prodCell, { flex: 3 }]} numberOfLines={1}>{p.description || '—'}</Text>
                    <Text style={[styles.prodCell, { flex: 1.2 }]}>{p.qnty || '—'}</Text>
                    <Text style={[styles.prodCell, { flex: 1.2 }]}>{p.unitPrc || '—'}</Text>
                    <View style={{ width: 48, flexDirection: 'row', gap: 6 }}>
                      {canEdit && <>
                        <TouchableOpacity onPress={() => { setProductsEditRow({ description: p.description || '', qnty: p.qnty || '', unitPrc: p.unitPrc || '' }); setProductsEditIdx(i); }}>
                          <Ionicons name="pencil-outline" size={14} color={C.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setProductsData(d => d.filter((_, j) => j !== i))}>
                          <Ionicons name="trash-outline" size={14} color={C.danger} />
                        </TouchableOpacity>
                      </>}
                    </View>
                  </>)}
                </View>
              ))}
              {canEdit && productsEditIdx === -1 ? (
                <View style={styles.prodTableRow}>
                  <TextInput style={[styles.prodInput, { flex: 3 }]} value={productsEditRow.description}
                    onChangeText={v => setProductsEditRow(r => ({ ...r, description: v }))} placeholder="Description" placeholderTextColor={C.text3} autoFocus />
                  <TextInput style={[styles.prodInput, { flex: 1.2 }]} value={productsEditRow.qnty}
                    onChangeText={v => setProductsEditRow(r => ({ ...r, qnty: v }))} keyboardType="numeric" placeholder="Qty" placeholderTextColor={C.text3} />
                  <TextInput style={[styles.prodInput, { flex: 1.2 }]} value={productsEditRow.unitPrc}
                    onChangeText={v => setProductsEditRow(r => ({ ...r, unitPrc: v }))} keyboardType="numeric" placeholder="Price" placeholderTextColor={C.text3} />
                  <TouchableOpacity style={[styles.remarkSaveBtn, { width: 32 }]} onPress={() => {
                    setProductsData(d => [...d, { id: uuidv4(), ...productsEditRow }]);
                    setProductsEditRow({ description: '', qnty: '', unitPrc: '' });
                    setProductsEditIdx(null);
                  }}>
                    <Ionicons name="checkmark" size={14} color={C.text1} />
                  </TouchableOpacity>
                </View>
              ) : canEdit ? (
                <TouchableOpacity style={styles.addRowBtn} onPress={() => { setProductsEditRow({ description: '', qnty: '', unitPrc: '' }); setProductsEditIdx(-1); }}>
                  <Ionicons name="add-circle-outline" size={16} color={C.accent} />
                  <Text style={styles.addRowBtnText}>Add Product</Text>
                </TouchableOpacity>
              ) : null}
              {canEdit && (
                <TouchableOpacity style={styles.saveBtn} onPress={saveProducts}>
                  <Text style={styles.saveBtnText}>Save Products</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── C7: PO/Invoice Sub-modal ─────────────────────────────────────── */}
      <Modal visible={poInvModal} animationType="slide" transparent onRequestClose={() => setPoInvModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>PO Invoices — PO# {detailItem?.order}</Text>
              <TouchableOpacity onPress={() => setPoInvModal(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {poInvoices.map((p, i) => (
                <View key={p.id || i} style={styles.poInvRow}>
                  {poInvEditIdx === i ? (
                    <View style={{ gap: 6 }}>
                      <TextInput style={styles.formInput} value={poInvEditRow.inv} onChangeText={v => setPoInvEditRow(r => ({ ...r, inv: v }))} placeholder="Invoice #" placeholderTextColor={C.text3} autoFocus />
                      <TextInput style={styles.formInput} value={poInvEditRow.invValue} onChangeText={v => setPoInvEditRow(r => ({ ...r, invValue: v }))} placeholder="Invoice Value" placeholderTextColor={C.text3} keyboardType="numeric" />
                      <TextInput style={styles.formInput} value={poInvEditRow.pmnt} onChangeText={v => setPoInvEditRow(r => ({ ...r, pmnt: v }))} placeholder="Payment Amount" placeholderTextColor={C.text3} keyboardType="numeric" />
                      <TextInput style={styles.formInput} value={poInvEditRow.pmntDate} onChangeText={v => setPoInvEditRow(r => ({ ...r, pmntDate: v }))} placeholder="Payment Date (YYYY-MM-DD)" placeholderTextColor={C.text3} />
                      <TouchableOpacity style={styles.saveBtn} onPress={() => {
                        const updated = [...poInvoices];
                        updated[i] = { ...updated[i], ...poInvEditRow };
                        setPoInvoices(updated);
                        setPoInvEditIdx(null);
                      }}>
                        <Text style={styles.saveBtnText}>Save Row</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.poInvNo}>{p.inv || '—'}</Text>
                        <Text style={styles.poInvDetail}>Value: {p.invValue || '—'}  ·  Paid: {p.pmnt || '—'}</Text>
                        {p.pmntDate ? <Text style={styles.poInvDetail}>Date: {p.pmntDate}</Text> : null}
                      </View>
                      {canEdit && (
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <TouchableOpacity onPress={() => { setPoInvEditRow({ inv: p.inv || '', invValue: p.invValue || '', pmnt: p.pmnt || '', pmntDate: p.pmntDate || '' }); setPoInvEditIdx(i); }}>
                            <Ionicons name="pencil-outline" size={16} color={C.accent} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setPoInvoices(d => d.filter((_, j) => j !== i))}>
                            <Ionicons name="trash-outline" size={16} color={C.danger} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))}
              {canEdit && poInvEditIdx === -1 ? (
                <View style={{ gap: 6 }}>
                  <TextInput style={styles.formInput} value={poInvEditRow.inv} onChangeText={v => setPoInvEditRow(r => ({ ...r, inv: v }))} placeholder="Invoice #" placeholderTextColor={C.text3} autoFocus />
                  <TextInput style={styles.formInput} value={poInvEditRow.invValue} onChangeText={v => setPoInvEditRow(r => ({ ...r, invValue: v }))} placeholder="Invoice Value" placeholderTextColor={C.text3} keyboardType="numeric" />
                  <TextInput style={styles.formInput} value={poInvEditRow.pmnt} onChangeText={v => setPoInvEditRow(r => ({ ...r, pmnt: v }))} placeholder="Payment Amount" placeholderTextColor={C.text3} keyboardType="numeric" />
                  <TextInput style={styles.formInput} value={poInvEditRow.pmntDate} onChangeText={v => setPoInvEditRow(r => ({ ...r, pmntDate: v }))} placeholder="Payment Date (YYYY-MM-DD)" placeholderTextColor={C.text3} />
                  <TouchableOpacity style={styles.saveBtn} onPress={() => {
                    setPoInvoices(d => [...d, { id: uuidv4(), ...poInvEditRow }]);
                    setPoInvEditRow({ inv: '', invValue: '', pmnt: '', pmntDate: '' });
                    setPoInvEditIdx(null);
                  }}>
                    <Text style={styles.saveBtnText}>Add Row</Text>
                  </TouchableOpacity>
                </View>
              ) : canEdit ? (
                <TouchableOpacity style={styles.addRowBtn} onPress={() => { setPoInvEditRow({ inv: '', invValue: '', pmnt: '', pmntDate: '' }); setPoInvEditIdx(-1); }}>
                  <Ionicons name="add-circle-outline" size={16} color={C.accent} />
                  <Text style={styles.addRowBtnText}>Add PO Invoice</Text>
                </TouchableOpacity>
              ) : null}
              {canEdit && (
                <TouchableOpacity style={styles.saveBtn} onPress={savePoInvoices}>
                  <Text style={styles.saveBtnText}>Save PO Invoices</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── C3: Final Settlement Sub-modal ───────────────────────────────── */}
      <Modal visible={finalModal} animationType="slide" transparent onRequestClose={() => setFinalModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Final Settlement — PO# {detailItem?.order}</Text>
              <TouchableOpacity onPress={() => setFinalModal(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            {loadingFinal
              ? <ActivityIndicator color={C.accent} style={{ margin: 32 }} />
              : (
                <ScrollView contentContainerStyle={styles.modalBody}>
                  {finalData.length === 0
                    ? <Text style={styles.emptyTabText}>No stock entries linked to this contract</Text>
                    : finalData.map((item, i) => {
                        const total = (parseFloat(item._finalqnty) || 0) * (parseFloat(item._unitPrcFinal) || 0);
                        return (
                          <View key={item.id} style={styles.finalRow}>
                            <Text style={styles.finalDesc}>{item.description || item.nname || `Stock ${i + 1}`}</Text>
                            <View style={styles.finalFields}>
                              <View style={styles.finalFieldPair}>
                                <Text style={styles.finalFieldLabel}>Qty (Advised)</Text>
                                <Text style={styles.finalFieldValue}>{item.qnty || '—'}</Text>
                              </View>
                              <View style={styles.finalFieldPair}>
                                <Text style={styles.finalFieldLabel}>Final Qty</Text>
                                <TextInput style={styles.finalInput} value={item._finalqnty}
                                  onChangeText={v => setFinalData(d => d.map((x, j) => j === i ? { ...x, _finalqnty: v } : x))}
                                  keyboardType="numeric" placeholder="0" placeholderTextColor={C.text3} editable={canEdit} />
                              </View>
                              <View style={styles.finalFieldPair}>
                                <Text style={styles.finalFieldLabel}>Advised Price</Text>
                                <Text style={styles.finalFieldValue}>{item.unitPrc || '—'}</Text>
                              </View>
                              <View style={styles.finalFieldPair}>
                                <Text style={styles.finalFieldLabel}>Received Price</Text>
                                <TextInput style={styles.finalInput} value={item._unitPrcFinal}
                                  onChangeText={v => setFinalData(d => d.map((x, j) => j === i ? { ...x, _unitPrcFinal: v } : x))}
                                  keyboardType="numeric" placeholder="0" placeholderTextColor={C.text3} editable={canEdit} />
                              </View>
                              <View style={styles.finalFieldPair}>
                                <Text style={styles.finalFieldLabel}>Total</Text>
                                <Text style={[styles.finalFieldValue, { color: C.accent }]}>
                                  {total > 0 ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(total) : '—'}
                                </Text>
                              </View>
                              <View style={styles.finalFieldPair}>
                                <Text style={styles.finalFieldLabel}>Remark</Text>
                                <TextInput style={[styles.finalInput, { flex: 2 }]} value={item._remark}
                                  onChangeText={v => setFinalData(d => d.map((x, j) => j === i ? { ...x, _remark: v } : x))}
                                  placeholder="Remark" placeholderTextColor={C.text3} editable={canEdit} />
                              </View>
                            </View>
                          </View>
                        );
                      })}
                  {canEdit && (
                    <TouchableOpacity style={styles.saveBtn} onPress={saveFinalSettlement}>
                      <Text style={styles.saveBtnText}>Save Final Settlement</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Helper components ──────────────────────────────────────────────────────
function DetailRow({ label, value, valueColor }) {
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

function PnlRow({ label, value, color, bold }) {
  return (
    <View style={styles.pnlRow}>
      <Text style={[styles.pnlLabel, bold && { fontWeight: '700', fontSize: 14 }]}>{label}</Text>
      <Text style={[styles.pnlValue, { color }, bold && { fontWeight: '700', fontSize: 14 }]}>{value}</Text>
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

  tabsRow: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 6, backgroundColor: C.bg2, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { backgroundColor: C.accent },
  tabText: { fontSize: 12, fontWeight: '600', color: C.text2 },
  tabTextActive: { color: C.text1 },

  monthScroll: { marginHorizontal: 12, marginBottom: 6, flexGrow: 0 },
  monthRow: { flexDirection: 'row', gap: 6, paddingVertical: 2, alignItems: 'center' },
  monthChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border },
  monthChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  monthChipText: { fontSize: 11, fontWeight: '600', color: C.text2 },
  monthChipTextActive: { color: C.text1 },

  toolbar: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 4, gap: 8 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border,
    borderRadius: 999, paddingHorizontal: 12, height: 38,
  },
  searchInput: { flex: 1, fontSize: 13, color: C.text1 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 999,
    backgroundColor: C.bgTertiary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  count: { paddingHorizontal: 16, fontSize: 11, color: C.text2, marginBottom: 4 },
  list: { padding: 12, gap: 10 },
  card: { backgroundColor: C.bg1, borderRadius: 14, borderWidth: 1, borderColor: C.border, flexDirection: 'row', overflow: 'hidden' },
  accentBar: { width: 3 },
  cardContent: { flex: 1, padding: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topLeft: { flex: 1, marginRight: 12 },
  topRight: { alignItems: 'flex-end', gap: 6 },
  rowNum: { fontSize: 13, fontWeight: '700', color: C.accent, marginBottom: 2 },
  rowSupplier: { fontSize: 12, fontWeight: '600', color: C.text1, marginBottom: 2 },
  rowDate: { fontSize: 11, color: C.text2 },
  qty: { fontSize: 11, fontWeight: '600', color: C.accent },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeOpen: { backgroundColor: C.bg3 },
  badgeClosed: { backgroundColor: C.successDim },
  badgeText: { fontSize: 10, fontWeight: '700', color: C.text2 },
  noSalesBadge: { backgroundColor: C.warningDim, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  noSalesBadgeText: { fontSize: 10, fontWeight: '700', color: C.warning },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bg0, borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingHorizontal: 8, paddingVertical: 3 },
  chipLabel: { fontSize: 9, color: C.text3, fontWeight: '600', textTransform: 'uppercase' },
  chipValue: { fontSize: 10, color: C.text1, fontWeight: '600' },
  empty: { textAlign: 'center', color: C.text2, marginTop: 40, fontSize: 14 },

  // Modals
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
  modalBody: { padding: 20, gap: 10, paddingBottom: 32 },

  // Detail modal
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  detailLabel: { fontSize: 12, color: C.text2, flex: 1 },
  detailValue: { fontSize: 12, fontWeight: '600', color: C.text1, flex: 2, textAlign: 'right' },

  section: { marginTop: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', marginBottom: 6 },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  productName: { fontSize: 12, color: C.text1, flex: 2 },
  productQty: { fontSize: 12, fontWeight: '600', color: C.accent },
  productPrice: { fontSize: 12, fontWeight: '600', color: C.success },
  linkedItem: { fontSize: 12, color: C.accent, paddingVertical: 2 },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  // Edit form
  formField: { gap: 4 },
  formLabel: { fontSize: 11, fontWeight: '700', color: C.text1, textTransform: 'uppercase' },
  formInput: { backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text1 },
  formInputMulti: { height: 80, textAlignVertical: 'top' },
  pickerBtn: { backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerBtnText: { fontSize: 14, color: C.text1 },

  // Picker list
  pickerItem: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerItemText: { fontSize: 14, color: C.text1 },

  saveBtn: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: C.text1, fontSize: 15, fontWeight: '700' },

  // C11: modal meta (opDate / lstSaved)
  modalMeta: { fontSize: 11, color: C.text2, marginTop: 2 },

  // C10: detail tab bar
  detailTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e3f0fb', backgroundColor: C.bgSecondary },
  detailTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  detailTabActive: { borderBottomWidth: 2, borderBottomColor: C.accent },
  detailTabText: { fontSize: 12, fontWeight: '600', color: C.text2 },
  detailTabTextActive: { color: C.accent },

  // Invoice cards (Invoices tab)
  invCard: { backgroundColor: C.bgSecondary, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8 },
  invCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  invNo: { fontSize: 13, fontWeight: '700', color: C.text1 },
  invDate: { fontSize: 11, color: C.text2, marginTop: 2 },
  invAmt: { fontSize: 13, fontWeight: '700', color: C.accent },
  invBadge: { marginTop: 4, alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  invBadgeText: { fontSize: 10, fontWeight: '700' },
  paymentsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  paymentsText: { fontSize: 11, color: C.text2 },
  invClient: { fontSize: 11, color: C.accent, marginTop: 4 },

  // Empty tab
  emptyTabText: { textAlign: 'center', color: C.text2, fontSize: 13, marginTop: 32, marginBottom: 16 },

  // P&L tab
  pnlTitle: { fontSize: 13, fontWeight: '700', color: C.text1, textAlign: 'center', marginBottom: 16, marginTop: 4 },
  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  pnlLabel: { fontSize: 13, color: C.text1 },
  pnlValue: { fontSize: 13, fontWeight: '600' },
  pnlDivider: { height: 2, backgroundColor: C.border, marginVertical: 8 },

  // C9: Delayed banner
  delayedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.warningDim, borderWidth: 1, borderColor: C.warning, borderRadius: 10, marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 10 },
  delayedBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: C.warning },
  delayedBannerCount: { fontSize: 12, fontWeight: '700', color: C.warning },

  // C9: Delayed modal rows
  delayedRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  delayedPo: { fontSize: 13, fontWeight: '700', color: C.text1 },
  delayedSupplier: { fontSize: 12, color: C.accent, marginTop: 2 },
  delayedDate: { fontSize: 11, color: C.text2, marginTop: 2 },
  delayedBadge: { backgroundColor: C.warningDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  delayedBadgeText: { fontSize: 11, fontWeight: '700', color: C.warning },
  dismissBtn: { backgroundColor: C.successSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.success },
  dismissBtnText: { fontSize: 11, fontWeight: '600', color: C.success },

  // C8/C4: Remarks rows
  remarkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  remarkText: { flex: 1, fontSize: 13, color: C.text1 },
  remarkActions: { flexDirection: 'row', gap: 10 },
  remarkSaveBtn: { backgroundColor: C.accent, borderRadius: 8, padding: 6, justifyContent: 'center', alignItems: 'center' },

  // C5: Products table
  prodTableHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: C.border, gap: 4 },
  prodHeaderCell: { fontSize: 10, fontWeight: '700', color: C.text2, textTransform: 'uppercase' },
  prodTableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 4, alignItems: 'center' },
  prodCell: { fontSize: 12, color: C.text1 },
  prodInput: { backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, color: C.text1 },

  // C5/C7: Add row button
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addRowBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },

  // C7: PO Invoice rows
  poInvRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  poInvNo: { fontSize: 13, fontWeight: '700', color: C.text1 },
  poInvDetail: { fontSize: 11, color: C.text2, marginTop: 2 },

  // C3: Final Settlement
  finalRow: { backgroundColor: C.bgSecondary, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 10, gap: 8 },
  finalDesc: { fontSize: 13, fontWeight: '700', color: C.text1 },
  finalFields: { gap: 8 },
  finalFieldPair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  finalFieldLabel: { fontSize: 11, color: C.text2, flex: 1.5 },
  finalFieldValue: { fontSize: 12, fontWeight: '600', color: C.text1, flex: 2, textAlign: 'right' },
  finalInput: { flex: 2, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, color: C.text1, textAlign: 'right' },

  // Detail modal sub-action row
  subActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  subActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: C.bgPrimary, borderWidth: 1, borderColor: C.border },
  subActionBtnText: { fontSize: 11, fontWeight: '600', color: C.accent },
});
