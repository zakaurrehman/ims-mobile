// Accounting screen — matches web's accounting/page.js
// Added: Purchase rows from contracts, icons on summary, recent sections, settings dropdowns
import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData, loadDataSettings, saveDataDoc } from '../../shared/utils/firestore';
import { usePermission } from '../../shared/hooks/usePermission';
import { useToast } from '../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../shared/utils/haptics';
import { formatCurrency, safeDate, getName } from '../../shared/utils/helpers';
import { exportToExcel } from '../../shared/utils/exportUtils';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import AppHeader from '../../components/AppHeader';
import DateRangeFilter from '../../components/DateRangeFilter';
import { COLLECTIONS } from '../../constants/collections';
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';


const compactCurrency = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

// ─── Exact port of web's mergeArrays() ────────────────────────────────────────
const sortArr = (arr, key) =>
  [...arr].sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || '')));

const mergeArrays = (invArr, expArr) => {
  const expenseMap = expArr.reduce((acc, expense) => {
    const key = String(expense.invoice || '');
    if (!acc[key]) acc[key] = [];
    acc[key].push(expense);
    return acc;
  }, {});

  let mergedArray = invArr.map(invoice => {
    const expenseList = expenseMap[String(invoice.invoice || '')];
    if (expenseList && expenseList.length > 0) {
      const expense = expenseList.shift();
      return { ...invoice, ...expense };
    }
    return invoice;
  });

  Object.values(expenseMap).forEach(expenseList => {
    expenseList.forEach(expense => {
      mergedArray.push({
        ...{ num: null, dateInv: null, saleInvoice: null, clientInv: null, amountInv: null, invType: null },
        ...expense,
      });
    });
  });

  let i = 1;
  mergedArray = sortArr(mergedArray, 'invoice').map((item, k, array) => {
    const prev = array[k - 1];
    const numb = k === 0 ? i :
      String(item.invoice) === String(prev?.invoice) ? i : i + 1;
    if (String(item.invoice) !== String(prev?.invoice) && k !== 0) i++;
    const span = String(item.invoice) !== String(prev?.invoice)
      ? mergedArray.filter(z => String(z.invoice) === String(item.invoice)).length
      : null;
    return span === null ? { ...item, num: numb } : { ...item, num: numb, span };
  });

  const lt = ['dateInv', 'saleInvoice', 'clientInv', 'amountInv', 'invType',
    'dateExp', 'expInvoice', 'clientExp', 'amountExp', 'expType'];
  mergedArray.forEach(obj => {
    lt.forEach(key => { if (!(key in obj)) obj[key] = ''; });
  });

  return mergedArray;
};

const getPrefix = x =>
  (x.invType === '1111' || x.invType === 'Invoice') ? '' :
  (x.invType === '2222' || x.invType === 'Credit Note') ? 'CN' : 'FN';

const getPrefixFull = x =>
  (x.invType === '1111' || x.invType === 'Invoice') ? 'Sales Invoice' :
  (x.invType === '2222' || x.invType === 'Credit Note') ? 'Credit Note' : 'Final Note';

