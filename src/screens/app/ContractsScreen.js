import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData, saveDataDoc, deleteDataDoc } from '../../shared/utils/firestore';
import { getName } from '../../shared/utils/helpers';
import { usePermission } from '../../shared/hooks/usePermission';
import { useToast } from '../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../shared/utils/haptics';
import { exportToExcel, exportToPDF, buildTablePDF } from '../../shared/utils/exportUtils';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import AppHeader from '../../components/AppHeader';
import YearPicker from '../../components/YearPicker';
import SwipeableRow from '../../components/SwipeableRow';
import { COLLECTIONS } from '../../constants/collections';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BLANK = {
  supplier: '', client: '', order: '', date: '', cur: '',
  shpType: '', delTerm: '', pol: '', pod: '', origin: '',
  packing: '', remarks: '', completed: false,
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
  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('all'); // 'all'|'open'|'completed'
  const [selectedMonth, setSelectedMonth] = useState(null);

  // Modals
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickerState, setPickerState] = useState(null); // { field, options, title }

  const dateSelect = { start: `${year}-01-01`, end: `${year}-12-31` };

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

  useEffect(() => { fetchData(); }, [uidCollection, year]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ─── Filtering ─────────────────────────────────────────────────────────────
  const filtered = data
    .filter(x => {
      if (statusFilter === 'open') return !x.completed;
      if (statusFilter === 'completed') return !!x.completed;
      return true;
    })
    .filter(x => selectedMonth === null || parseInt((x.date || '').substring(5, 7), 10) - 1 === selectedMonth)
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

  // ─── getTotalQty ────────────────────────────────────────────────────────────
  const getTotalQty = (item) => {
    if (!Array.isArray(item.productsData) || !item.productsData.length) return null;
    const total = item.productsData.reduce((s, p) => s + (parseFloat(p.qnty) || 0), 0);
    return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 1 }).format(total)} MT`;
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

  const renderItem = ({ item }) => {
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
      <SwipeableRow onDelete={() => handleDelete(item)} disabled={!canDelete}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => setDetailItem(item)}
        activeOpacity={0.85}
      >
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <Text style={styles.rowNum}>PO# {item.order || '—'}</Text>
            <Text style={styles.rowSupplier}>{getName(settings, 'Supplier', item.supplier)}</Text>
            <Text style={styles.rowDate}>{item.date || ''}</Text>
          </View>
          <View style={styles.topRight}>
            {qty ? <Text style={styles.qty}>{qty}</Text> : null}
            <View style={[styles.badge, item.completed ? styles.badgeClosed : styles.badgeOpen]}>
              <Text style={[styles.badgeText, item.completed && { color: '#16a34a' }]}>
                {item.completed ? 'Completed' : 'Open'}
              </Text>
            </View>
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
      </TouchableOpacity>
      </SwipeableRow>
    );
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Contracts" />
      <YearPicker year={year} setYear={setYear} />

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

      {/* Search + Export + Add */}
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
        <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={18} color="#0366ae" />
        </TouchableOpacity>
        {canEdit && (
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#0366ae', borderColor: '#0366ae' }]}
            onPress={() => setEditItem({ ...BLANK, date: `${year}-01-01` })}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        )}
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
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No contracts found" subtitle="Try changing the year or filters" />}
      />

      {/* ─── Detail Modal ─────────────────────────────────────────────────── */}
      <Modal visible={!!detailItem} animationType="slide" transparent onRequestClose={() => setDetailItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>PO# {detailItem?.order || '—'}</Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close" size={22} color="#103a7a" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {detailItem && (<>
                <DetailRow label="Supplier" value={getName(settings, 'Supplier', detailItem.supplier)} />
                <DetailRow label="Date" value={detailItem.date} />
                <DetailRow label="Status" value={detailItem.completed ? 'Completed' : 'Open'} valueColor={detailItem.completed ? '#16a34a' : '#d97706'} />
                <DetailRow label="Currency" value={getName(settings, 'Currency', detailItem.cur, 'cur')} />
                <DetailRow label="Shipment" value={getName(settings, 'Shipment', detailItem.shpType, 'shpType')} />
                <DetailRow label="POL" value={getName(settings, 'POL', detailItem.pol, 'pol')} />
                <DetailRow label="POD" value={getName(settings, 'POD', detailItem.pod, 'pod')} />
                <DetailRow label="Origin" value={getName(settings, 'Origin', detailItem.origin, 'origin')} />
                <DetailRow label="Packing" value={getName(settings, 'Packing', detailItem.packing, 'packing')} />
                <DetailRow label="Del. Terms" value={getName(settings, 'Delivery Terms', detailItem.delTerm, 'delTerm')} />
                <DetailRow label="Del. Time" value={getName(settings, 'Delivery Time', detailItem.deltime, 'deltime')} />
                {detailItem.remarks ? <DetailRow label="Remarks" value={detailItem.remarks} /> : null}

                {/* Products */}
                {detailItem.productsData?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Products</Text>
                    {detailItem.productsData.map((p, i) => (
                      <View key={i} style={styles.productRow}>
                        <Text style={styles.productName}>{p.product || `Product ${i + 1}`}</Text>
                        <Text style={styles.productQty}>{p.qnty} {p.unit || 'MT'}</Text>
                        {p.price ? <Text style={styles.productPrice}>${p.price}</Text> : null}
                      </View>
                    ))}
                  </View>
                )}

                {/* Invoices linked */}
                {detailItem.invoices?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Linked Invoices ({detailItem.invoices.length})</Text>
                    {detailItem.invoices.slice(0, 5).map((inv, i) => (
                      <Text key={i} style={styles.linkedItem}>{inv.invoice || inv}</Text>
                    ))}
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: detailItem.completed ? '#fef2f2' : '#f0fdf4' }]}
                    onPress={() => toggleComplete(detailItem)}
                  >
                    <Ionicons name={detailItem.completed ? 'refresh-outline' : 'checkmark-circle-outline'} size={16} color={detailItem.completed ? '#dc2626' : '#16a34a'} />
                    <Text style={[styles.actionBtnText, { color: detailItem.completed ? '#dc2626' : '#16a34a' }]}>
                      {detailItem.completed ? 'Reopen' : 'Mark Complete'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#ebf2fc' }]}
                    onPress={() => { setDetailItem(null); setEditItem({ ...detailItem }); }}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#0366ae" />
                    <Text style={[styles.actionBtnText, { color: '#0366ae' }]}>{canEdit ? 'Edit' : 'View'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#f7fbff' }]}
                    onPress={() => handleExportPDF(detailItem)}
                  >
                    <Ionicons name="document-outline" size={16} color="#7c3aed" />
                    <Text style={[styles.actionBtnText, { color: '#7c3aed' }]}>PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#fef2f2', opacity: canDelete ? 1 : 0.4 }]}
                    onPress={() => canDelete && handleDelete(detailItem)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>)}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Add/Edit Modal ───────────────────────────────────────────────── */}
      <Modal visible={!!editItem} animationType="slide" transparent onRequestClose={() => setEditItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editItem?.id ? 'Edit Contract' : 'New Contract'}</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <Ionicons name="close" size={22} color="#103a7a" />
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
                <PickerField label="Client" value={getLabel('Client', editItem.client)}
                  onPress={() => openPicker('client', 'Client', 'nname', 'Select Client')} />
                <PickerField label="Currency" value={getLabel('Currency', editItem.cur, 'cur')}
                  onPress={() => openPicker('cur', 'Currency', 'cur', 'Select Currency')} />
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

                <FormField label="Remarks" value={editItem.remarks || ''}
                  onChangeText={v => setEditItem(p => ({ ...p, remarks: v }))}
                  multiline />

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
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
                <Ionicons name="close" size={22} color="#103a7a" />
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
    </View>
  );
}

// ─── Helper components ──────────────────────────────────────────────────────
function DetailRow({ label, value, valueColor }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor && { color: valueColor }]}>{value}</Text>
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
        placeholderTextColor="#b8ddf8"
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
        <Text style={[styles.pickerBtnText, !value && { color: '#b8ddf8' }]}>
          {value || `Select ${label}`}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#9fb8d4" />
      </TouchableOpacity>
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
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8ddf8',
    borderRadius: 999, paddingHorizontal: 12, height: 38,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#103a7a' },
  iconBtn: {
    width: 38, height: 38, borderRadius: 999,
    backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#b8ddf8',
  },

  count: { paddingHorizontal: 16, fontSize: 11, color: '#9fb8d4', marginBottom: 4 },
  list: { padding: 12, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8', padding: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topLeft: { flex: 1, marginRight: 12 },
  topRight: { alignItems: 'flex-end', gap: 6 },
  rowNum: { fontSize: 13, fontWeight: '700', color: '#0366ae', marginBottom: 2 },
  rowSupplier: { fontSize: 12, fontWeight: '600', color: '#103a7a', marginBottom: 2 },
  rowDate: { fontSize: 11, color: '#9fb8d4' },
  qty: { fontSize: 11, fontWeight: '600', color: '#0366ae' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeOpen: { backgroundColor: '#dbeeff' },
  badgeClosed: { backgroundColor: '#f0fdf4' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#0366ae' },
  divider: { height: 1, backgroundColor: '#f0f4f8', marginVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f8ff', borderRadius: 999, borderWidth: 1, borderColor: '#b8ddf8', paddingHorizontal: 8, paddingVertical: 3 },
  chipLabel: { fontSize: 9, color: '#9fb8d4', fontWeight: '600', textTransform: 'uppercase' },
  chipValue: { fontSize: 10, color: '#103a7a', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9fb8d4', marginTop: 40, fontSize: 14 },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e3f0fb' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#103a7a' },
  modalBody: { padding: 20, gap: 10, paddingBottom: 32 },

  // Detail modal
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  detailLabel: { fontSize: 12, color: '#9fb8d4', flex: 1 },
  detailValue: { fontSize: 12, fontWeight: '600', color: '#103a7a', flex: 2, textAlign: 'right' },

  section: { marginTop: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9fb8d4', textTransform: 'uppercase', marginBottom: 6 },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  productName: { fontSize: 12, color: '#103a7a', flex: 2 },
  productQty: { fontSize: 12, fontWeight: '600', color: '#0366ae' },
  productPrice: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  linkedItem: { fontSize: 12, color: '#0366ae', paddingVertical: 2 },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  // Edit form
  formField: { gap: 4 },
  formLabel: { fontSize: 11, fontWeight: '700', color: '#103a7a', textTransform: 'uppercase' },
  formInput: { backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#103a7a' },
  formInputMulti: { height: 80, textAlignVertical: 'top' },
  pickerBtn: { backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerBtnText: { fontSize: 14, color: '#103a7a' },

  // Picker list
  pickerItem: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  pickerItemText: { fontSize: 14, color: '#103a7a' },

  saveBtn: { backgroundColor: '#0366ae', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
