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
import { formatCurrency, getName, safeDate } from '../../shared/utils/helpers';
import { usePermission } from '../../shared/hooks/usePermission';
import { useToast } from '../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../shared/utils/haptics';
import { exportToExcel } from '../../shared/utils/exportUtils';
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
  const _cy = new Date().getFullYear();
  const [dateRange, setDateRange] = useState({ start: `${_cy}-01-01`, end: `${_cy}-12-31` });
  const dateSelect = dateRange;
  const year = dateRange.start?.substring(0, 4) || String(_cy);
  const [paidFilter, setPaidFilter] = useState('all'); // 'all'|'paid'|'unpaid'

  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickerState, setPickerState] = useState(null);

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

  useEffect(() => { fetchData(); }, [uidCollection, dateRange]);
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

  // ─── Summary totals ─────────────────────────────────────────────────────────
  const totalAmount = filtered.reduce((s, x) => s + (x.amount || 0), 0);

  // Summary - Unpaid (paid === '222'), grouped by supplier × currency — matches web
  const unpaidTotals = Object.values(
    filtered.filter(x => x.paid === '222').reduce((acc, x) => {
      const key = `${x.supplier}||${x.cur}`;
      if (!acc[key]) acc[key] = { supplier: x.supplier, cur: x.cur, amount: 0 };
      acc[key].amount += x.amount || 0;
      return acc;
    }, {})
  );

  // Summary - All, grouped by supplier × currency — matches web
  const allTotals = Object.values(
    filtered.reduce((acc, x) => {
      const key = `${x.supplier}||${x.cur}`;
      if (!acc[key]) acc[key] = { supplier: x.supplier, cur: x.cur, amount: 0 };
      acc[key].amount += x.amount || 0;
      return acc;
    }, {})
  );

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
    if (!editItem.expense || !editItem.date || !editItem.amount || !editItem.supplier || !editItem.expType || !editItem.cur) {
      Alert.alert('Required', 'EXP#, Date, Amount, Supplier, Type and Currency are required.');
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
  const renderItem = ({ item, index }) => {
    const supplierName = getName(settings, 'Supplier', item.supplier);
    const currency = getName(settings, 'Currency', item.cur, 'cur');
    const expType = getName(settings, 'Expenses', item.expType, 'expType');
    const paidLabel = getName(settings, 'ExpPmnt', item.paid, 'paid');
    const paid = isPaidCheck(item);
    const paidColor = paid ? C.success : C.danger;

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(280)}>
      <SwipeableRow onDelete={() => handleDelete(item)} disabled={!canDelete}>
      <TouchableOpacity style={styles.card} onPress={() => setDetailItem(item)} activeOpacity={0.85}>
        <View style={[styles.accentBar, { backgroundColor: paidColor }]} />
        <View style={styles.cardContent}>
          <View style={styles.topRow}>
            <View style={styles.topLeft}>
              <Text style={styles.rowNum}>EXP# {item.expense || '—'}</Text>
              <Text style={styles.rowSupplier}>{supplierName}</Text>
              <Text style={styles.rowDate}>{safeDate(item.date)}</Text>
            </View>
            <View style={styles.topRight}>
              <Text style={styles.rowAmount}>{formatCurrency(item.amount)}</Text>
              <View style={[styles.badge, { backgroundColor: paidColor + '22' }]}>
                <Text style={[styles.badgeText, { color: paidColor }]}>
                  {paidLabel || (paid ? 'Paid' : 'Unpaid')}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.details}>
            {item.poSupplierOrder ? <IRow label="PO#" value={item.poSupplierOrder} /> : null}
            {item.salesInv ? <IRow label="Sales Inv" value={item.salesInv} /> : null}
            {expType ? <IRow label="Type" value={expType} /> : null}
            {currency ? <IRow label="Currency" value={currency} /> : null}
            {item.comments ? <IRow label="Comments" value={item.comments} /> : null}
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
      <AppHeader title="Expenses" />
      <DateRangeFilter
        onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
        initialYear={_cy}
      />

      {/* Paid filter tabs */}
      <View style={styles.tabsRow}>
        {[['all', 'All'], ['unpaid', 'Unpaid'], ['paid', 'Paid']].map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.tab, paidFilter === k && styles.tabActive]} onPress={() => setPaidFilter(k)}>
            <Text style={[styles.tabText, paidFilter === k && styles.tabTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search + Export + Add */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.text2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Supplier, EXP#..."
            placeholderTextColor={C.text3}
            value={search}
            onChangeText={setSearch}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={C.text2} /></TouchableOpacity> : null}
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={18} color={C.text2} />
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.count}>{filtered.length} expenses</Text>
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
        ListEmptyComponent={<EmptyState icon="wallet-outline" title="No expenses found" subtitle="Try changing the year or filters" />}
        ListFooterComponent={
          (unpaidTotals.length > 0 || allTotals.length > 0) ? (
            <View style={{ gap: 10, paddingHorizontal: 12, paddingBottom: 4 }}>
              {unpaidTotals.length > 0 && (
                <SummaryTable
                  title="Summary — Unpaid"
                  rows={unpaidTotals}
                  settings={settings}
                />
              )}
              {allTotals.length > 0 && (
                <SummaryTable
                  title="Summary"
                  rows={allTotals}
                  settings={settings}
                />
              )}
            </View>
          ) : null
        }
      />

      {canEdit && (
        <TouchableOpacity
          style={[styles.fab, { bottom: getBottomPad(insets) + 16 }]}
          onPress={() => setEditItem({ ...BLANK_EXP, date: `${year}-01-01` })}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color={C.text1} />
        </TouchableOpacity>
      )}

      {/* ─── Detail Modal ─────────────────────────────────────────────────── */}
      <Modal visible={!!detailItem} animationType="slide" transparent onRequestClose={() => setDetailItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>EXP# {detailItem?.expense || '—'}</Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {detailItem && (<>
                <DRow label="Supplier" value={getName(settings, 'Supplier', detailItem.supplier)} />
                <DRow label="Date" value={safeDate(detailItem.date)} />
                <DRow label="Amount" value={formatCurrency(detailItem.amount)} />
                <DRow label="Currency" value={getName(settings, 'Currency', detailItem.cur, 'cur')} />
                <DRow label="Type" value={getName(settings, 'Expenses', detailItem.expType, 'expType')} />
                <DRow label="Paid" value={getName(settings, 'ExpPmnt', detailItem.paid, 'paid') || (isPaidCheck(detailItem) ? 'Paid' : 'Unpaid')} />
                <DRow label="Sales Invoice" value={detailItem.salesInv} />
                <DRow label="Invoice Ref" value={detailItem.invoice} />
                {detailItem.comments ? <DRow label="Comments" value={detailItem.comments} /> : null}

                <View style={styles.actionRow}>
                  {canEdit && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.bgTertiary }]}
                      onPress={() => { setDetailItem(null); setEditItem({ ...detailItem, amount: String(detailItem.amount) }); }}>
                      <Ionicons name="pencil-outline" size={16} color={C.accent} />
                      <Text style={[styles.actionBtnText, { color: C.accent }]}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  {canDelete && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.dangerDim }]}
                      onPress={() => handleDelete(detailItem)}>
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

      {/* ─── Add/Edit Modal ───────────────────────────────────────────────── */}
      <Modal visible={!!editItem} animationType="slide" transparent onRequestClose={() => setEditItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editItem?.id ? 'Edit Expense' : 'New Expense'}</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
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
                    ? <ActivityIndicator color={C.text1} size="small" />
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
                <Ionicons name="close" size={22} color={C.text1} />
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