// ─── Picker row for edit modal ─────────────────────────────────────────────────
const PickerRow = ({ label, value, options, onSelect }) => (
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

// ─── Edit modal field ──────────────────────────────────────────────────────────
const EField = ({ label, value, onChange, keyboardType = 'default' }) => (
  <View style={styles.mFieldWrap}>
    <Text style={styles.mFieldLabel}>{label}</Text>
    <TextInput
      style={styles.mFieldInput}
      value={String(value ?? '')}
      onChangeText={onChange}
      keyboardType={keyboardType}
      placeholderTextColor={C.text3}
    />
  </View>
);

export default function AccountingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection } = UserAuth();
  const { canEdit } = usePermission();
  const { setToast } = useToast();
  const [data, setData] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const _cy = new Date().getFullYear();
  const [dateRange, setDateRange] = useState({ start: `${_cy}-01-01`, end: `${_cy}-12-31` });
  const dateSelect = dateRange;
  const year = dateRange.start?.substring(0, 4) || String(_cy);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!uidCollection) return;
    try {
      const [invoiceDocs, expenseDocs, contractDocs, settingsData] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
        loadData(uidCollection, COLLECTIONS.EXPENSES, dateSelect),
        loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
        loadDataSettings(uidCollection, 'settings'),
      ]);

      setSettings(settingsData || {});

      const invArr = invoiceDocs.map(l => ({
        dateInv: safeDate(l.final ? l.date : (l.dateRange?.endDate || l.date)),
        saleInvoice: (l.invoice || '') + getPrefix(l),
        clientInv: l.client?.id || l.client || '',
        clientInvName: l.client?.nname || l.client || '',
        amountInv: l.totalAmount || 0,
        invType: getPrefixFull(l),
        invoice: l.invoice || '',
        curINV: l.cur?.cur || l.cur || 'USD',
        invoiceId: l.id || '',
        invoiceDate: safeDate(l.dateRange?.startDate || l.date),
      }));

      // Standalone expenses
      const expArr = expenseDocs.map(l => ({
        dateExp: safeDate(l.dateRange?.endDate || l.date),
        expInvoice: l.expense || '',
        clientExp: l.supplier?.id || l.supplier || '',
        clientExpName: l.supplier?.nname || '',
        amountExp: l.amount || 0,
        expType: l.expType || 'Expense',
        invoice: String(l.salesInv || l.invoice || '').replace(/\D/g, ''),
        curEX: l.cur?.cur || l.cur || 'USD',
        expenseId: l.id || '',
        expenseDate: safeDate(l.dateRange?.startDate || l.date),
      }));

      // Purchase rows from contracts (poInvoices matched to sale invoices)
      const saleInvoiceSet = new Set(invArr.map(x => x.saleInvoice));
      const purchaseArr = [];
      contractDocs.forEach(contract => {
        (contract.poInvoices || []).forEach(poInvoice => {
          (poInvoice.invRef || []).forEach(ref => {
            if (saleInvoiceSet.has(ref)) {
              purchaseArr.push({
                dateExp: safeDate(contract.dateRange?.endDate || contract.date),
                expInvoice: poInvoice.inv || '',
                clientExp: contract.supplier?.id || contract.supplier || '',
                clientExpName: contract.supplier?.nname || getName(settingsData, 'Supplier', contract.supplier) || '',
                amountExp: poInvoice.invValue || poInvoice.pmnt || 0,
                expType: 'Purchase',
                invoice: String(ref).replace(/\D/g, ''),
                curEX: contract.cur?.cur || contract.cur || 'USD',
              });
            }
          });
        });
      });

      const allExpArr = sortArr([...expArr, ...purchaseArr], 'invoice');
      const merged = mergeArrays(invArr, allExpArr);
      setData(merged);
    } catch (e) {
      console.error('AccountingScreen:', e);
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [uidCollection, dateRange]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ─── Monthly data for chart ────────────────────────────────────────────────
  // ─── Filter chain ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = data;
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(x =>
        (x.saleInvoice || '').toLowerCase().includes(q) ||
        (x.expInvoice || '').toLowerCase().includes(q) ||
        (x.clientInvName || '').toLowerCase().includes(q) ||
        (x.clientExpName || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [data, search]);

  const totalIncome = filtered.reduce((s, x) => s + (Number(x.amountInv) || 0), 0);
  const totalExpense = filtered.reduce((s, x) => s + (Number(x.amountExp) || 0), 0);
  const balance = totalIncome - totalExpense;
  const savings = balance > 0 ? balance * 0.2 : 0;


  // ─── Recent data ───────────────────────────────────────────────────────────
  const recentTransactions = useMemo(() => data.slice(0, 5), [data]);
  const recentInvoices = useMemo(() => data.filter(x => x.saleInvoice).slice(0, 4), [data]);

  // ─── Settings options for edit modal ──────────────────────────────────────
  const supplierOptions = useMemo(() =>
    (settings?.Supplier?.Supplier || []).map(s => ({ value: s.id, label: s.nname })),
    [settings]);
  const expTypeOptions = useMemo(() =>
    (settings?.Expenses?.Expenses || []).map(e => ({ value: e.id || e.expType, label: e.expType })),
    [settings]);

  // ─── Excel export ──────────────────────────────────────────────────────────
  const handleExport = async () => {
    const columns = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Exp Date', key: 'dateExp', width: 12 },
      { header: 'Expense Inv', key: 'expInvoice', width: 16 },
      { header: 'Supplier', key: 'clientExpName', width: 20 },
      { header: 'Exp Amount', key: 'amountExp', width: 14 },
      { header: 'Exp Type', key: 'expType', width: 14 },
      { header: 'Inv Date', key: 'dateInv', width: 12 },
      { header: 'Sale Invoice', key: 'saleInvoice', width: 16 },
      { header: 'Consignee', key: 'clientInvName', width: 20 },
      { header: 'Inv Amount', key: 'amountInv', width: 14 },
      { header: 'Inv Type', key: 'invType', width: 14 },
    ];
    await exportToExcel(filtered, columns, `Accounting_${year}`);
  };

  // ─── Inline edit ───────────────────────────────────────────────────────────
  const openEdit = (item, rowIndex) => {
    if (item.expType === 'Purchase') return; // purchases are read-only
    setEditItem({ rowIndex, item });
    setEditDraft({
      expInvoice: item.expInvoice || '',
      amountExp: String(item.amountExp || ''),
      expType: item.expType || '',
      clientExp: item.clientExp || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const { item, rowIndex } = editItem;
      const supplierName = supplierOptions.find(s => s.value === editDraft.clientExp)?.label || editDraft.clientExp;
      const patch = {
        ...item,
        expInvoice: editDraft.expInvoice,
        amountExp: parseFloat(editDraft.amountExp) || 0,
        expType: editDraft.expType,
        clientExp: editDraft.clientExp,
        clientExpName: supplierName,
      };

      if (item.expenseId && item.expenseDate) {
        const yr = (item.expenseDate || '').substring(0, 4) || String(year);
        await saveDataDoc(uidCollection, COLLECTIONS.EXPENSES, yr, item.expenseId, {
          expense: editDraft.expInvoice,
          amount: parseFloat(editDraft.amountExp) || 0,
          expType: editDraft.expType,
          supplier: editDraft.clientExp,
        });
      }

      setData(prev => prev.map((x, i) => i === rowIndex ? patch : x));
      setEditItem(null);
      hapticSuccess();
      setToast({ text: 'Expense row updated.', clr: 'success' });
    } catch (e) {
      hapticWarning();
      setToast({ text: 'Failed to save changes.', clr: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.row}
      onLongPress={() => canEdit && openEdit(item, index)}
      activeOpacity={0.8}
    >
      <View style={styles.col}>
        <Text style={styles.colLabel}>Invoice</Text>
        <Text style={styles.colMain} numberOfLines={1}>{item.saleInvoice || '—'}</Text>
        <Text style={styles.colSub} numberOfLines={1}>{item.clientInvName || ''}</Text>
        <Text style={styles.colDate}>{safeDate(item.dateInv)}</Text>
        {item.amountInv ? (
          <Text style={styles.income}>{formatCurrency(Number(item.amountInv), item.curINV || 'USD')}</Text>
        ) : null}
        {item.invType ? <Text style={styles.typeBadge}>{item.invType}</Text> : null}
      </View>

      <View style={styles.separator} />

      <View style={styles.col}>
        <Text style={styles.colLabel}>Expense</Text>
        <Text style={styles.colMain} numberOfLines={1}>{item.expInvoice || '—'}</Text>
        <Text style={styles.colSub} numberOfLines={1}>{item.clientExpName || ''}</Text>
        <Text style={styles.colDate}>{safeDate(item.dateExp)}</Text>
        {item.amountExp ? (
          <Text style={styles.expense}>{formatCurrency(Number(item.amountExp), item.curEX || 'USD')}</Text>
        ) : null}
        {item.expType ? (
          <Text style={[styles.expTypeBadge, item.expType === 'Purchase' && { color: C.warning }]}>
            {item.expType}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Accounting" navigation={navigation} showBack />

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item, i) => `${item.invoice || ''}-${i}`}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No accounting entries" subtitle="Try changing the year or month filter" />}
        ListHeaderComponent={
          <>
            <DateRangeFilter
              onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
              initialYear={_cy}
            />

            {/* Search + Export */}
            <View style={styles.toolRow}>
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={16} color={C.text2} style={styles.searchIcon} />
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
              <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
                <Ionicons name="download-outline" size={16} color={C.accent} />
              </TouchableOpacity>
            </View>

            {/* KPI Summary */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryPill}>
                <Ionicons name="wallet-outline" size={14} color={C.accent} style={styles.sumIcon} />
                <Text style={[styles.summaryValue, { color: C.accent }]} numberOfLines={1}>{compactCurrency(balance)}</Text>
                <Text style={styles.summaryLabel}>Balance</Text>
              </View>
              <View style={styles.summaryPill}>
                <Ionicons name="trending-up-outline" size={14} color={C.success} style={styles.sumIcon} />
                <Text style={[styles.summaryValue, { color: C.success }]} numberOfLines={1}>{compactCurrency(totalIncome)}</Text>
                <Text style={styles.summaryLabel}>Income</Text>
              </View>
              <View style={styles.summaryPill}>
                <Ionicons name="trending-down-outline" size={14} color={C.danger} style={styles.sumIcon} />
                <Text style={[styles.summaryValue, { color: C.danger }]} numberOfLines={1}>{compactCurrency(totalExpense)}</Text>
                <Text style={styles.summaryLabel}>Expenses</Text>
              </View>
              <View style={styles.summaryPill}>
                <Ionicons name="cash-outline" size={14} color={C.success} style={styles.sumIcon} />
                <Text style={[styles.summaryValue, { color: C.success }]} numberOfLines={1}>{compactCurrency(savings)}</Text>
                <Text style={styles.summaryLabel}>Savings</Text>
              </View>
            </View>

            {/* Recent Transactions */}
            {recentTransactions.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>Recent Transactions</Text>
                {recentTransactions.map((x, i) => (
                  <View key={i} style={styles.recentRow}>
                    <View style={styles.recentLeft}>
                      <Ionicons
                        name={x.amountInv ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                        size={18}
                        color={x.amountInv ? C.success : C.danger}
                      />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.recentMain} numberOfLines={1}>
                          {x.saleInvoice || x.expInvoice || '—'}
                        </Text>
                        <Text style={styles.recentSub} numberOfLines={1}>
                          {x.clientInvName || x.clientExpName || ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.recentAmt, { color: x.amountInv ? C.success : C.danger }]}>
                      {x.amountInv
                        ? formatCurrency(Number(x.amountInv), x.curINV)
                        : formatCurrency(Number(x.amountExp), x.curEX)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Invoices Sent */}
            {recentInvoices.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>Recent Invoices Sent</Text>
                {recentInvoices.map((x, i) => (
                  <View key={i} style={styles.recentRow}>
                    <View style={styles.recentLeft}>
                      <View style={styles.invIcon}>
                        <Ionicons name="document-text-outline" size={14} color={C.accent} />
                      </View>
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.recentMain}>{x.saleInvoice}</Text>
                        <Text style={styles.recentSub} numberOfLines={1}>{x.clientInvName || ''}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.recentAmt, { color: C.accent }]}>
                        {formatCurrency(Number(x.amountInv), x.curINV)}
                      </Text>
                      <Text style={styles.recentSub}>{x.invType || ''}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.count}>{filtered.length} entries · long-press to edit</Text>
          </>
        }
      />

      {/* Edit Modal */}
      <Modal visible={!!editItem} transparent animationType="slide" onRequestClose={() => setEditItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Expense Row</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.editHint}>Invoice: {editItem?.item?.saleInvoice || editItem?.item?.invoice || '—'}</Text>
              <EField
                label="Expense Invoice #"
                value={editDraft.expInvoice}
                onChange={v => setEditDraft(d => ({ ...d, expInvoice: v }))}
              />
              <EField
                label="Amount"
                value={editDraft.amountExp}
                onChange={v => setEditDraft(d => ({ ...d, amountExp: v }))}
                keyboardType="decimal-pad"
              />
              {supplierOptions.length > 0 ? (
                <PickerRow
                  label="Supplier"
                  value={editDraft.clientExp}
                  options={supplierOptions}
                  onSelect={v => setEditDraft(d => ({ ...d, clientExp: v }))}
                />
              ) : (
                <EField
                  label="Supplier"
                  value={editDraft.clientExp}
                  onChange={v => setEditDraft(d => ({ ...d, clientExp: v }))}
                />
              )}
              {expTypeOptions.length > 0 ? (
                <PickerRow
                  label="Expense Type"
                  value={editDraft.expType}
                  options={expTypeOptions}
                  onSelect={v => setEditDraft(d => ({ ...d, expType: v }))}
                />
              ) : (
                <EField
                  label="Expense Type"
                  value={editDraft.expType}
                  onChange={v => setEditDraft(d => ({ ...d, expType: v }))}
                />
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditItem(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
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

  // Summary pills with icons
  summaryRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 10,
    backgroundColor: C.accentGlow, borderRadius: 16, borderWidth: 1,
    borderColor: C.border, padding: 10, justifyContent: 'center',
  },
  summaryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.bg2, borderRadius: 999, borderWidth: 1.5,
    borderColor: C.accentBorder, paddingHorizontal: 10, paddingVertical: 6,
    flex: 1, minWidth: 130,
  },
  sumIcon: { flexShrink: 0 },
  summaryValue: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  summaryLabel: { fontSize: 11, color: C.text2, marginLeft: 2 },

  // Recent sections
  recentSection: {
    marginBottom: 10, backgroundColor: C.bg2,
    borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12,
  },
  recentTitle: { fontSize: 12, fontWeight: '700', color: C.text1, marginBottom: 8 },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.bg2,
  },
  recentLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  recentMain: { fontSize: 12, fontWeight: '600', color: C.text1 },
  recentSub: { fontSize: 10, color: C.text2 },
  recentAmt: { fontSize: 12, fontWeight: '700' },
  invIcon: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: C.bgTertiary,
    justifyContent: 'center', alignItems: 'center',
  },

  chipsRow: { marginBottom: 8 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2,
    marginRight: 6,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 11, color: C.accent },
  chipTextActive: { color: C.text1, fontWeight: '700' },

  toolRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 40,
    backgroundColor: C.bg2, borderRadius: 999, borderWidth: 1, borderColor: C.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: C.text1 },
  exportBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg2,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  count: { fontSize: 11, color: C.text2, marginBottom: 4 },
  list: { paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  row: {
    flexDirection: 'row', backgroundColor: C.bg2,
    borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12,
  },
  col: { flex: 1, gap: 2 },
  separator: { width: 1, backgroundColor: C.bgTertiary, marginHorizontal: 10 },
  colLabel: { fontSize: 9, fontWeight: '700', color: C.text2, textTransform: 'uppercase', marginBottom: 2 },
  colMain: { fontSize: 12, fontWeight: '700', color: C.accent },
  colSub: { fontSize: 11, color: C.text1 },
  colDate: { fontSize: 10, color: C.text2 },
  income: { fontSize: 12, fontWeight: '700', color: C.success, marginTop: 2 },
  expense: { fontSize: 12, fontWeight: '700', color: C.danger, marginTop: 2 },
  typeBadge: { fontSize: 9, color: C.accent, fontWeight: '600', marginTop: 2 },
  expTypeBadge: { fontSize: 9, color: C.danger, fontWeight: '600', marginTop: 2 },

  handle: { width: 36, height: 4, backgroundColor: C.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text1 },
  modalBody: { padding: 16 },
  editHint: { fontSize: 12, color: C.text2, marginBottom: 12 },
  modalActions: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: '#e3f0fb',
  },
  cancelBtn: {
    flex: 1, height: 46, borderRadius: 12, backgroundColor: C.bgPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: C.accent },
  saveBtn: {
    flex: 1, height: 46, borderRadius: 12, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: C.text1 },
  mFieldWrap: { marginBottom: 14 },
  mFieldLabel: { fontSize: 11, color: C.text2, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  mFieldInput: {
    backgroundColor: C.bgPrimary, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text1,
  },
  pickerChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bgPrimary,
  },
  pickerChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  pickerChipText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  pickerChipTextActive: { color: C.text1 },
});
