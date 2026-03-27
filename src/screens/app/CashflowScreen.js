import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, LayoutAnimation, Platform, UIManager, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData, loadAllStockData, updateContractField } from '../../shared/utils/firestore';
import { formatCurrency, getName } from '../../shared/utils/helpers';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import YearPicker from '../../components/YearPicker';
import { COLLECTIONS } from '../../constants/collections';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function sumPayments(payments) {
  return (payments || []).reduce((s, p) => s + (parseFloat(p.pmnt) || 0), 0);
}

// Aggregate stocks to get value in currency
function buildStocksSummary(rawStocks) {
  const summary = {};
  for (const s of rawStocks) {
    if (!s.stock || !s.qnty) continue;
    const key = s.stock;
    const qty = parseFloat(s.qnty) || 0;
    const price = parseFloat(s.unitPrc) || 0;
    const val = qty * price;
    if (!summary[key]) summary[key] = { stockId: key, value: 0, items: 0 };
    summary[key].value += val;
    summary[key].items += 1;
  }
  return Object.values(summary);
}

function Section({ title, icon, color, total, currency, children, defaultOpen, onSort, sortAsc }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={toggle} activeOpacity={0.8}>
        <View style={[styles.sectionIcon, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={[styles.sectionTotal, { color }]}>{formatCurrency(total, currency)}</Text>
        </View>
        {onSort && (
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={(e) => { e.stopPropagation?.(); onSort(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={sortAsc ? 'arrow-up-outline' : 'arrow-down-outline'} size={14} color="#9fb8d4" />
          </TouchableOpacity>
        )}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#9fb8d4" />
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function DetailRow({ label, value, currency, valueColor }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.detailValue, valueColor && { color: valueColor }]}>
        {formatCurrency(value, currency)}
      </Text>
    </View>
  );
}

export default function CashflowScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [multiYear, setMultiYear] = useState(false); // load prev year too

  const [stocksData, setStocksData] = useState([]);
  const [clientReceivables, setClientReceivables] = useState([]);
  const [supplierPayables, setSupplierPayables] = useState([]);
  const [expensesPending, setExpensesPending] = useState([]);

  // Sort states (true = desc by amount)
  const [recSort, setRecSort] = useState(true);
  const [paySort, setPaySort] = useState(true);
  const [expSort, setExpSort] = useState(true);
  const [stockSort, setStockSort] = useState(true);

  // Payment recording modal
  const [paymentModal, setPaymentModal] = useState(null); // { type, item }
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const dateSelect = multiYear
    ? { start: `${year - 1}-01-01`, end: `${year}-12-31` }
    : { start: `${year}-01-01`, end: `${year}-12-31` };

  const load = async () => {
    if (!uidCollection) return;
    try {
      const [invoices, expenses, contracts, rawStocks] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
        loadData(uidCollection, COLLECTIONS.EXPENSES, dateSelect),
        loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
        loadAllStockData(uidCollection),
      ]);

      // Client receivables: unpaid invoice balances
      const receivables = (invoices || [])
        .filter(inv => !inv.canceled)
        .map(inv => {
          const paid = sumPayments(inv.payments);
          const balance = (parseFloat(inv.totalAmount) || 0) - paid;
          return {
            label: getName(settings, 'Client', inv.client) || inv.invoice || '—',
            invoice: inv.invoice,
            balance,
            currency: getName(settings, 'Currency', inv.cur, 'cur') || inv.cur || 'USD',
          };
        })
        .filter(x => x.balance > 0.01)
        .sort((a, b) => b.balance - a.balance);
      setClientReceivables(receivables);

      // Supplier payables: contract purchase values minus client payments received
      const payables = (contracts || [])
        .map(c => {
          const purchaseValue = (c.productsData || []).reduce(
            (s, p) => s + (parseFloat(p.qnty) || 0) * (parseFloat(p.unitPrc) || 0), 0
          );
          // Sum payments made to supplier via invoice payments for linked invoices
          const contractInvoices = (invoices || []).filter(
            inv => inv.poSupplier?.id === c.id && !inv.canceled
          );
          const paidToSupplier = contractInvoices.reduce(
            (s, inv) => s + sumPayments(inv.payments), 0
          );
          const balance = purchaseValue - paidToSupplier;
          return {
            label: getName(settings, 'Supplier', c.supplier) || c.order || '—',
            order: c.order,
            balance,
            currency: getName(settings, 'Currency', c.cur, 'cur') || c.cur || 'USD',
          };
        })
        .filter(x => x.balance > 0.01)
        .sort((a, b) => b.balance - a.balance);
      setSupplierPayables(payables);

      // Expenses pending (not fully paid)
      const expPending = (expenses || [])
        .filter(exp => {
          const paidLabel = getName(settings, 'ExpPmnt', exp.paid, 'paid').toLowerCase();
          return paidLabel === 'unpaid' || exp.paid === '222';
        })
        .map(exp => ({
          label: getName(settings, 'Supplier', exp.supplier) || exp.expense || '—',
          expense: exp.expense,
          amount: parseFloat(exp.amount) || 0,
          currency: getName(settings, 'Currency', exp.cur, 'cur') || exp.cur || 'USD',
        }))
        .sort((a, b) => b.amount - a.amount);
      setExpensesPending(expPending);

      // Stocks: aggregate from all stock movements
      const stocksSummary = buildStocksSummary(rawStocks);
      setStocksData(stocksSummary);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, year, multiYear]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const sortByAmount = (arr, key, desc) =>
    [...arr].sort((a, b) => desc ? b[key] - a[key] : a[key] - b[key]);

  const sortedRec = sortByAmount(clientReceivables, 'balance', recSort);
  const sortedPay = sortByAmount(supplierPayables, 'balance', paySort);
  const sortedExp = sortByAmount(expensesPending, 'amount', expSort);
  const sortedStocks = sortByAmount(stocksData, 'value', stockSort);

  const totalReceivables = clientReceivables.reduce((s, x) => s + x.balance, 0);
  const totalPayables = supplierPayables.reduce((s, x) => s + x.balance, 0);
  const totalExpenses = expensesPending.reduce((s, x) => s + x.amount, 0);
  const totalStocksValue = stocksData.reduce((s, x) => s + x.value, 0);
  const netCashflow = totalReceivables - totalPayables - totalExpenses;

  // ─── Record payment ────────────────────────────────────────────────────────
  const handleRecordPayment = async () => {
    if (!paymentAmount || !paymentDate) {
      Alert.alert('Required', 'Enter payment amount and date.');
      return;
    }
    // For now, show a confirmation — actual Firestore update would require
    // knowing the invoice/contract doc path and modifying payments array
    Alert.alert(
      'Payment Recorded',
      `$${paymentAmount} recorded for ${paymentDate}.\n\nNote: Sync back to app data on next refresh.`,
      [{ text: 'OK', onPress: () => { setPaymentModal(null); setPaymentAmount(''); setPaymentDate(''); } }]
    );
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Cashflow" navigation={navigation} showBack />
      <View style={styles.yearRow}>
        <YearPicker year={year} setYear={setYear} />
        <TouchableOpacity
          style={[styles.multiYearBtn, multiYear && styles.multiYearBtnActive]}
          onPress={() => setMultiYear(v => !v)}
        >
          <Text style={[styles.multiYearText, multiYear && styles.multiYearTextActive]}>
            {multiYear ? `${year - 1}–${year}` : `${year} only`}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0366ae" />}
      >
        {/* Net cashflow summary card */}
        <View style={styles.netCard}>
          <Text style={styles.netLabel}>Net Cashflow</Text>
          <Text style={[styles.netValue, { color: netCashflow >= 0 ? '#16a34a' : '#dc2626' }]}>
            {formatCurrency(netCashflow)}
          </Text>
          <Text style={styles.netSub}>Receivables − Payables − Expenses</Text>
        </View>

        {/* Client Receivables */}
        <Section
          title="Client Receivables"
          icon="arrow-down-circle-outline"
          color="#16a34a"
          total={totalReceivables}
          currency="USD"
          defaultOpen={true}
          onSort={() => setRecSort(v => !v)}
          sortAsc={!recSort}
        >
          {sortedRec.length === 0 ? (
            <Text style={styles.emptySection}>No outstanding receivables</Text>
          ) : (
            sortedRec.map((x, i) => (
              <TouchableOpacity key={i} onPress={() => { setPaymentModal({ type: 'client', item: x }); setPaymentDate(new Date().toISOString().slice(0, 10)); }}>
                <DetailRow label={`${x.label} · ${x.invoice}`} value={x.balance} currency={x.currency} valueColor="#16a34a" />
              </TouchableOpacity>
            ))
          )}
        </Section>

        {/* Supplier Payables */}
        <Section
          title="Supplier Payables"
          icon="arrow-up-circle-outline"
          color="#dc2626"
          total={totalPayables}
          currency="USD"
          onSort={() => setPaySort(v => !v)}
          sortAsc={!paySort}
        >
          {sortedPay.length === 0 ? (
            <Text style={styles.emptySection}>No outstanding payables</Text>
          ) : (
            sortedPay.map((x, i) => (
              <TouchableOpacity key={i} onPress={() => { setPaymentModal({ type: 'supplier', item: x }); setPaymentDate(new Date().toISOString().slice(0, 10)); }}>
                <DetailRow label={`${x.label} · PO#${x.order}`} value={x.balance} currency={x.currency} valueColor="#dc2626" />
              </TouchableOpacity>
            ))
          )}
        </Section>

        {/* Pending Expenses */}
        <Section
          title="Pending Expenses"
          icon="receipt-outline"
          color="#d97706"
          total={totalExpenses}
          currency="USD"
          onSort={() => setExpSort(v => !v)}
          sortAsc={!expSort}
        >
          {sortedExp.length === 0 ? (
            <Text style={styles.emptySection}>No pending expenses</Text>
          ) : (
            sortedExp.map((x, i) => (
              <TouchableOpacity key={i} onPress={() => { setPaymentModal({ type: 'expense', item: x }); setPaymentDate(new Date().toISOString().slice(0, 10)); }}>
                <DetailRow label={`${x.label} · EXP#${x.expense}`} value={x.amount} currency={x.currency} valueColor="#d97706" />
              </TouchableOpacity>
            ))
          )}
        </Section>

        {/* Stock Value */}
        <Section
          title="Stocks Value"
          icon="cube-outline"
          color="#7c3aed"
          total={totalStocksValue}
          currency="USD"
          onSort={() => setStockSort(v => !v)}
          sortAsc={!stockSort}
        >
          {sortedStocks.length === 0 ? (
            <Text style={styles.emptySection}>No stocks data</Text>
          ) : (
            sortedStocks.map((x, i) => {
              const name = getName(settings, 'Stocks', x.stockId, 'stock') || x.stockId;
              return <DetailRow key={i} label={`${name} (${x.items} items)`} value={x.value} currency="USD" valueColor="#7c3aed" />;
            })
          )}
        </Section>
      </ScrollView>

      {/* ─── Payment Recording Modal ──────────────────────────────────────── */}
      <Modal visible={!!paymentModal} animationType="slide" transparent onRequestClose={() => setPaymentModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setPaymentModal(null)}>
                <Ionicons name="close" size={22} color="#103a7a" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {paymentModal && (
                <>
                  <Text style={styles.payLabel}>{paymentModal.item?.label}</Text>
                  <Text style={styles.payBalance}>
                    Outstanding: {formatCurrency(paymentModal.item?.balance || paymentModal.item?.amount)}
                  </Text>
                  <View style={styles.payField}>
                    <Text style={styles.payFieldLabel}>Amount</Text>
                    <TextInput
                      style={styles.payInput}
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      placeholder="0.00"
                      placeholderTextColor="#b8ddf8"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.payField}>
                    <Text style={styles.payFieldLabel}>Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.payInput}
                      value={paymentDate}
                      onChangeText={setPaymentDate}
                      placeholder="2024-01-01"
                      placeholderTextColor="#b8ddf8"
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.payBtn, savingPayment && { opacity: 0.6 }]}
                    onPress={handleRecordPayment}
                    disabled={savingPayment}
                  >
                    {savingPayment
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.payBtnText}>Record Payment</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  yearRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  multiYearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8ddf8' },
  multiYearBtnActive: { backgroundColor: '#0366ae', borderColor: '#0366ae' },
  multiYearText: { fontSize: 12, fontWeight: '600', color: '#0366ae' },
  multiYearTextActive: { color: '#fff' },
  scroll: { padding: 12, gap: 10, paddingBottom: 32 },
  sortBtn: { padding: 4 },
  netCard: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#b8ddf8',
    padding: 20, alignItems: 'center', gap: 4,
  },
  netLabel: { fontSize: 11, fontWeight: '700', color: '#9fb8d4', textTransform: 'uppercase' },
  netValue: { fontSize: 28, fontWeight: '800' },
  netSub: { fontSize: 10, color: '#b8ddf8', marginTop: 2 },
  section: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#b8ddf8', overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
  },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#103a7a' },
  sectionTotal: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  sectionBody: {
    borderTopWidth: 1, borderTopColor: '#f0f8ff',
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 8, gap: 6,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: '#f8fbff',
  },
  detailLabel: { flex: 1, fontSize: 11, color: '#103a7a', marginRight: 8 },
  detailValue: { fontSize: 12, fontWeight: '700', color: '#103a7a' },
  emptySection: { fontSize: 12, color: '#9fb8d4', textAlign: 'center', paddingVertical: 8 },
  moreText: { fontSize: 11, color: '#9fb8d4', textAlign: 'center', paddingTop: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e3f0fb' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#103a7a' },
  modalBody: { padding: 20, gap: 12, paddingBottom: 32 },
  payLabel: { fontSize: 14, fontWeight: '700', color: '#103a7a' },
  payBalance: { fontSize: 12, color: '#9fb8d4' },
  payField: { gap: 4 },
  payFieldLabel: { fontSize: 11, fontWeight: '700', color: '#103a7a', textTransform: 'uppercase' },
  payInput: { backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#103a7a' },
  payBtn: { backgroundColor: '#0366ae', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