function SummaryTable({ title, rows, settings }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <View style={styles.totalsTable}>
      <Text style={styles.totalsTitle}>{title}</Text>
      {rows.map((r, i) => (
        <View key={i} style={styles.totalsRow}>
          <Text style={styles.totalsType}>{getName(settings, 'Supplier', r.supplier)}</Text>
          <Text style={styles.totalsValue}>
            {getName(settings, 'Currency', r.cur, 'cur') || r.cur}{'  '}
            {formatCurrency(r.amount)}
          </Text>
        </View>
      ))}
      <View style={[styles.totalsRow, styles.totalsTotalRow]}>
        <Text style={styles.totalsTotalLabel}>Total</Text>
        <Text style={styles.totalsTotalValue}>{formatCurrency(total)}</Text>
      </View>
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
  const safe = typeof value === 'object' ? (value.id || value.rmrk || '') : value;
  if (!safe) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor && { color: valueColor }]}>{safe}</Text>
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
        placeholderTextColor={C.text3}
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
        <Text style={[styles.pickerBtnText, !value && { color: C.text3 }]}>{value || `Select ${label}`}</Text>
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
  tabText: { fontSize: 12, fontWeight: '600', color: C.accent },
  tabTextActive: { color: C.text1 },
  monthScroll: { marginHorizontal: 12, marginBottom: 6, flexGrow: 0 },
  monthRow: { flexDirection: 'row', gap: 6, paddingVertical: 2, alignItems: 'center' },
  monthChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border },
  monthChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  monthChipText: { fontSize: 11, fontWeight: '600', color: C.accent },
  monthChipTextActive: { color: C.text1 },
  toolbar: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 4, gap: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: C.text1 },
  iconBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: C.bgTertiary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4 },
  count: { fontSize: 11, color: C.text2 },
  totalAmount: { fontSize: 12, fontWeight: '700', color: C.danger },
  list: { padding: 12, gap: 10 },
  card: { backgroundColor: C.bg1, borderRadius: 14, borderWidth: 1, borderColor: C.border, flexDirection: 'row', overflow: 'hidden' },
  accentBar: { width: 3 },
  cardContent: { flex: 1, padding: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topLeft: { flex: 1, marginRight: 12 },
  topRight: { alignItems: 'flex-end', gap: 4 },
  rowNum: { fontSize: 13, fontWeight: '700', color: C.accent, marginBottom: 2 },
  rowSupplier: { fontSize: 12, fontWeight: '600', color: C.text1, marginBottom: 2 },
  rowDate: { fontSize: 11, color: C.text2 },
  rowAmount: { fontSize: 13, fontWeight: '700', color: C.text1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  details: { gap: 5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoLabel: { fontSize: 10, color: C.text2, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 11, color: C.text1, fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: 8 },

  // Totals table
  totalsTable: { margin: 12, backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 },
  totalsTitle: { fontSize: 12, fontWeight: '700', color: C.text1, marginBottom: 8, textTransform: 'uppercase' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  totalsType: { fontSize: 12, color: C.text2 },
  totalsValue: { fontSize: 12, fontWeight: '600', color: C.text1 },
  totalsTotalRow: { borderBottomWidth: 0, marginTop: 4, borderTopWidth: 1, borderTopColor: C.text3 },
  totalsTotalLabel: { fontSize: 13, fontWeight: '700', color: C.text1 },
  totalsTotalValue: { fontSize: 13, fontWeight: '800', color: C.danger },

  empty: { textAlign: 'center', color: C.text2, marginTop: 40, fontSize: 14 },
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
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  detailLabel: { fontSize: 12, color: C.text2, flex: 1 },
  detailValue: { fontSize: 12, fontWeight: '600', color: C.text1, flex: 2, textAlign: 'right' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
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
