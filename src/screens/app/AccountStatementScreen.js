import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, Pressable, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { formatCurrency, getName, sortArr, safeDate } from '../../shared/utils/helpers';
import { exportToExcel, exportToPDF, buildTablePDF } from '../../shared/utils/exportUtils';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import DateRangeFilter from '../../components/DateRangeFilter';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';

const INV_PREFIX = { '1111': 'FN', '2222': 'CN', '3333': 'DN' };

function sumPayments(payments) {
  return (payments || []).reduce((s, p) => s + (parseFloat(p.pmnt) || 0), 0);
}

export default function AccountStatementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [allInvoices, setAllInvoices] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const _cy = new Date().getFullYear();
  const [dateRange, setDateRange] = useState({ start: `${_cy}-01-01`, end: `${_cy}-12-31` });
  const dateSelect = dateRange;

  const load = async () => {
    if (!uidCollection) return;
    try {
      const data = await loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect);
      setAllInvoices(data || []);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, dateRange]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const clients = sortArr(
    (settings?.Client?.Client || []).filter(x => !x.deleted),
    'nname'
  );

  // Filter invoices for selected client, sorted by date
  const clientInvoices = selectedClient
    ? allInvoices
        .filter(inv => inv.client === selectedClient.id && !inv.canceled)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    : [];

  // Build rows with running balance
  let runningBalance = 0;
  const rows = clientInvoices.map(inv => {
    const amount = parseFloat(inv.totalAmount) || 0;
    const paid = sumPayments(inv.payments);
    runningBalance += amount - paid;
    const prefix = INV_PREFIX[inv.invType] || '';
    const currency = getName(settings, 'Currency', inv.cur, 'cur') || inv.cur || 'USD';
    return {
      ...inv,
      _amount: amount,
      _paid: paid,
      _balance: amount - paid,
      _running: runningBalance,
      _prefix: prefix,
      _currency: currency,
    };
  });

  const totalDue = rows.reduce((s, r) => s + r._balance, 0);
  const totalPaid = rows.reduce((s, r) => s + r._paid, 0);
  const totalAmount = rows.reduce((s, r) => s + r._amount, 0);
  const displayCurrency = rows[0]?._currency || 'USD';

  const handleExport = () => {
    const cols = [
      { key: 'invoice', label: 'Invoice#' },
      { key: 'date', label: 'Date' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'currency', label: 'Currency' },
      { key: 'amount', label: 'Amount' },
      { key: 'paid', label: 'Paid' },
      { key: 'notPaid', label: 'Not Paid' },
    ];
    const data = rows.map(r => ({
      invoice: `${r._prefix ? r._prefix + ' ' : ''}${r.invoice || ''}`,
      date: safeDate(r.date) || '',
      dueDate: r.delDate?.endDate ? safeDate(r.delDate.endDate) : '',
      currency: r._currency,
      amount: r._amount.toFixed(2),
      paid: r._paid.toFixed(2),
      notPaid: r._balance.toFixed(2),
    }));
    exportToExcel(data, cols, `statement_${selectedClient?.nname || 'client'}`);
  };

  const handleExportPDF = () => {
    const cols = [
      { key: 'invoice', label: 'Invoice#' },
      { key: 'date', label: 'Date' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'currency', label: 'Currency' },
      { key: 'amount', label: 'Amount' },
      { key: 'paid', label: 'Paid' },
      { key: 'notPaid', label: 'Not Paid' },
    ];
    const pdfData = rows.map(r => ({
      invoice: `${r._prefix ? r._prefix + ' ' : ''}${r.invoice || ''}`,
      date: safeDate(r.date) || '',
      dueDate: r.delDate?.endDate ? safeDate(r.delDate.endDate) : '',
      currency: r._currency,
      amount: r._amount.toFixed(2),
      paid: r._paid.toFixed(2),
      notPaid: r._balance.toFixed(2),
    }));
    const html = buildTablePDF(`Account Statement — ${selectedClient?.nname || 'Client'}`, cols, pdfData);
    exportToPDF(html, `statement_${selectedClient?.nname || 'client'}`);
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Account Statement" navigation={navigation} showBack />
      <DateRangeFilter
        onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
        initialYear={new Date().getFullYear()}
      />

      {/* Client selector */}
      <TouchableOpacity style={styles.clientSelector} onPress={() => setPickerVisible(true)} activeOpacity={0.8}>
        <Ionicons name="person-outline" size={16} color={C.accent} />
        <Text style={[styles.clientSelectorText, !selectedClient && styles.clientSelectorPlaceholder]}>
          {selectedClient ? selectedClient.nname || selectedClient.client : 'Select client...'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C.text2} />
      </TouchableOpacity>

      {/* Totals summary */}
      {selectedClient && rows.length > 0 && (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Invoiced</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalAmount, displayCurrency)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Paid</Text>
              <Text style={[styles.summaryValue, { color: C.success }]}>{formatCurrency(totalPaid, displayCurrency)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Balance Due</Text>
              <Text style={[styles.summaryValue, { color: totalDue > 0.01 ? C.danger : C.success }]}>
                {formatCurrency(totalDue, displayCurrency)}
              </Text>
            </View>
          </View>
          <View style={styles.exportRow}>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
              <Ionicons name="grid-outline" size={14} color={C.accent} />
              <Text style={styles.exportBtnText}>Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
              <Ionicons name="document-text-outline" size={14} color={C.danger} />
              <Text style={[styles.exportBtnText, { color: C.danger }]}>PDF</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {!selectedClient ? (
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={48} color={C.text2} />
          <Text style={styles.emptyText}>Select a client to view their statement</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => item.id || String(i)}
          contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
          windowSize={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={C.text2} />
              <Text style={styles.emptyText}>No invoices for this client</Text>
            </View>
          }
          renderItem={({ item }) => {
            const dueDate = item.delDate?.endDate ? safeDate(item.delDate.endDate) : null;
            const isOverdue = dueDate && item._balance > 0.01 && new Date(item.delDate.endDate) < new Date();
            return (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.invNum}>
                    {item._prefix ? `${item._prefix} ` : ''}{item.invoice || '—'}
                  </Text>
                  <Text style={styles.rowDate}>{safeDate(item.date) || '—'}</Text>
                  {dueDate ? <Text style={[styles.rowDue, isOverdue && styles.rowDueOverdue]}>Due: {dueDate}</Text> : null}
                </View>
                <View style={styles.rowNumbers}>
                  <View style={styles.numCol}>
                    <Text style={styles.rowLabel}>Amount</Text>
                    <Text style={styles.rowValue}>{formatCurrency(item._amount, item._currency)}</Text>
                  </View>
                  <View style={styles.numCol}>
                    <Text style={styles.rowLabel}>Paid</Text>
                    <Text style={[styles.rowValue, { color: item._paid > 0.01 ? C.success : C.text2 }]}>{formatCurrency(item._paid, item._currency)}</Text>
                  </View>
                  <View style={styles.numCol}>
                    <Text style={styles.rowLabel}>Balance</Text>
                    <Text style={[styles.rowBalance, { color: item._balance > 0.01 ? C.danger : C.success }]}>
                      {formatCurrency(item._balance, item._currency)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Client picker modal */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Select Client</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {clients.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pickerItem, selectedClient?.id === c.id && styles.pickerItemActive]}
                  onPress={() => { setSelectedClient(c); setPickerVisible(false); }}
                >
                  <Text style={[styles.pickerItemText, selectedClient?.id === c.id && styles.pickerItemTextActive]}>
                    {c.nname || c.client}
                  </Text>
                  {selectedClient?.id === c.id && <Ionicons name="checkmark" size={16} color={C.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  clientSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginTop: 4, marginBottom: 8,
    backgroundColor: C.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  clientSelectorText: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text1 },
  clientSelectorPlaceholder: { color: C.text2, fontWeight: '400' },
  summaryRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 12, marginBottom: 8,
  },
  summaryItem: {
    flex: 1, backgroundColor: C.bg2,
    borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  summaryLabel: { fontSize: 9, fontWeight: '700', color: C.text2, textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 11, fontWeight: '800', color: C.text1 },
  exportRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 12, marginBottom: 6,
  },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.bgTertiary, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  exportBtnText: { fontSize: 12, fontWeight: '600', color: C.accent },
  list: { padding: 12, gap: 6 },
  row: {
    backgroundColor: C.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  rowLeft: { flex: 1.2 },
  rowNumbers: { flex: 2, flexDirection: 'row', gap: 4 },
  numCol: { flex: 1, alignItems: 'flex-end' },
  invNum: { fontSize: 12, fontWeight: '700', color: C.accent },
  rowDate: { fontSize: 10, color: C.text2, marginTop: 2 },
  rowDue: { fontSize: 9, color: C.text2, marginTop: 2 },
  rowDueOverdue: { color: C.danger, fontWeight: '600' },
  rowLabel: { fontSize: 9, fontWeight: '700', color: C.text2, textTransform: 'uppercase', marginBottom: 2 },
  rowValue: { fontSize: 11, fontWeight: '600', color: C.text1 },
  rowBalance: { fontSize: 12, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: C.text2, textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: C.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20,
  },
  pickerTitle: { fontSize: 14, fontWeight: '700', color: C.text1, marginBottom: 12 },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerItemActive: { backgroundColor: C.bgTertiary, borderRadius: 8 },
  pickerItemText: { fontSize: 14, color: C.text1 },
  pickerItemTextActive: { fontWeight: '700', color: C.accent },
});
