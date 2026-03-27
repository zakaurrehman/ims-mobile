// Accounting screen — merges invoices + expenses exactly as web's mergeArrays()
// FIX C: Added bar chart, month filter chips, inline row editing, Excel export
import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, Dimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData, saveDataDoc } from '../../shared/utils/firestore';
import { usePermission } from '../../shared/hooks/usePermission';
import { useToast } from '../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../shared/utils/haptics';
import { formatCurrency } from '../../shared/utils/helpers';
import { exportToExcel } from '../../shared/utils/exportUtils';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import AppHeader from '../../components/AppHeader';
import Card from '../../components/Card';
import YearPicker from '../../components/YearPicker';
import { COLLECTIONS } from '../../constants/collections';

const SCREEN_W = Dimensions.get('window').width;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

// ─── Edit modal field ──────────────────────────────────────────────────────────
const EField = ({ label, value, onChange, keyboardType = 'default' }) => (
  <View style={styles.mFieldWrap}>
    <Text style={styles.mFieldLabel}>{label}</Text>
    <TextInput
      style={styles.mFieldInput}
      value={String(value ?? '')}
      onChangeText={onChange}
      keyboardType={keyboardType}
      placeholderTextColor="#9fb8d4"
    />
  </View>
);

export default function AccountingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection } = UserAuth();
  const { canEdit } = usePermission();
  const { setToast } = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(null); // 0-indexed, null = all
  const [editItem, setEditItem] = useState(null); // {rowIndex, item}
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const dateSelect = { start: `${year}-01-01`, end: `${year}-12-31` };

  const fetchData = async () => {
    if (!uidCollection) return;
    try {
      const [invoiceDocs, expenseDocs] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
        loadData(uidCollection, COLLECTIONS.EXPENSES, dateSelect),
      ]);

      const invArr = invoiceDocs.map(l => ({
        dateInv: l.final ? l.date : (l.dateRange?.endDate || l.date),
        saleInvoice: (l.invoice || '') + getPrefix(l),
        clientInv: l.client?.id || l.client || '',
        clientInvName: l.client?.nname || l.client || '',
        amountInv: l.totalAmount || 0,
        invType: getPrefixFull(l),
        invoice: l.invoice || '',
        curINV: l.cur?.cur || l.cur || 'USD',
        invoiceId: l.id || '',
        invoiceDate: l.dateRange?.startDate || l.date || '',
      }));

      const expArr = expenseDocs.map(l => ({
        dateExp: l.dateRange?.endDate || l.date || '',
        expInvoice: l.expense || '',
        clientExp: l.supplier?.id || l.supplier || '',
        clientExpName: l.supplier?.nname || '',
        amountExp: l.amount || 0,
        expType: l.expType || 'Expense',
        invoice: l.salesInv || l.invoice || '',
        curEX: l.cur?.cur || l.cur || 'USD',
        expenseId: l.id || '',
        expenseDate: l.dateRange?.startDate || l.date || '',
      }));

      const merged = mergeArrays(invArr, expArr);
      setData(merged);
    } catch (e) {
      console.error('AccountingScreen:', e);
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [uidCollection, year]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ─── Monthly data for chart ────────────────────────────────────────────────
  const monthlyTotals = useMemo(() => {
    const income = new Array(12).fill(0);
    const expense = new Array(12).fill(0);
    data.forEach(x => {
      const dateStr = x.dateInv || x.dateExp || '';
      const m = parseInt(dateStr.substring(5, 7), 10) - 1;
      if (m >= 0 && m < 12) {
        income[m] += Number(x.amountInv) || 0;
        expense[m] += Number(x.amountExp) || 0;
      }
    });
    return { income, expense };
  }, [data]);

  // ─── Filter chain ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = data;
    if (selectedMonth !== null) {
      const mm = String(selectedMonth + 1).padStart(2, '0');
      arr = arr.filter(x => {
        const d = x.dateInv || x.dateExp || '';
        return d.substring(5, 7) === mm;
      });
    }
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
  }, [data, selectedMonth, search]);

  const totalIncome = filtered.reduce((s, x) => s + (Number(x.amountInv) || 0), 0);
  const totalExpense = filtered.reduce((s, x) => s + (Number(x.amountExp) || 0), 0);
  const balance = totalIncome - totalExpense;
  const savings = balance > 0 ? balance * 0.2 : 0;

  // ─── Chart data ────────────────────────────────────────────────────────────
  const chartIncome = monthlyTotals.income.map(v => v / 1000); // show in K
  const chartExpense = monthlyTotals.expense.map(v => v / 1000);
  const chartMax = Math.max(...chartIncome, ...chartExpense);
  const safeIncome = chartIncome.map(v => v || 0.01);

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
    setEditItem({ rowIndex, item });
    setEditDraft({
      expInvoice: item.expInvoice || '',
      amountExp: String(item.amountExp || ''),
      expType: item.expType || '',
      clientExpName: item.clientExpName || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const { item, rowIndex } = editItem;
      const patch = {
        ...item,
        expInvoice: editDraft.expInvoice,
        amountExp: parseFloat(editDraft.amountExp) || 0,
        expType: editDraft.expType,
        clientExpName: editDraft.clientExpName,
      };

      // Persist to Firestore if we have an expenseId
      if (item.expenseId && item.expenseDate) {
        const yr = (item.expenseDate || '').substring(0, 4) || String(year);
        await saveDataDoc(uidCollection, COLLECTIONS.EXPENSES, yr, item.expenseId, {
          expense: editDraft.expInvoice,
          amount: parseFloat(editDraft.amountExp) || 0,
          expType: editDraft.expType,
        });
      }

      // Update local state
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
      {/* Invoice side */}
      <View style={styles.col}>
        <Text style={styles.colLabel}>Invoice</Text>
        <Text style={styles.colMain} numberOfLines={1}>{item.saleInvoice || '—'}</Text>
        <Text style={styles.colSub} numberOfLines={1}>{item.clientInvName || ''}</Text>
        <Text style={styles.colDate}>{item.dateInv || ''}</Text>
        {item.amountInv ? (
          <Text style={styles.income}>
            {formatCurrency(Number(item.amountInv), item.curINV || 'USD')}
          </Text>
        ) : null}
        {item.invType ? <Text style={styles.typeBadge}>{item.invType}</Text> : null}
      </View>

      <View style={styles.separator} />

      {/* Expense side */}
      <View style={styles.col}>
        <Text style={styles.colLabel}>Expense</Text>
        <Text style={styles.colMain} numberOfLines={1}>{item.expInvoice || '—'}</Text>
        <Text style={styles.colSub} numberOfLines={1}>{item.clientExpName || ''}</Text>
        <Text style={styles.colDate}>{item.dateExp || ''}</Text>
        {item.amountExp ? (
          <Text style={styles.expense}>
            {formatCurrency(Number(item.amountExp), item.curEX || 'USD')}
          </Text>
        ) : null}
        {item.expType ? <Text style={styles.expTypeBadge}>{item.expType}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Accounting" navigation={navigation} showBack />

      <FlatList
        data={filtered}
        keyExtractor={(item, i) => `${item.invoice || ''}-${i}`}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0366ae" />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No accounting entries" subtitle="Try changing the year or month filter" />}
        ListHeaderComponent={
          <>
            <YearPicker year={year} setYear={setYear} />

            {/* KPI Summary */}
            <Card style={styles.summary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={[styles.summaryValue, { color: '#16a34a' }]}>{formatCurrency(totalIncome)}</Text>
              </View>
              <View style={styles.dividerV} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={[styles.summaryValue, { color: '#dc2626' }]}>{formatCurrency(totalExpense)}</Text>
              </View>
              <View style={styles.dividerV} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Balance</Text>
                <Text style={[styles.summaryValue, { color: balance >= 0 ? '#16a34a' : '#dc2626' }]}>
                  {formatCurrency(balance)}
                </Text>
              </View>
              <View style={styles.dividerV} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Savings</Text>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>{formatCurrency(savings)}</Text>
              </View>
            </Card>

            {/* Bar Chart */}
            {chartMax > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Monthly Overview (K USD)</Text>
                <BarChart
                  data={{
                    labels: MONTHS,
                    datasets: [
                      { data: safeIncome, color: () => '#16a34a' },
                    ],
                  }}
                  width={SCREEN_W - 32}
                  height={160}
                  yAxisSuffix="K"
                  withInnerLines={false}
                  showBarTops={false}
                  fromZero
                  chartConfig={{
                    backgroundGradientFrom: '#fff',
                    backgroundGradientTo: '#fff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(3, 102, 174, ${opacity})`,
                    labelColor: () => '#9fb8d4',
                    barPercentage: 0.6,
                    propsForLabels: { fontSize: 9 },
                  }}
                  style={styles.chart}
                />
              </View>
            )}

            {/* Month filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              <TouchableOpacity
                style={[styles.chip, selectedMonth === null && styles.chipActive]}
                onPress={() => setSelectedMonth(null)}
              >
                <Text style={[styles.chipText, selectedMonth === null && styles.chipTextActive]}>All</Text>
              </TouchableOpacity>
              {MONTHS.map((m, idx) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, selectedMonth === idx && styles.chipActive]}
                  onPress={() => setSelectedMonth(selectedMonth === idx ? null : idx)}
                >
                  <Text style={[styles.chipText, selectedMonth === idx && styles.chipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Search + Export */}
            <View style={styles.toolRow}>
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={16} color="#9fb8d4" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
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
              <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
                <Ionicons name="download-outline" size={16} color="#0366ae" />
              </TouchableOpacity>
            </View>

            <Text style={styles.count}>{filtered.length} entries · long-press to edit</Text>
          </>
        }
      />

      {/* Edit Modal */}
      <Modal visible={!!editItem} transparent animationType="slide" onRequestClose={() => setEditItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Expense Row</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <Ionicons name="close" size={22} color="#103a7a" />
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
              <EField
                label="Expense Type"
                value={editDraft.expType}
                onChange={v => setEditDraft(d => ({ ...d, expType: v }))}
              />
              <EField
                label="Supplier"
                value={editDraft.clientExpName}
                onChange={v => setEditDraft(d => ({ ...d, clientExpName: v }))}
              />
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
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  summary: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, padding: 14, justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 11, color: '#9fb8d4', marginBottom: 4 },
  summaryValue: { fontSize: 12, fontWeight: '700' },
  dividerV: { width: 1, backgroundColor: '#b8ddf8', marginVertical: 4 },
  chartCard: {
    marginHorizontal: 12, marginBottom: 8, backgroundColor: '#fff',
    borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8', paddingTop: 12, overflow: 'hidden',
  },
  chartTitle: { fontSize: 12, fontWeight: '600', color: '#103a7a', paddingHorizontal: 14, marginBottom: 4 },
  chart: { borderRadius: 14 },
  chipsRow: { paddingHorizontal: 12, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: '#b8ddf8', backgroundColor: '#fff',
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#0366ae', borderColor: '#0366ae' },
  chipText: { fontSize: 12, color: '#0366ae' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  toolRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 4, gap: 8 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 40,
    backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: '#b8ddf8',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#103a7a' },
  exportBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#b8ddf8', alignItems: 'center', justifyContent: 'center',
  },
  count: { paddingHorizontal: 16, fontSize: 11, color: '#9fb8d4', marginBottom: 4 },
  list: { padding: 12, gap: 10 },
  row: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8', padding: 12,
  },
  col: { flex: 1, gap: 2 },
  separator: { width: 1, backgroundColor: '#e3f0fb', marginHorizontal: 10 },
  colLabel: { fontSize: 9, fontWeight: '700', color: '#9fb8d4', textTransform: 'uppercase', marginBottom: 2 },
  colMain: { fontSize: 12, fontWeight: '700', color: '#0366ae' },
  colSub: { fontSize: 11, color: '#103a7a' },
  colDate: { fontSize: 10, color: '#9fb8d4' },
  income: { fontSize: 12, fontWeight: '700', color: '#16a34a', marginTop: 2 },
  expense: { fontSize: 12, fontWeight: '700', color: '#dc2626', marginTop: 2 },
  typeBadge: { fontSize: 9, color: '#0366ae', fontWeight: '600', marginTop: 2 },
  expTypeBadge: { fontSize: 9, color: '#dc2626', fontWeight: '600', marginTop: 2 },
  empty: { textAlign: 'center', color: '#9fb8d4', marginTop: 40, fontSize: 14 },
  // Edit modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#e3f0fb',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#103a7a' },
  modalBody: { padding: 16 },
  editHint: { fontSize: 12, color: '#9fb8d4', marginBottom: 12 },
  modalActions: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: '#e3f0fb',
  },
  cancelBtn: {
    flex: 1, height: 46, borderRadius: 12, backgroundColor: '#f0f8ff',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#0366ae' },
  saveBtn: {
    flex: 1, height: 46, borderRadius: 12, backgroundColor: '#0366ae',
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  mFieldWrap: { marginBottom: 14 },
  mFieldLabel: { fontSize: 11, color: '#9fb8d4', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  mFieldInput: {
    backgroundColor: '#f0f8ff', borderRadius: 10, borderWidth: 1, borderColor: '#b8ddf8',
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#103a7a',
  },
});
