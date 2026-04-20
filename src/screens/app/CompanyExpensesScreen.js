import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, ScrollView, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../shared/firebase';
import { UserAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../shared/hooks/usePermission';
import { useToast } from '../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../shared/utils/haptics';
import { getName, safeDate } from '../../shared/utils/helpers';
import { exportToExcel } from '../../shared/utils/exportUtils';
import { getBottomPad } from '../../theme/spacing';
import AppHeader from '../../components/AppHeader';
import DateRangeFilter from '../../components/DateRangeFilter';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import C from '../../theme/colors';

const STATUS_CHIPS = ['All', 'Paid', 'Unpaid'];

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const getCurrency = (settings, curId) => {
  if (!curId) return 'USD';
  const raw = getName(settings, 'Currency', curId, 'cur') || String(curId);
  const u = raw.toUpperCase();
  if (u === 'US' || u === 'USD') return 'USD';
  if (u === 'EU' || u === 'EUR') return 'EUR';
  return u || 'USD';
};

const fmtAmount = (val, cur) => {
  if (!val && val !== 0) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', minimumFractionDigits: 2 }).format(Number(val));
  } catch { return `${cur} ${Number(val).toFixed(2)}`; }
};

function PaidBadge({ resolvedPaid }) {
  const paid = (resolvedPaid || '').toLowerCase().includes('paid') && !(resolvedPaid || '').toLowerCase().includes('un');
  return (
    <View style={[styles.badge, paid ? styles.badgePaid : styles.badgeUnpaid]}>
      <Text style={[styles.badgeText, paid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
        {resolvedPaid || 'Unpaid'}
      </Text>
    </View>
  );
}

function EField({ label, value, onChange, keyboardType, placeholder }) {
  return (
    <View style={styles.mFieldWrap}>
      <Text style={styles.mFieldLabel}>{label}</Text>
      <TextInput
        style={styles.mInput}
        value={value ? String(value) : ''}
        onChangeText={onChange}
        placeholder={placeholder || ''}
        placeholderTextColor={C.text3}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

function PickerRow({ label, value, options, onSelect }) {
  return (
    <View style={styles.mFieldWrap}>
      <Text style={styles.mFieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.pickerChip, value === opt.value && styles.pickerChipActive]}
              onPress={() => onSelect(opt.value)}
            >
              <Text style={[styles.pickerChipText, value === opt.value && styles.pickerChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const EMPTY_DRAFT = {
  id: '', expense: '', date: '', amount: '',
  supplier: '', expType: '', cur: '', paid: '', comments: '',
};

export default function CompanyExpensesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const { canEdit } = usePermission();
  const { setToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const _cy = new Date().getFullYear();
  const [dateRange, setDateRange] = useState({ start: `${_cy}-01-01`, end: `${_cy}-12-31` });
  const dateSelect = dateRange;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modalItem, setModalItem] = useState(null); // null = closed, object = editing/adding
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  // ─── Settings options ──────────────────────────────────────────────────────
  const supplierOptions = useMemo(() => (settings?.Supplier?.Supplier || []).map(x => ({ value: x.id, label: x.nname || x.id })), [settings]);
  const expTypeOptions  = useMemo(() => (settings?.Expenses?.Expenses || []).map(x => ({ value: x.id, label: x.expType || x.id })), [settings]);
  const curOptions      = useMemo(() => (settings?.Currency?.Currency || []).map(x => ({ value: x.id, label: x.cur || x.id })), [settings]);
  const paidOptions     = useMemo(() => (settings?.ExpPmnt?.ExpPmnt || []).map(x => ({ value: x.id, label: x.paid || x.id })), [settings]);

  const resolveSupplier = (id) => getName(settings, 'Supplier', id) || id || '';
  const resolveExpType  = (id) => getName(settings, 'Expenses', id, 'expType') || id || '';
  const resolvePaid     = (id) => getName(settings, 'ExpPmnt', id, 'paid') || id || '';

  const isUnpaid = (item) => {
    const p = (resolvePaid(item.paid) || '').toLowerCase();
    return !p.includes('paid') || p.includes('un');
  };

  // ─── Load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    if (!uidCollection) return;
    try {
      setError(null);
      const col = collection(db, uidCollection, 'data', 'companyExpenses');
      const q = query(col, where('date', '>=', dateSelect.start), where('date', '<=', dateSelect.end));
      const snap = await getDocs(q);
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, dateRange]);

  // ─── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = items;
    if (statusFilter === 'Paid')   arr = arr.filter(x => !isUnpaid(x));
    if (statusFilter === 'Unpaid') arr = arr.filter(x => isUnpaid(x));
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(x =>
        resolveSupplier(x.supplier).toLowerCase().includes(q) ||
        (x.expense || '').toLowerCase().includes(q) ||
        resolveExpType(x.expType).toLowerCase().includes(q) ||
        (x.comments || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [items, statusFilter, search, settings]);

  // ─── Summaries ─────────────────────────────────────────────────────────────
  const buildSummary = (arr) => {
    const map = {};
    arr.forEach(x => {
      const sup = resolveSupplier(x.supplier) || '—';
      const cur = getCurrency(settings, x.cur);
      const key = `${sup}|${cur}`;
      if (!map[key]) map[key] = { supplier: sup, cur, amount: 0 };
      map[key].amount += Number(x.amount) || 0;
    });
    return Object.values(map);
  };

  const summaryUnpaid = useMemo(() => buildSummary(filtered.filter(x => isUnpaid(x))), [filtered, settings]);
  const summaryAll    = useMemo(() => buildSummary(filtered), [filtered, settings]);

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!draft.expense || !draft.date || !draft.amount) {
      setToast({ text: 'Fill in Expense Invoice, Date and Amount', clr: 'error' });
      hapticWarning();
      return;
    }
    setSaving(true);
    try {
      const id = draft.id || genId();
      const obj = {
        ...draft, id,
        amount: Number(draft.amount) || 0,
        lstSaved: new Date().toISOString(),
      };
      await setDoc(doc(db, uidCollection, 'data', 'companyExpenses', id), obj);
      hapticSuccess();
      setToast({ text: draft.id ? 'Expense updated' : 'Expense added', clr: 'success' });
      setModalItem(null);
      setLoading(true);
      load();
    } catch (e) { console.error(e); setToast({ text: 'Save failed', clr: 'error' }); hapticWarning(); }
    finally { setSaving(false); }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (item) => {
    Alert.alert('Delete Expense', `Delete "${item.expense || item.id}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, uidCollection, 'data', 'companyExpenses', item.id));
            hapticSuccess();
            setToast({ text: 'Expense deleted', clr: 'success' });
            setItems(prev => prev.filter(x => x.id !== item.id));
          } catch (e) { setToast({ text: 'Delete failed', clr: 'error' }); hapticWarning(); }
        },
      },
    ]);
  };

  // ─── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const cols = [
      { key: 'expense', label: 'Expense Invoice' },
      { key: 'date', label: 'Date' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'amount', label: 'Amount' },
      { key: 'cur', label: 'Currency' },
      { key: 'expType', label: 'Expense Type' },
      { key: 'paid', label: 'Status' },
      { key: 'comments', label: 'Comments' },
    ];
    const data = filtered.map(x => ({
      ...x,
      supplier: resolveSupplier(x.supplier),
      cur: getCurrency(settings, x.cur),
      expType: resolveExpType(x.expType),
      paid: resolvePaid(x.paid),
    }));
    exportToExcel(data, cols, 'company_expenses');
  };

  const openAdd = () => {
    setDraft({ ...EMPTY_DRAFT, id: '' });
    setModalItem({});
  };

  const openEdit = (item) => {
    setDraft({ ...EMPTY_DRAFT, ...item });
    setModalItem(item);
  };

  if (loading) return <Spinner />;
  if (error)   return <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />;

  // ─── Render item ───────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const cur = getCurrency(settings, item.cur);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => canEdit && openEdit(item)}
        onLongPress={() => canEdit && handleDelete(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.expenseName}>{item.expense || '—'}</Text>
            <Text style={styles.dateText}>{safeDate(item.date)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
            <Text style={styles.amountText}>{fmtAmount(item.amount, cur)}</Text>
            <PaidBadge resolvedPaid={resolvePaid(item.paid)} />
          </View>
        </View>
        <View style={styles.infoGrid}>
          {resolveSupplier(item.supplier) ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vendor</Text>
              <Text style={styles.infoValue}>{resolveSupplier(item.supplier)}</Text>
            </View>
          ) : null}
          {resolveExpType(item.expType) ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{resolveExpType(item.expType)}</Text>
            </View>
          ) : null}
          {item.comments ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Comments</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{item.comments}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Footer summaries ──────────────────────────────────────────────────────
  const ListFooter = () => (
    <>
      {summaryUnpaid.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary — Unpaid</Text>
          {summaryUnpaid.map((r, i) => (
            <View key={i} style={[styles.sumRow, i === summaryUnpaid.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.sumSupplier} numberOfLines={1}>{r.supplier}</Text>
              <Text style={styles.sumAmount}>{fmtAmount(r.amount, r.cur)}</Text>
            </View>
          ))}
        </View>
      )}
      {summaryAll.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary — All</Text>
          {summaryAll.map((r, i) => (
            <View key={i} style={[styles.sumRow, i === summaryAll.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.sumSupplier} numberOfLines={1}>{r.supplier}</Text>
              <Text style={styles.sumAmount}>{fmtAmount(r.amount, r.cur)}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Company Expenses" navigation={navigation} showBack />
      <DateRangeFilter
        onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
        initialYear={_cy}
      />

      {/* Search + Export + Add */}
      <View style={styles.toolRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.text2} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
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
          <Ionicons name="download-outline" size={16} color={C.accent} />
        </TouchableOpacity>
        {canEdit && (
          <TouchableOpacity style={[styles.iconBtn, styles.addBtn]} onPress={openAdd}>
            <Ionicons name="add" size={18} color={C.text1} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chipsContent}>
        {STATUS_CHIPS.map(chip => (
          <TouchableOpacity
            key={chip}
            style={[styles.chip, statusFilter === chip && styles.chipActive]}
            onPress={() => setStatusFilter(chip)}
          >
            <Text style={[styles.chipText, statusFilter === chip && styles.chipTextActive]}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.count}>{filtered.length} expenses · tap to edit · long-press to delete</Text>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.accent} />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No company expenses" subtitle="Try changing the year or filter" />}
        ListFooterComponent={<ListFooter />}
      />

      {/* ─── Add / Edit Modal ───────────────────────────────────────────────── */}
      <Modal visible={!!modalItem} transparent animationType="slide" onRequestClose={() => setModalItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{draft.id ? 'Edit Expense' : 'New Expense'}</Text>
              <TouchableOpacity onPress={() => setModalItem(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <EField label="Expense Invoice #" value={draft.expense} onChange={v => setDraft(d => ({ ...d, expense: v }))} />
              <EField label="Date (YYYY-MM-DD)" value={draft.date} onChange={v => setDraft(d => ({ ...d, date: v }))} placeholder="2024-01-15" />
              <EField label="Amount" value={draft.amount} onChange={v => setDraft(d => ({ ...d, amount: v }))} keyboardType="decimal-pad" />
              {supplierOptions.length > 0
                ? <PickerRow label="Vendor" value={draft.supplier} options={supplierOptions} onSelect={v => setDraft(d => ({ ...d, supplier: v }))} />
                : <EField label="Vendor" value={draft.supplier} onChange={v => setDraft(d => ({ ...d, supplier: v }))} />}
              {expTypeOptions.length > 0
                ? <PickerRow label="Expense Type" value={draft.expType} options={expTypeOptions} onSelect={v => setDraft(d => ({ ...d, expType: v }))} />
                : <EField label="Expense Type" value={draft.expType} onChange={v => setDraft(d => ({ ...d, expType: v }))} />}
              {curOptions.length > 0
                ? <PickerRow label="Currency" value={draft.cur} options={curOptions} onSelect={v => setDraft(d => ({ ...d, cur: v }))} />
                : <EField label="Currency" value={draft.cur} onChange={v => setDraft(d => ({ ...d, cur: v }))} />}
              {paidOptions.length > 0
                ? <PickerRow label="Payment Status" value={draft.paid} options={paidOptions} onSelect={v => setDraft(d => ({ ...d, paid: v }))} />
                : <EField label="Payment Status" value={draft.paid} onChange={v => setDraft(d => ({ ...d, paid: v }))} />}
              <EField label="Comments" value={draft.comments} onChange={v => setDraft(d => ({ ...d, comments: v }))} />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalItem(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  toolRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 6, gap: 8 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 40,
    backgroundColor: C.bg2, borderRadius: 999, borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: C.text1 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: C.bg2, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  addBtn: { backgroundColor: C.accent, borderColor: C.accent },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 2, gap: 6, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 3, height: 26,
    justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2,
  },
  chipActive: { backgroundColor: C.accent, borderColor: '#103a7a' },
  chipText: { fontSize: 11, fontWeight: '600', color: C.text2 },
  chipTextActive: { color: C.text1 },
  count: { paddingHorizontal: 16, fontSize: 11, color: C.text2, marginTop: 4, marginBottom: 2 },
  list: { padding: 12, gap: 10 },

  card: {
    backgroundColor: C.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, padding: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  expenseName: { fontSize: 13, fontWeight: '700', color: C.text1 },
  dateText: { fontSize: 11, color: C.text2, marginTop: 2 },
  amountText: { fontSize: 14, fontWeight: '800', color: C.danger, marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  badgePaid: { backgroundColor: C.successDim, borderColor: C.success },
  badgeUnpaid: { backgroundColor: C.warningDim, borderColor: C.warning },
  badgeText: { fontSize: 10, fontWeight: '600' },
  badgeTextPaid: { color: C.success },
  badgeTextUnpaid: { color: C.warning },
  infoGrid: { gap: 5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoLabel: { fontSize: 10, color: C.text2, fontWeight: '600', textTransform: 'uppercase', flex: 1 },
  infoValue: { fontSize: 11, color: C.text1, fontWeight: '500', flex: 2, textAlign: 'right', marginLeft: 8 },

  summaryCard: {
    marginTop: 10, backgroundColor: C.bg2,
    borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14,
  },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: C.text1, marginBottom: 10 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  sumSupplier: { fontSize: 12, color: C.text1, fontWeight: '500', flex: 1, marginRight: 8 },
  sumAmount: { fontSize: 12, fontWeight: '700', color: C.danger },

  handle: { width: 36, height: 4, backgroundColor: C.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text1 },
  modalBody: { padding: 16 },
  modalActions: { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#e3f0fb' },
  cancelBtn: { flex: 1, height: 44, borderRadius: 999, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: C.text2, fontWeight: '600' },
  saveBtn: { flex: 2, height: 44, borderRadius: 999, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14, color: C.text1, fontWeight: '700' },

  mFieldWrap: { marginBottom: 14 },
  mFieldLabel: { fontSize: 11, color: C.text2, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
  mInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13, color: C.text1, backgroundColor: C.bg2,
  },
  pickerChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2,
  },
  pickerChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  pickerChipText: { fontSize: 12, color: C.text2, fontWeight: '600' },
  pickerChipTextActive: { color: C.text1 },
});
