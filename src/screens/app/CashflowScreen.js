import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../shared/firebase';
import { UserAuth } from '../../contexts/AuthContext';
import {
  loadData, loadAllStockData, loadMargins,
  loadDataSettings, saveDataSettings,
} from '../../shared/utils/firestore';
import { getName } from '../../shared/utils/helpers';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import YearPicker from '../../components/YearPicker';
import { COLLECTIONS } from '../../constants/collections';
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sumPayments = (pmts) => (pmts || []).reduce((s, p) => s + (parseFloat(p.pmnt) || 0), 0);

const fmtUSD = (n) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(Number(n) || 0);

const isUnpaidExpense = (exp, settings) => {
  const label = (getName(settings, 'ExpPmnt', exp.paid, 'paid') || '').toLowerCase();
  return !label || label.includes('un') || exp.paid === '222' || !label.includes('paid');
};

// ─── Section component ────────────────────────────────────────────────────────
function Section({ title, icon, color, total, badge, defaultOpen, onSortAmt, onSortName, sortAmt, sortName, children }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <View style={[styles.sectionIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={17} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={[styles.sectionTotal, { color }]}>{fmtUSD(total)}</Text>
        </View>
        {badge ? <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{badge}</Text></View> : null}
        {onSortAmt && (
          <TouchableOpacity onPress={onSortAmt} style={styles.sortBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={sortAmt ? 'arrow-down-outline' : 'arrow-up-outline'} size={13} color={C.text2} />
          </TouchableOpacity>
        )}
        {onSortName && (
          <TouchableOpacity onPress={onSortName} style={styles.sortBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={sortName ? 'text-outline' : 'text'} size={13} color={C.text2} />
          </TouchableOpacity>
        )}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={C.text2} />
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function DetailRow({ label, value, color, onPress, checked }) {
  return (
    <TouchableOpacity style={styles.detailRow} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      {checked !== undefined && (
        <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
          {checked && <Ionicons name="checkmark" size={10} color={C.text1} />}
        </View>
      )}
      <Text style={styles.detailLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.detailValue, color && { color }]}>{fmtUSD(value)}</Text>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CashflowScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings, userTitle } = UserAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [multiYear, setMultiYear] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Raw data
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [rawStocks, setRawStocks] = useState([]);
  const [marginsMonths, setMarginsMonths] = useState([]);

  // Cashflow settings (initial + financed)
  const [initialData, setInitialData] = useState([]);
  const [financedLeft, setFinancedLeft] = useState([]);
  const [financedRight, setFinancedRight] = useState([]);
  const [savingInit, setSavingInit] = useState(false);
  const [initDirty, setInitDirty] = useState(false);

  // Sort states (true = desc by amount)
  const [recSort, setRecSort] = useState(true);
  const [recNameSort, setRecNameSort] = useState(false);
  const [paySort, setPaySort] = useState(true);
  const [payNameSort, setPayNameSort] = useState(false);
  const [expSort, setExpSort] = useState(true);
  const [expNameSort, setExpNameSort] = useState(false);
  const [stkSort, setStkSort] = useState(true);

  // Payment modal (CF3: invoice preview + payment recording)
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentPct, setPaymentPct] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // CF1: Contract drill-down modal
  const [contractModal, setContractModal] = useState(null);
  // CF2: Expense drill-down modal
  const [expenseModal, setExpenseModal] = useState(null);

  const dateSelect = multiYear
    ? { start: `${year - 1}-01-01`, end: `${year}-12-31` }
    : { start: `${year}-01-01`, end: `${year}-12-31` };

  // ─── Load all data ──────────────────────────────────────────────────────────
  const load = async () => {
    if (!uidCollection) return;
    try {
      setError(null);
      const [invs, exps, cons, stocks, margins, cfSettings] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
        loadData(uidCollection, COLLECTIONS.EXPENSES, dateSelect),
        loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
        loadAllStockData(uidCollection),
        loadMargins(uidCollection, year),
        loadDataSettings(uidCollection, 'cashflow'),
      ]);
      setInvoices(invs || []);
      setExpenses(exps || []);
      setContracts(cons || []);
      setRawStocks(stocks || []);
      setMarginsMonths(margins || []);
      setInitialData(cfSettings?.financed?.initial || []);
      setFinancedLeft(cfSettings?.financed?.financedLeft || []);
      setFinancedRight(cfSettings?.financed?.financedRight || []);
      setInitDirty(false);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, year, multiYear]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // ─── Computed: client receivables (grouped by client, split partial/debt) ──
  const { clientPartial, clientDebt } = useMemo(() => {
    const rows = (invoices || [])
      .filter(inv => !inv.canceled)
      .map(inv => {
        const paid = sumPayments(inv.payments);
        const balance = (parseFloat(inv.totalAmount) || 0) - paid;
        if (balance < 0.01) return null;
        return {
          id: inv.id,
          date: inv.date,
          label: `${getName(settings, 'Client', inv.client) || '—'} · ${inv.invoice || ''}`,
          clientName: getName(settings, 'Client', inv.client) || '—',
          balance,
          hasPmnt: (inv.payments || []).length > 0,
          currency: getName(settings, 'Currency', inv.cur, 'cur') || 'USD',
          inv,
        };
      })
      .filter(Boolean);
    return {
      clientPartial: rows.filter(x => x.hasPmnt),
      clientDebt: rows.filter(x => !x.hasPmnt),
    };
  }, [invoices, settings]);

  // ─── Computed: supplier payables ────────────────────────────────────────────
  const supplierPayables = useMemo(() => (contracts || []).map(c => {
    const purchaseValue = (c.productsData || []).reduce(
      (s, p) => s + (parseFloat(p.qnty) || 0) * (parseFloat(p.unitPrc) || 0), 0
    );
    const contractInvoices = (invoices || []).filter(inv => inv.poSupplier?.id === c.id && !inv.canceled);
    const paidToSupplier = contractInvoices.reduce((s, inv) => s + sumPayments(inv.payments), 0);
    const balance = purchaseValue - paidToSupplier;
    if (balance < 0.01) return null;
    return {
      label: `${getName(settings, 'Supplier', c.supplier) || '—'} · PO#${c.order || ''}`,
      supplierName: getName(settings, 'Supplier', c.supplier) || '—',
      balance,
      currency: getName(settings, 'Currency', c.cur, 'cur') || 'USD',
      contractId: c.id,
    };
  }).filter(Boolean), [contracts, invoices, settings]);

  // ─── Computed: pending expenses ──────────────────────────────────────────────
  const expensesPending = useMemo(() => (expenses || [])
    .filter(exp => isUnpaidExpense(exp, settings))
    .map(exp => ({
      id: exp.id,
      date: exp.date,
      label: `${getName(settings, 'Supplier', exp.supplier) || '—'} · ${exp.expense || ''}`,
      supplierName: getName(settings, 'Supplier', exp.supplier) || '—',
      amount: parseFloat(exp.amount) || 0,
      currency: getName(settings, 'Currency', exp.cur, 'cur') || 'USD',
    })), [expenses, settings]);

  // ─── Computed: stocks ────────────────────────────────────────────────────────
  const stocksSummary = useMemo(() => {
    const map = {};
    for (const s of rawStocks) {
      if (!s.stock || !s.qnty) continue;
      const qty = parseFloat(s.qnty) || 0;
      const price = parseFloat(s.unitPrc) || 0;
      const val = qty * price;
      if (!map[s.stock]) map[s.stock] = { stockId: s.stock, value: 0 };
      map[s.stock].value += val;
    }
    return Object.values(map);
  }, [rawStocks]);

  // ─── Computed: unsold stocks ─────────────────────────────────────────────────
  const unsoldBySupplier = useMemo(() => {
    const stockInIds = new Set(
      rawStocks.filter(s => s.type === 'in').map(s => s.description).filter(Boolean)
    );
    const unsoldItems = contracts.flatMap(c =>
      (c.productsData || [])
        .filter(p => !p.import && !stockInIds.has(p.id))
        .map(p => ({
          supplierId: c.supplier,
          supplierName: getName(settings, 'Supplier', c.supplier) || '—',
          order: c.order || '',
          description: p.description || p.id || '—',
          qnty: parseFloat(p.qnty) || 0,
          unitPrc: parseFloat(p.unitPrc) || 0,
          total: (parseFloat(p.qnty) || 0) * (parseFloat(p.unitPrc) || 0),
          cur: getName(settings, 'Currency', c.cur, 'cur') || 'USD',
        }))
    );
    const grouped = {};
    for (const item of unsoldItems) {
      if (!grouped[item.supplierId]) {
        grouped[item.supplierId] = { supplierName: item.supplierName, items: [], total: 0 };
      }
      grouped[item.supplierId].items.push(item);
      grouped[item.supplierId].total += item.total;
    }
    return Object.values(grouped);
  }, [contracts, rawStocks, settings]);

  // ─── Computed: margins incoming (Future) ─────────────────────────────────────
  const marginsIncoming = useMemo(() =>
    marginsMonths.reduce((s, m) => s + (parseFloat(m.remaining) || 0), 0),
    [marginsMonths]);

  // ─── Computed: totals ────────────────────────────────────────────────────────
  const totalIncoming = useMemo(() => {
    const initSum = initialData.reduce((s, x) => s + (parseFloat(x.num) || 0), 0);
    const flSum = financedLeft.reduce((s, x) => s + (parseFloat(x.num) || 0), 0);
    const stocksSum = stocksSummary.reduce((s, x) => s + x.value, 0);
    const rec1 = clientPartial.reduce((s, x) => s + x.balance, 0);
    const rec2 = clientDebt.reduce((s, x) => s + x.balance, 0);
    return marginsIncoming + initSum + flSum + stocksSum + rec1 + rec2;
  }, [marginsIncoming, initialData, financedLeft, stocksSummary, clientPartial, clientDebt]);

  const totalOutgoing = useMemo(() => {
    const frSum = financedRight.reduce((s, x) => s + (parseFloat(x.num) || 0), 0);
    const supSum = supplierPayables.reduce((s, x) => s + x.balance, 0);
    const expSum = expensesPending.reduce((s, x) => s + x.amount, 0);
    return supSum + expSum + frSum;
  }, [supplierPayables, expensesPending, financedRight]);

  const netBalance = totalIncoming - totalOutgoing;

  // ─── Sort helpers ─────────────────────────────────────────────────────────────
  const sortArr = (arr, amtKey, nameKey, desc, byName) => {
    const copy = [...arr];
    if (byName) return copy.sort((a, b) => (a[nameKey] || '').localeCompare(b[nameKey] || ''));
    return copy.sort((a, b) => desc ? b[amtKey] - a[amtKey] : a[amtKey] - b[amtKey]);
  };

  const sortedPartial = sortArr(clientPartial, 'balance', 'clientName', recSort, recNameSort);
  const sortedDebt = sortArr(clientDebt, 'balance', 'clientName', recSort, recNameSort);
  const sortedPay = sortArr(supplierPayables, 'balance', 'supplierName', paySort, payNameSort);
  const sortedExp = sortArr(expensesPending, 'amount', 'supplierName', expSort, expNameSort);
  const sortedStocks = sortArr(stocksSummary, 'value', 'stockId', stkSort, false);

  // ─── Payment recording ───────────────────────────────────────────────────────
  const openPaymentModal = (inv) => {
    setPaymentModal(inv);
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentPct('');
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || !paymentDate) {
      Alert.alert('Required', 'Enter amount and date.');
      return;
    }
    setSavingPayment(true);
    try {
      const inv = paymentModal;
      const newPmts = [...(inv.payments || []), { pmnt: Number(paymentAmount), date: paymentDate }];
      const year = String(inv.date || '').substring(0, 4);
      const docRef = doc(db, uidCollection, 'data', `invoices_${year}`, inv.id);
      await updateDoc(docRef, { payments: newPmts });
      setPaymentModal(null);
      load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save payment.');
    }
    setSavingPayment(false);
  };

  // CF2: Open expense drill-down modal
  const handleMarkExpensePaid = (expense) => {
    const fullExp = expenses.find(x => x.id === expense.id) || expense;
    setExpenseModal(fullExp);
  };

  const doMarkExpensePaid = async () => {
    if (!expenseModal) return;
    Alert.alert('Mark as Paid', `Mark this expense as paid?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Paid', onPress: async () => {
          try {
            const yr = String(expenseModal.date || '').substring(0, 4);
            const docRef = doc(db, uidCollection, 'data', `expenses_${yr}`, expenseModal.id);
            await updateDoc(docRef, { paid: '111' });
            setExpenseModal(null);
            load();
          } catch (e) { Alert.alert('Error', e.message || 'Failed.'); }
        },
      },
    ]);
  };

  // CF1: Open contract drill-down
  const openContractDrilldown = (payable) => {
    const contract = contracts.find(c => c.id === payable.contractId);
    if (contract) setContractModal({ contract, payable });
  };

  // ─── Pct ↔ amount sync ───────────────────────────────────────────────────────
  const handlePctChange = (val) => {
    setPaymentPct(val);
    if (paymentModal?.balance && val) {
      setPaymentAmount(String(((parseFloat(val) || 0) * paymentModal.balance / 100).toFixed(2)));
    }
  };
  const handleAmtChange = (val) => {
    setPaymentAmount(val);
    if (paymentModal?.balance && val) {
      setPaymentPct(String(((parseFloat(val) || 0) / paymentModal.balance * 100).toFixed(2)));
    }
  };

  // ─── Initial/Financed editing ─────────────────────────────────────────────────
  const handleInitChange = (i, field, val) => {
    setInitialData(prev => prev.map((x, k) => k === i ? { ...x, [field]: val } : x));
    setInitDirty(true);
  };
  const handleFinancedChange = (side, i, field, val) => {
    if (side === 'left') setFinancedLeft(prev => prev.map((x, k) => k === i ? { ...x, [field]: val } : x));
    else setFinancedRight(prev => prev.map((x, k) => k === i ? { ...x, [field]: val } : x));
    setInitDirty(true);
  };
  const handleAddInitRow = () => { setInitialData(prev => [...prev, { title: 'New item', num: '' }]); setInitDirty(true); };
  const handleDelInitRow = (i) => { setInitialData(prev => prev.filter((_, k) => k !== i)); setInitDirty(true); };
  const handleAddFinancedRow = (side) => {
    const newRow = { title: 'New item', num: '' };
    if (side === 'left') setFinancedLeft(prev => [...prev, newRow]);
    else setFinancedRight(prev => [...prev, newRow]);
    setInitDirty(true);
  };
  const handleDelFinancedRow = (side, i) => {
    if (side === 'left') setFinancedLeft(prev => prev.filter((_, k) => k !== i));
    else setFinancedRight(prev => prev.filter((_, k) => k !== i));
    setInitDirty(true);
  };
  const handleSaveInitData = async () => {
    setSavingInit(true);
    await saveDataSettings(uidCollection, 'cashflow', {
      financed: { initial: initialData, financedLeft, financedRight },
    });
    setInitDirty(false);
    setSavingInit(false);
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Cashflow" navigation={navigation} showBack />

      {/* Year row + multi-year toggle */}
      <View style={styles.yearRow}>
        <YearPicker year={year} setYear={setYear} />
        <TouchableOpacity
          style={[styles.multiBtn, multiYear && styles.multiBtnOn]}
          onPress={() => setMultiYear(v => !v)}
        >
          <Text style={[styles.multiText, multiYear && styles.multiTextOn]}>
            {multiYear ? `${year - 1}–${year}` : `${year} only`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {['general', 'unsold'].map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'general' ? 'General' : 'Unsold Stocks'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: getBottomPad(insets) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {activeTab === 'general' ? (
          <>
            {/* Summary */}
            <View style={styles.summaryCard}>
              <SumPill label="Incoming" value={fmtUSD(totalIncoming)} color={C.success} />
              <View style={styles.summaryDivider} />
              <SumPill label="Outgoing" value={fmtUSD(totalOutgoing)} color={C.danger} />
              <View style={styles.summaryDivider} />
              <SumPill
                label="Net Balance"
                value={fmtUSD(netBalance)}
                color={netBalance >= 0 ? C.success : C.danger}
              />
            </View>

            {/* ── INCOMING SECTIONS ── */}

            {/* Future (admin only) */}
            {userTitle === 'Admin' && (
              <Section
                title="Future (Margins)"
                icon="trending-up-outline"
                color={C.purple}
                total={marginsIncoming}
                badge="Admin"
              >
                <DetailRow
                  label={`${year} remaining from margins`}
                  value={marginsIncoming}
                  color={C.purple}
                />
              </Section>
            )}

            {/* Initial data */}
            <Section
              title="Initial / Financed In"
              icon="wallet-outline"
              color={C.accent}
              total={initialData.reduce((s, x) => s + (parseFloat(x.num) || 0), 0) +
                financedLeft.reduce((s, x) => s + (parseFloat(x.num) || 0), 0)}
            >
              {initialData.map((item, i) => (
                <View key={i} style={styles.editRow}>
                  <TextInput
                    style={[styles.editInput, { flex: 2 }]}
                    value={item.title}
                    onChangeText={v => handleInitChange(i, 'title', v)}
                    placeholder="Title"
                    placeholderTextColor={C.text3}
                  />
                  <TextInput
                    style={[styles.editInput, { flex: 1 }]}
                    value={String(item.num || '')}
                    onChangeText={v => handleInitChange(i, 'num', v)}
                    placeholder="0"
                    placeholderTextColor={C.text3}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity onPress={() => handleDelInitRow(i)} style={styles.delRowBtn}>
                    <Ionicons name="close-circle-outline" size={18} color={C.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              {financedLeft.map((item, i) => (
                <View key={`fl${i}`} style={styles.editRow}>
                  <TextInput
                    style={[styles.editInput, { flex: 2 }]}
                    value={item.title}
                    onChangeText={v => handleFinancedChange('left', i, 'title', v)}
                    placeholder="Title"
                    placeholderTextColor={C.text3}
                  />
                  <TextInput
                    style={[styles.editInput, { flex: 1 }]}
                    value={String(item.num || '')}
                    onChangeText={v => handleFinancedChange('left', i, 'num', v)}
                    placeholder="0"
                    placeholderTextColor={C.text3}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity onPress={() => handleDelFinancedRow('left', i)} style={styles.delRowBtn}>
                    <Ionicons name="close-circle-outline" size={18} color={C.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.addRowBtn2} onPress={handleAddInitRow}>
                  <Ionicons name="add-outline" size={14} color={C.accent} />
                  <Text style={styles.addRowBtn2Text}>Add Initial</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addRowBtn2} onPress={() => handleAddFinancedRow('left')}>
                  <Ionicons name="add-outline" size={14} color={C.accent} />
                  <Text style={styles.addRowBtn2Text}>Add Financed</Text>
                </TouchableOpacity>
                {initDirty && (
                  <TouchableOpacity
                    style={[styles.saveInitBtn, savingInit && { opacity: 0.6 }]}
                    onPress={handleSaveInitData}
                    disabled={savingInit}
                  >
                    {savingInit
                      ? <ActivityIndicator size="small" color={C.text1} />
                      : <><Ionicons name="save-outline" size={13} color={C.text1} /><Text style={styles.saveInitText}>Save</Text></>}
                  </TouchableOpacity>
                )}
              </View>
            </Section>

            {/* Stocks */}
            <Section
              title="Stocks Value"
              icon="cube-outline"
              color={C.purple}
              total={sortedStocks.reduce((s, x) => s + x.value, 0)}
              onSortAmt={() => setStkSort(v => !v)}
              sortAmt={stkSort}
            >
              {sortedStocks.length === 0
                ? <Text style={styles.emptyRow}>No stocks data</Text>
                : sortedStocks.map((x, i) => (
                  <DetailRow
                    key={i}
                    label={getName(settings, 'Stocks', x.stockId, 'stock') || x.stockId}
                    value={x.value}
                    color={C.purple}
                  />
                ))}
            </Section>

            {/* Client invoices: partially paid */}
            <Section
              title="Receivables — Partial"
              icon="checkmark-circle-outline"
              color={C.info}
              total={sortedPartial.reduce((s, x) => s + x.balance, 0)}
              badge={`${sortedPartial.length}`}
              defaultOpen
              onSortAmt={() => setRecSort(v => !v)}
              onSortName={() => setRecNameSort(v => !v)}
              sortAmt={recSort}
              sortName={recNameSort}
            >
              {sortedPartial.length === 0
                ? <Text style={styles.emptyRow}>No partially-paid receivables</Text>
                : sortedPartial.map((x, i) => (
                  <DetailRow
                    key={i}
                    label={x.label}
                    value={x.balance}
                    color={C.info}
                    onPress={() => openPaymentModal(x.inv)}
                  />
                ))}
            </Section>

            {/* Client invoices: in debt (no payment) */}
            <Section
              title="Receivables — In Debt"
              icon="arrow-down-circle-outline"
              color={C.success}
              total={sortedDebt.reduce((s, x) => s + x.balance, 0)}
              badge={`${sortedDebt.length}`}
              defaultOpen
              onSortAmt={() => setRecSort(v => !v)}
              onSortName={() => setRecNameSort(v => !v)}
              sortAmt={recSort}
              sortName={recNameSort}
            >
              {sortedDebt.length === 0
                ? <Text style={styles.emptyRow}>No outstanding receivables</Text>
                : sortedDebt.map((x, i) => (
                  <DetailRow
                    key={i}
                    label={x.label}
                    value={x.balance}
                    color={C.success}
                    onPress={() => openPaymentModal(x.inv)}
                  />
                ))}
            </Section>

            {/* ── OUTGOING SECTIONS ── */}

            {/* Supplier payables */}
            <Section
              title="Supplier Payables"
              icon="arrow-up-circle-outline"
              color={C.danger}
              total={sortedPay.reduce((s, x) => s + x.balance, 0)}
              badge={`${sortedPay.length}`}
              onSortAmt={() => setPaySort(v => !v)}
              onSortName={() => setPayNameSort(v => !v)}
              sortAmt={paySort}
              sortName={payNameSort}
            >
              {sortedPay.length === 0
                ? <Text style={styles.emptyRow}>No outstanding payables</Text>
                : sortedPay.map((x, i) => (
                  <DetailRow key={i} label={x.label} value={x.balance} color={C.danger}
                    onPress={() => openContractDrilldown(x)} />
                ))}
            </Section>

            {/* Pending expenses */}
            <Section
              title="Pending Expenses"
              icon="receipt-outline"
              color={C.warning}
              total={sortedExp.reduce((s, x) => s + x.amount, 0)}
              badge={`${sortedExp.length}`}
              onSortAmt={() => setExpSort(v => !v)}
              onSortName={() => setExpNameSort(v => !v)}
              sortAmt={expSort}
              sortName={expNameSort}
            >
              {sortedExp.length === 0
                ? <Text style={styles.emptyRow}>No pending expenses</Text>
                : sortedExp.map((x, i) => (
                  <DetailRow
                    key={i}
                    label={x.label}
                    value={x.amount}
                    color={C.warning}
                    onPress={() => handleMarkExpensePaid(x)}
                  />
                ))}
            </Section>

            {/* Financed outgoing */}
            {financedRight.length > 0 && (
              <Section
                title="Financed Out"
                icon="arrow-forward-circle-outline"
                color={C.danger}
                total={financedRight.reduce((s, x) => s + (parseFloat(x.num) || 0), 0)}
              >
                {financedRight.map((item, i) => (
                  <View key={i} style={styles.editRow}>
                    <TextInput
                      style={[styles.editInput, { flex: 2 }]}
                      value={item.title}
                      onChangeText={v => handleFinancedChange('right', i, 'title', v)}
                      placeholder="Title"
                      placeholderTextColor={C.text3}
                    />
                    <TextInput
                      style={[styles.editInput, { flex: 1 }]}
                      value={String(item.num || '')}
                      onChangeText={v => handleFinancedChange('right', i, 'num', v)}
                      placeholder="0"
                      placeholderTextColor={C.text3}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => handleDelFinancedRow('right', i)} style={styles.delRowBtn}>
                      <Ionicons name="close-circle-outline" size={18} color={C.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.addRowBtn2} onPress={() => handleAddFinancedRow('right')}>
                    <Ionicons name="add-outline" size={14} color={C.accent} />
                    <Text style={styles.addRowBtn2Text}>Add Row</Text>
                  </TouchableOpacity>
                </View>
              </Section>
            )}
            {financedRight.length === 0 && (
              <TouchableOpacity style={styles.addFinancedOutBtn} onPress={() => handleAddFinancedRow('right')}>
                <Ionicons name="add-circle-outline" size={15} color={C.accent} />
                <Text style={styles.addFinancedOutText}>Add Financed Out Row</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          /* ── UNSOLD STOCKS TAB ── */
          <>
            <View style={styles.unsoldHeader}>
              <Ionicons name="cube-outline" size={16} color={C.accent} />
              <Text style={styles.unsoldHeaderText}>
                Contract products not yet in stock movements
              </Text>
            </View>
            {unsoldBySupplier.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color={C.text2} />
                <Text style={styles.emptyStateText}>No unsold stock items</Text>
              </View>
            ) : (
              unsoldBySupplier.map((sup, si) => (
                <Section
                  key={si}
                  title={sup.supplierName}
                  icon="business-outline"
                  color={C.accent}
                  total={sup.total}
                >
                  {sup.items.map((item, ii) => (
                    <DetailRow
                      key={ii}
                      label={`PO#${item.order} · ${item.description}`}
                      value={item.total}
                      color={C.accent}
                    />
                  ))}
                </Section>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ─── Payment Modal ─────────────────────────────────────────────────── */}
      <Modal visible={!!paymentModal} animationType="slide" transparent onRequestClose={() => setPaymentModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setPaymentModal(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={[styles.modalBody, { maxHeight: 560 }]}>
              {paymentModal && (
                <>
                  {/* CF3: Invoice preview */}
                  <View style={styles.invPreview}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payLabel}>INV# {String(paymentModal.invoice || '').padStart(4, '0')}</Text>
                      <Text style={styles.invPreviewClient}>{getName(settings, 'Client', paymentModal.client)}</Text>
                      <Text style={styles.invPreviewDate}>{paymentModal.date || ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.invPreviewAmt}>{fmtUSD(paymentModal.totalAmount)}</Text>
                      <Text style={styles.invPreviewEta}>
                        {paymentModal.shipData?.eta?.endDate ? `ETA: ${paymentModal.shipData.eta.endDate}` : ''}
                      </Text>
                    </View>
                  </View>
                  {(paymentModal.payments || []).length > 0 && (
                    <View style={styles.pmtHistory}>
                      <Text style={styles.pmtHistoryTitle}>Payment History</Text>
                      {(paymentModal.payments || []).map((p, i) => (
                        <View key={i} style={styles.pmtHistoryRow}>
                          <Text style={styles.pmtHistoryDate}>{p.date}</Text>
                          <Text style={styles.pmtHistoryAmt}>{fmtUSD(p.pmnt)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={styles.payBalance}>
                    Outstanding: {fmtUSD((parseFloat(paymentModal.totalAmount) || 0) - sumPayments(paymentModal.payments))}
                  </Text>
                  <View style={styles.payRow}>
                    <View style={[styles.payField, { flex: 1 }]}>
                      <Text style={styles.payFieldLabel}>Amount $</Text>
                      <TextInput
                        style={styles.payInput}
                        value={paymentAmount}
                        onChangeText={handleAmtChange}
                        placeholder="0.00"
                        placeholderTextColor={C.text3}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={[styles.payField, { flex: 1 }]}>
                      <Text style={styles.payFieldLabel}>Pct %</Text>
                      <TextInput
                        style={styles.payInput}
                        value={paymentPct}
                        onChangeText={handlePctChange}
                        placeholder="0.00"
                        placeholderTextColor={C.text3}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={styles.payField}>
                    <Text style={styles.payFieldLabel}>Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.payInput}
                      value={paymentDate}
                      onChangeText={setPaymentDate}
                      placeholder={new Date().toISOString().slice(0, 10)}
                      placeholderTextColor={C.text3}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.payBtn, savingPayment && { opacity: 0.6 }]}
                    onPress={handleRecordPayment}
                    disabled={savingPayment}
                  >
                    {savingPayment
                      ? <ActivityIndicator color={C.text1} size="small" />
                      : <Text style={styles.payBtnText}>Record Payment</Text>}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── CF1: Contract Drill-down Modal ────────────────────────────────── */}
      <Modal visible={!!contractModal} animationType="slide" transparent onRequestClose={() => setContractModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>PO# {contractModal?.contract?.order || '—'}</Text>
                <Text style={styles.drillSubtitle}>{contractModal?.payable?.supplierName}</Text>
              </View>
              <TouchableOpacity onPress={() => setContractModal(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {contractModal && (() => {
                const c = contractModal.contract;
                const payable = contractModal.payable;
                const purchaseTotal = (c.productsData || []).reduce(
                  (s, p) => s + (parseFloat(p.qnty) || 0) * (parseFloat(p.unitPrc) || 0), 0
                );
                return (
                  <>
                    <View style={styles.drillRow}><Text style={styles.drillLabel}>Date</Text><Text style={styles.drillValue}>{c.date || '—'}</Text></View>
                    <View style={styles.drillRow}><Text style={styles.drillLabel}>Currency</Text><Text style={styles.drillValue}>{getName(settings, 'Currency', c.cur, 'cur') || c.cur || '—'}</Text></View>
                    <View style={styles.drillRow}><Text style={styles.drillLabel}>POL → POD</Text><Text style={styles.drillValue}>{[getName(settings, 'POL', c.pol, 'pol'), getName(settings, 'POD', c.pod, 'pod')].filter(Boolean).join(' → ') || '—'}</Text></View>
                    <View style={styles.drillRow}><Text style={styles.drillLabel}>Status</Text><Text style={[styles.drillValue, { color: c.completed ? C.success : C.warning }]}>{c.completed ? 'Completed' : 'Open'}</Text></View>
                    {(c.productsData || []).length > 0 && (
                      <View style={styles.drillSection}>
                        <Text style={styles.drillSectionTitle}>Products</Text>
                        {c.productsData.map((p, i) => (
                          <View key={i} style={styles.drillProductRow}>
                            <Text style={styles.drillProductName} numberOfLines={1}>{p.description || `Product ${i + 1}`}</Text>
                            <Text style={styles.drillProductQty}>{p.qnty} MT</Text>
                            <Text style={styles.drillProductPrice}>{fmtUSD((parseFloat(p.qnty) || 0) * (parseFloat(p.unitPrc) || 0))}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={[styles.drillRow, { borderTopWidth: 1, borderTopColor: C.border2, marginTop: 4, paddingTop: 12 }]}>
                      <Text style={[styles.drillLabel, { fontWeight: '700' }]}>Purchase Total</Text>
                      <Text style={[styles.drillValue, { color: C.text1, fontWeight: '700' }]}>{fmtUSD(purchaseTotal)}</Text>
                    </View>
                    <View style={styles.drillRow}>
                      <Text style={[styles.drillLabel, { fontWeight: '700' }]}>Balance Due</Text>
                      <Text style={[styles.drillValue, { color: C.danger, fontWeight: '700' }]}>{fmtUSD(payable.balance)}</Text>
                    </View>
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── CF2: Expense Drill-down Modal ─────────────────────────────────── */}
      <Modal visible={!!expenseModal} animationType="slide" transparent onRequestClose={() => setExpenseModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Expense Detail</Text>
                <Text style={styles.drillSubtitle}>{getName(settings, 'Supplier', expenseModal?.supplier)}</Text>
              </View>
              <TouchableOpacity onPress={() => setExpenseModal(null)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {expenseModal && (
                <>
                  <View style={styles.drillRow}><Text style={styles.drillLabel}>Date</Text><Text style={styles.drillValue}>{expenseModal.date || '—'}</Text></View>
                  <View style={styles.drillRow}><Text style={styles.drillLabel}>Description</Text><Text style={styles.drillValue}>{expenseModal.expense || '—'}</Text></View>
                  <View style={styles.drillRow}><Text style={styles.drillLabel}>Amount</Text><Text style={[styles.drillValue, { color: C.warning, fontWeight: '700' }]}>{fmtUSD(expenseModal.amount)}</Text></View>
                  <View style={styles.drillRow}><Text style={styles.drillLabel}>Currency</Text><Text style={styles.drillValue}>{getName(settings, 'Currency', expenseModal.cur, 'cur') || expenseModal.cur || '—'}</Text></View>
                  {expenseModal.remarks ? <View style={styles.drillRow}><Text style={styles.drillLabel}>Remarks</Text><Text style={styles.drillValue}>{expenseModal.remarks}</Text></View> : null}
                  <View style={styles.drillRow}><Text style={styles.drillLabel}>Status</Text><Text style={[styles.drillValue, { color: C.warning }]}>Unpaid</Text></View>
                  <TouchableOpacity style={styles.markPaidBtn} onPress={doMarkExpensePaid}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={C.text1} />
                    <Text style={styles.markPaidText}>Mark as Paid</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SumPill({ label, value, color }) {
  return (
    <View style={styles.sumPill}>
      <Text style={[styles.sumPillVal, { color }]}>{value}</Text>
      <Text style={styles.sumPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },

  yearRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  multiBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border },
  multiBtnOn: { backgroundColor: C.accent, borderColor: C.accent },
  multiText: { fontSize: 11, fontWeight: '600', color: C.accent },
  multiTextOn: { color: C.text1 },

  tabRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 6, backgroundColor: C.bg2, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { backgroundColor: C.accent },
  tabText: { fontSize: 12, fontWeight: '600', color: C.text2 },
  tabTextActive: { color: C.text1 },

  scroll: { padding: 12, gap: 10 },

  summaryCard: {
    backgroundColor: C.accent, borderRadius: 16,
    flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8,
  },
  sumPill: { flex: 1, alignItems: 'center' },
  sumPillVal: { fontSize: 12, fontWeight: '800' },
  sumPillLabel: { fontSize: 8, color: C.text2, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: C.border2, marginVertical: 4 },

  section: {
    backgroundColor: C.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.text1 },
  sectionTotal: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  sectionBadge: { backgroundColor: C.bgPrimary, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  sectionBadgeText: { fontSize: 10, fontWeight: '600', color: C.accent },
  sortBtn: { padding: 2 },
  sectionBody: { borderTopWidth: 1, borderTopColor: '#EBF4FB', paddingHorizontal: 12, paddingBottom: 10, paddingTop: 6, gap: 4 },

  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.bg2, gap: 6 },
  checkBox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  checkBoxOn: { backgroundColor: C.accent, borderColor: C.accent },
  detailLabel: { flex: 1, fontSize: 11, color: C.text1 },
  detailValue: { fontSize: 11, fontWeight: '700', color: C.text1 },
  emptyRow: { fontSize: 11, color: C.text2, textAlign: 'center', paddingVertical: 8 },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  editInput: {
    backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, color: C.text1,
  },
  delRowBtn: { padding: 2 },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  addRowBtn2: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: C.bgPrimary, borderWidth: 1, borderColor: C.border },
  addRowBtn2Text: { fontSize: 11, fontWeight: '600', color: C.accent },
  saveInitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accent, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  saveInitText: { fontSize: 11, fontWeight: '700', color: C.text1 },

  addFinancedOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, justifyContent: 'center', backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  addFinancedOutText: { fontSize: 12, fontWeight: '600', color: C.accent },

  unsoldHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  unsoldHeaderText: { fontSize: 11, color: C.accent, flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyStateText: { fontSize: 13, color: C.text2 },

  handle: { width: 36, height: 4, backgroundColor: C.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.text1 },
  modalBody: { padding: 20, gap: 10, paddingBottom: 32 },
  payLabel: { fontSize: 14, fontWeight: '700', color: C.text1 },
  payBalance: { fontSize: 12, color: C.text2 },
  payRow: { flexDirection: 'row', gap: 10 },
  payField: { gap: 4 },
  payFieldLabel: { fontSize: 11, fontWeight: '700', color: C.text1, textTransform: 'uppercase' },
  payInput: { backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text1 },
  payBtn: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  payBtnText: { color: C.text1, fontSize: 15, fontWeight: '700' },

  // CF3: Invoice preview in payment modal
  invPreview: { flexDirection: 'row', backgroundColor: C.bg2, borderRadius: 12, padding: 12, marginBottom: 8 },
  invPreviewClient: { fontSize: 11, color: C.text2, marginTop: 2 },
  invPreviewDate: { fontSize: 10, color: C.text2, marginTop: 1 },
  invPreviewAmt: { fontSize: 14, fontWeight: '700', color: C.text1 },
  invPreviewEta: { fontSize: 10, color: C.text2, marginTop: 2 },
  pmtHistory: { backgroundColor: C.bgSecondary, borderRadius: 8, padding: 10, marginBottom: 8 },
  pmtHistoryTitle: { fontSize: 10, fontWeight: '700', color: C.text2, textTransform: 'uppercase', marginBottom: 6 },
  pmtHistoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  pmtHistoryDate: { fontSize: 11, color: C.text2 },
  pmtHistoryAmt: { fontSize: 11, fontWeight: '600', color: C.success },

  // CF1/CF2: Drill-down modals
  drillSubtitle: { fontSize: 11, color: C.text2, marginTop: 2 },
  drillRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  drillLabel: { fontSize: 12, color: C.text2, flex: 1 },
  drillValue: { fontSize: 12, fontWeight: '600', color: C.text1, flex: 2, textAlign: 'right' },
  drillSection: { marginTop: 8, marginBottom: 4 },
  drillSectionTitle: { fontSize: 10, fontWeight: '700', color: C.text2, textTransform: 'uppercase', marginBottom: 6 },
  drillProductRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.bg1, gap: 8 },
  drillProductName: { flex: 2, fontSize: 11, color: C.text1 },
  drillProductQty: { fontSize: 11, fontWeight: '600', color: C.accent },
  drillProductPrice: { fontSize: 11, fontWeight: '600', color: C.success, textAlign: 'right' },
  markPaidBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.success, borderRadius: 999, paddingVertical: 12, justifyContent: 'center', marginTop: 8 },
  markPaidText: { color: C.text1, fontSize: 14, fontWeight: '700' },
});
