import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, Pressable, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { formatCurrency, getName, sortArr } from '../../shared/utils/helpers';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import YearPicker from '../../components/YearPicker';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';

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
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedClient, setSelectedClient] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const dateSelect = { start: `${year}-01-01`, end: `${year}-12-31` };

  const load = async () => {
    if (!uidCollection) return;
    try {
      const data = await loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect);
      setAllInvoices(data || []);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, year]);

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
  const displayCurrency = rows[0]?._currency || 'USD';

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Account Statement" navigation={navigation} showBack />
      <YearPicker year={year} setYear={setYear} />

      {/* Client selector */}
      <TouchableOpacity style={styles.clientSelector} onPress={() => setPickerVisible(true)} activeOpacity={0.8}>
        <Ionicons name="person-outline" size={16} color="#0366ae" />
        <Text style={[styles.clientSelectorText, !selectedClient && styles.clientSelectorPlaceholder]}>
          {selectedClient ? selectedClient.nname || selectedClient.client : 'Select client...'}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#9fb8d4" />
      </TouchableOpacity>

      {/* Totals summary */}
      {selectedClient && rows.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Invoiced</Text>
            <Text style={styles.summaryValue}>{formatCurrency(rows.reduce((s, r) => s + r._amount, 0), displayCurrency)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={[styles.summaryValue, { color: '#16a34a' }]}>{formatCurrency(totalPaid, displayCurrency)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Balance Due</Text>
            <Text style={[styles.summaryValue, { color: totalDue > 0.01 ? '#dc2626' : '#16a34a' }]}>
              {formatCurrency(totalDue, displayCurrency)}
            </Text>
          </View>
        </View>
      )}

      {!selectedClient ? (
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={48} color="#b8ddf8" />
          <Text style={styles.emptyText}>Select a client to view their statement</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => item.id || String(i)}
          contentContainerStyle={styles.list}
          windowSize={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0366ae" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#b8ddf8" />
              <Text style={styles.emptyText}>No invoices for this client</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.invNum}>
                  {item._prefix ? `${item._prefix} ` : ''}{item.invoice || '—'}
                </Text>
                <Text style={styles.rowDate}>{item.date || '—'}</Text>
              </View>
              <View style={styles.rowMid}>
                <Text style={styles.rowLabel}>Amount</Text>
                <Text style={styles.rowValue}>{formatCurrency(item._amount, item._currency)}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowLabel}>Balance</Text>
                <Text style={[styles.rowBalance, { color: item._balance > 0.01 ? '#dc2626' : '#16a34a' }]}>
                  {formatCurrency(item._balance, item._currency)}
                </Text>
              </View>
            </View>
          )}
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
                  {selectedClient?.id === c.id && <Ionicons name="checkmark" size={16} color="#0366ae" />}
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
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  clientSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginTop: 4, marginBottom: 8,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#b8ddf8',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  clientSelectorText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#103a7a' },
  clientSelectorPlaceholder: { color: '#9fb8d4', fontWeight: '400' },
  summaryRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 12, marginBottom: 8,
  },
  summaryItem: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: '#b8ddf8', alignItems: 'center',
  },
  summaryLabel: { fontSize: 9, fontWeight: '700', color: '#9fb8d4', textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 11, fontWeight: '800', color: '#103a7a' },
  list: { padding: 12, gap: 6 },
  row: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#b8ddf8',
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  rowLeft: { flex: 1.2 },
  rowMid: { flex: 1, alignItems: 'center' },
  rowRight: { flex: 1, alignItems: 'flex-end' },
  invNum: { fontSize: 12, fontWeight: '700', color: '#0366ae' },
  rowDate: { fontSize: 10, color: '#9fb8d4', marginTop: 2 },
  rowLabel: { fontSize: 9, fontWeight: '700', color: '#9fb8d4', textTransform: 'uppercase', marginBottom: 2 },
  rowValue: { fontSize: 11, fontWeight: '600', color: '#103a7a' },
  rowBalance: { fontSize: 12, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#9fb8d4', textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20,
  },
  pickerTitle: { fontSize: 14, fontWeight: '700', color: '#103a7a', marginBottom: 12 },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#f0f8ff',
  },
  pickerItemActive: { backgroundColor: '#ebf2fc', borderRadius: 8 },
  pickerItemText: { fontSize: 14, color: '#103a7a' },
  pickerItemTextActive: { fontWeight: '700', color: '#0366ae' },
});
