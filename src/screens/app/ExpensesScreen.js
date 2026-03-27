import { useEffect, useState } from 'react';
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
import { formatCurrency, getName } from '../../shared/utils/helpers';
import { usePermission } from '../../shared/hooks/usePermission';
import { useToast } from '../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../shared/utils/haptics';
import { exportToExcel } from '../../shared/utils/exportUtils';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import AppHeader from '../../components/AppHeader';
import YearPicker from '../../components/YearPicker';
import SwipeableRow from '../../components/SwipeableRow';
import { COLLECTIONS } from '../../constants/collections';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BLANK_EXP = {
  expense: '', date: '', supplier: '', cur: '', amount: '',
  expType: '', paid: '', salesInv: '', invoice: '', comments: '',
};

export default function ExpensesScreen() {
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
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [paidFilter, setPaidFilter] = useState('all'); // 'all'|'paid'|'unpaid'

  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickerState, setPickerState] = useState(null);

  const dateSelect = { start: `${year}-01-01`, end: `${year}-12-31` };

  const fetchData = async () => {
    if (!uidCollection) return;
    try {
      const rows = await loadData(uidCollection, COLLECTIONS.EXPENSES, dateSelect);
      const transformed = rows.map(z => ({
        ...z,
        amount: parseFloat(z.amount) || 0,
        poSupplierOrder: z.poSupplier?.order || '',
      }));
      setData(transformed);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, [uidCollection, year]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const isPaidCheck = (item) => {
    const paidLabel = getName(settings, 'ExpPmnt', item.paid, 'paid');
    return paidLabel.toLowerCase() !== 'unpaid' && item.paid !== '222';
  };

  // ─── Filtering ─────────────────────────────────────────────────────────────
  const filtered = data
    .filter(x => {
      if (paidFilter === 'paid') return isPaidCheck(x);
      if (paidFilter === 'unpaid') return !isPaidCheck(x);
      return true;
    })
    .filter(x => selectedMonth === null || parseInt((x.date || '').substring(5, 7), 10) - 1 === selectedMonth)
    .filter(x => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        getName(settings, 'Supplier', x.supplier).toLowerCase().includes(q) ||
        (x.expense || '').toLowerCase().includes(q) ||
        (x.salesInv || '').toLowerCase().includes(q) ||
        (x.invoice || '').toLowerCase().includes(q)
      );
    });

  // ─── Summary totals by type ─────────────────────────────────────────────────
  const totalAmount = filtered.reduce((s, x) => s + (x.amount || 0), 0);

  // Totals per expense type (web's "totals calculation table")
  const typeTotals = filtered.reduce((acc, x) => {
    const typeName = getName(settings, 'Expenses', x.expType, 'expType') || 'Other';
    acc[typeName] = (acc[typeName] || 0) + (x.amount || 0);
    return acc;
  }, {});

  // ─── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const cols = [
      { key: 'expense', label: 'EXP#' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'date', label: 'Date' },
      { key: 'amount', label: 'Amount' },
      { key: 'typeName', label: 'Type' },
      { key: 'paidLabel', label: 'Paid' },
      { key: 'salesInv', label: 'Sales Invoice' },
      { key: 'comments', label: 'Comments' },
    ];
    const rows = filtered.map(x => ({
      ...x,
      supplierName: getName(settings, 'Supplier', x.supplier),
      typeName: getName(settings, 'Expenses', x.expType, 'expType'),
      paidLabel: getName(settings, 'ExpPmnt', x.paid, 'paid') || (isPaidCheck(x) ? 'Paid' : 'Unpaid'),
    }));
    exportToExcel(rows, cols, `expenses_${year}`);
  };

  // ─── Save expense ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editItem.date || !editItem.amount) {
      Alert.alert('Required', 'Date and Amount are required.');
      return;
    }
    setSaving(true);
    const yr = editItem.date.substring(0, 4) || String(year);
    const id = editItem.id || uuidv4();
    const toSave = { ...editItem, id, amount: parseFloat(editItem.amount) || 0 };
    const ok = await saveDataDoc(uidCollection, COLLECTIONS.EXPENSES, yr, id, toSave);
    if (ok) {
      setData(prev => {
        const idx = prev.findIndex(x => x.id === id);
        if (idx >= 0) { const copy = [...prev]; copy[idx] = toSave; return copy; }
        return [...prev, toSave];
      });
      setEditItem(null);
      hapticSuccess();
      setToast({ text: editItem.id ? 'Expense updated' : 'Expense added', clr: 'success' });
    } else {
      Alert.alert('Error', 'Failed to save expense.');
    }
    setSaving(false);
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (item) => {
    Alert.alert('Delete Expense', `Delete EXP# ${item.expense || item.id}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const yr = item.date?.substring(0, 4) || String(year);
          const ok = await deleteDataDoc(uidCollection, COLLECTIONS.EXPENSES, yr, item.id);
          if (ok) {
            setData(prev => prev.filter(x => x.id !== item.id));
            setDetailItem(null);
            hapticWarning();
            setToast({ text: 'Expense deleted', clr: 'error' });
          } else {
            Alert.alert('Error', 'Failed to delete.');
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
  const getLabel = (settingsKey, id, nameField = 'nname') => getName(settings, settingsKey, id, nameField) || '';

  // ─── Render card ────────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const supplierName = getName(settings, 'Supplier', item.supplier);
    const currency = getName(settings, 'Currency', item.cur, 'cur');
    const expType = getName(settings, 'Expenses', item.expType, 'expType');
    const paidLabel = getName(settings, 'ExpPmnt', item.paid, 'paid');
    const paid = isPaidCheck(item);
    const paidColor = paid ? '#16a34a' : '#dc2626';

    return (
      <SwipeableRow onDelete={() => handleDelete(item)} disabled={!canDelete}>
      <TouchableOpacity style={styles.card} onPress={() => setDetailItem(item)} activeOpacity={0.85}>
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <Text style={styles.rowNum}>EXP# {item.expense || '—'}</Text>
            <Text style={styles.rowSupplier}>{supplierName}</Text>
            <Text style={styles.rowDate}>{item.date || ''}</Text>
          </View>
          <View style={styles.topRight}>
            <Text style={styles.rowAmount}>{formatCurrency(item.amount)}</Text>
            <View style={[styles.badge, { backgroundColor: paidColor + '18' }]}>
              <Text style={[styles.badgeText, { color: paidColor }]}>
                {paidLabel || (paid ? 'Paid' : 'Unpaid')}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.details}>
          {item.salesInv ? <IRow label="Sales Inv" value={item.salesInv} /> : null}
          {expType ? <IRow label="Type" value={expType} /> : null}
          {currency ? <IRow label="Currency" value={currency} /> : null}
          {item.comments ? <IRow label="Comments" value={item.comments} /> : null}
        </View>
      </TouchableOpacity>
      </SwipeableRow>
    );
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Expenses" />
      <YearPicker year={year} setYear={setYear} />

      {/* Paid filter tabs */}
      <View style={styles.tabsRow}>
        {[['all', 'All'], ['unpaid', 'Unpaid'], ['paid', 'Paid']].map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.tab, paidFilter === k && styles.tabActive]} onPress={() => setPaidFilter(k)}>
            <Text style={[styles.tabText, paidFilter === k && styles.tabTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Month chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={styles.monthRow}>
        <TouchableOpacity
          style={[styles.monthChip, selectedMonth === null && styles.monthChipActive]}
          onPress={() => setSelectedMonth(null)}
        >
          <Text style={[styles.monthChipText, selectedMonth === null && styles.monthChipTextActive]}>All</Text>
        </TouchableOpacity>
        {MONTHS.map((m, i) => (
          <TouchableOpacity key={i}
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
            placeholder="Supplier, EXP#..."
            placeholderTextColor="#b8ddf8"
            value={search}
            onChangeText={setSearch}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color="#9fb8d4" /></TouchableOpacity> : null}
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={18} color="#0366ae" />
        </TouchableOpacity>
        {canEdit && (
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#0366ae', borderColor: '#0366ae' }]}
            onPress={() => setEditItem({ ...BLANK_EXP, date: `${year}-01-01` })}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.count}>{filtered.length} expenses</Text>
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
        ListEmptyComponent={<EmptyState icon="wallet-outline" title="No expenses found" subtitle="Try changing the year or filters" />}
        ListFooterComponent={
          Object.keys(typeTotals).length > 0 ? (
            <View style={styles.totalsTable}>
              <Text style={styles.totalsTitle}>Totals by Type</Text>
              {Object.entries(typeTotals).map(([type, total]) => (
                <View key={type} style={styles.totalsRow}>
                  <Text style={styles.totalsType}>{type}</Text>
                  <Text style={styles.totalsValue}>{formatCurrency(total)}</Text>
                </View>
              ))}
              <View style={[styles.totalsRow, styles.totalsTotalRow]}>
                <Text style={styles.totalsTotalLabel}>Total</Text>
                <Text style={styles.totalsTotalValue}>{formatCurrency(totalAmount)}</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* ─── Detail Modal ─────────────────────────────────────────────────── */}
      <Modal visible={!!detailItem} animationType="slide" transparent onRequestClose={() => setDetailItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>EXP# {detailItem?.expense || '—'}</Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close" size={22} color="#103a7a" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {detailItem && (<>
                <DRow label="Supplier" value={getName(settings, 'Supplier', detailItem.supplier)} />
                <DRow label="Date" value={detailItem.date} />
                <DRow label="Amount" value={formatCurrency(detailItem.amount)} />
                <DRow label="Currency" value={getName(settings, 'Currency', detailItem.cur, 'cur')} />
                <DRow label="Type" value={getName(settings, 'Expenses', detailItem.expType, 'expType')} />
                <DRow label="Paid" value={getName(settings, 'ExpPmnt', detailItem.paid, 'paid') || (isPaidCheck(detailItem) ? 'Paid' : 'Unpaid')} />
                <DRow label="Sales Invoice" value={detailItem.salesInv} />
                <DRow label="Invoice Ref" value={detailItem.invoice} />
                {detailItem.comments ? <DRow label="Comments" value={detailItem.comments} /> : null}

                <View style={styles.actionRow}>
                  {canEdit && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ebf2fc' }]}
                      onPress={() => { setDetailItem(null); setEditItem({ ...detailItem, amount: String(detailItem.amount) }); }}>
                      <Ionicons name="pencil-outline" size={16} color="#0366ae" />
                      <Text style={[styles.actionBtnText, { color: '#0366ae' }]}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  {canDelete && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
                      onPress={() => handleDelete(detailItem)}>
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

      {/* ─── Add/Edit Modal ───────────────────────────────────────────────── */}
      <Modal visible={!!editItem} animationType="slide" transparent onRequestClose={() => setEditItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editItem?.id ? 'Edit Expense' : 'New Expense'}</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <Ionicons name="close" size={22} color="#103a7a" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {editItem && (<>
                <EField label="EXP#" value={editItem.expense} onChangeText={v => setEditItem(p => ({ ...p, expense: v }))} />
                <EField label="Date (YYYY-MM-DD)" value={editItem.date} onChangeText={v => setEditItem(p => ({ ...p, date: v }))} />
                <EField label="Amount *" value={editItem.amount} onChangeText={v => setEditItem(p => ({ ...p, amount: v }))} keyboardType="numeric" />
                <EPicker label="Supplier" value={getLabel('Supplier', editItem.supplier)} onPress={() => openPicker('supplier', 'Supplier', 'nname', 'Select Supplier')} />
                <EPicker label="Currency" value={getLabel('Currency', editItem.cur, 'cur')} onPress={() => openPicker('cur', 'Currency', 'cur', 'Select Currency')} />
                <EPicker label="Expense Type" value={getLabel('Expenses', editItem.expType, 'expType')} onPress={() => openPicker('expType', 'Expenses', 'expType', 'Select Type')} />
                <EPicker label="Payment Status" value={getLabel('ExpPmnt', editItem.paid, 'paid')} onPress={() => openPicker('paid', 'ExpPmnt', 'paid', 'Payment Status')} />
                <EField label="Sales Invoice" value={editItem.salesInv} onChangeText={v => setEditItem(p => ({ ...p, salesInv: v }))} />
                <EField label="Invoice Reference" value={editItem.invoice} onChangeText={v => setEditItem(p => ({ ...p, invoice: v }))} />
                <EField label="Comments" value={editItem.comments} onChangeText={v => setEditItem(p => ({ ...p, comments: v }))} multiline />

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>{editItem?.id ? 'Update' : 'Add Expense'}</Text>}
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
                  onPress={() => { setEditItem(p => ({ ...p, [pickerState.field]: item.id })); setPickerState(null); }}
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

function IRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
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

function EField({ label, value, onChangeText, multiline, keyboardType }) {
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
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

function EPicker({ label, value, onPress }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={onPress}>
        <Text style={[styles.pickerBtnText, !value && { color: '#b8ddf8' }]}>{value || `Select ${label}`}</Text>
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
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 999, paddingHorizontal: 12, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: '#103a7a' },
  iconBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#b8ddf8' },
  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4 },
  count: { fontSize: 11, color: '#9fb8d4' },
  totalAmount: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  list: { padding: 12, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8', padding: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topLeft: { flex: 1, marginRight: 12 },
  topRight: { alignItems: 'flex-end', gap: 4 },
  rowNum: { fontSize: 13, fontWeight: '700', color: '#0366ae', marginBottom: 2 },
  rowSupplier: { fontSize: 12, fontWeight: '600', color: '#103a7a', marginBottom: 2 },
  rowDate: { fontSize: 11, color: '#9fb8d4' },
  rowAmount: { fontSize: 13, fontWeight: '700', color: '#103a7a' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f0f4f8', marginVertical: 8 },
  details: { gap: 5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoLabel: { fontSize: 10, color: '#9fb8d4', fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 11, color: '#103a7a', fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: 8 },

  // Totals table
  totalsTable: { margin: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8', padding: 14 },
  totalsTitle: { fontSize: 12, fontWeight: '700', color: '#103a7a', marginBottom: 8, textTransform: 'uppercase' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  totalsType: { fontSize: 12, color: '#9fb8d4' },
  totalsValue: { fontSize: 12, fontWeight: '600', color: '#103a7a' },
  totalsTotalRow: { borderBottomWidth: 0, marginTop: 4, borderTopWidth: 1, borderTopColor: '#b8ddf8' },
  totalsTotalLabel: { fontSize: 13, fontWeight: '700', color: '#103a7a' },
  totalsTotalValue: { fontSize: 13, fontWeight: '800', color: '#dc2626' },

  empty: { textAlign: 'center', color: '#9fb8d4', marginTop: 40, fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e3f0fb' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#103a7a' },
  modalBody: { padding: 20, gap: 10, paddingBottom: 32 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  detailLabel: { fontSize: 12, color: '#9fb8d4', flex: 1 },
  detailValue: { fontSize: 12, fontWeight: '600', color: '#103a7a', flex: 2, textAlign: 'right' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  formField: { gap: 4 },
  formLabel: { fontSize: 11, fontWeight: '700', color: '#103a7a', textTransform: 'uppercase' },
  formInput: { backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#103a7a' },
  formInputMulti: { height: 80, textAlignVertical: 'top' },
  pickerBtn: { backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerBtnText: { fontSize: 14, color: '#103a7a' },
  pickerItem: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  pickerItemText: { fontSize: 14, color: '#103a7a' },
  saveBtn: { backgroundColor: '#0366ae', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
