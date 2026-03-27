import { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, ScrollView, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData, updateContractField } from '../../shared/utils/firestore';
import { usePermission } from '../../shared/hooks/usePermission';
import { getName } from '../../shared/utils/helpers';
import Spinner from '../../components/Spinner';
import AppHeader from '../../components/AppHeader';
import YearPicker from '../../components/YearPicker';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';

const STATUSES = ['', 'Pending', 'In Transit', 'At Port', 'Delivered', 'On Hold'];

const STATUS_STYLES = {
  'Pending':    { bg: '#fef9c3', border: '#fde68a', text: '#92400e' },
  'In Transit': { bg: '#dbeeff', border: '#b8ddf8', text: '#103a7a' },
  'At Port':    { bg: '#ede9fe', border: '#ddd6fe', text: '#7c3aed' },
  'Delivered':  { bg: '#dcfce7', border: '#bbf7d0', text: '#166534' },
  'On Hold':    { bg: '#fce7f3', border: '#fbcfe8', text: '#be185d' },
  '':           { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
};

const FILTER_CHIPS = ['All', ...STATUSES.filter(Boolean)];

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES[''];
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.statusBadgeText, { color: s.text }]}>{status || 'No Status'}</Text>
    </View>
  );
}

function StatusPicker({ value, onSelect, onClose, visible }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>Select Status</Text>
          {STATUSES.map(s => {
            const style = STATUS_STYLES[s] || STATUS_STYLES[''];
            return (
              <TouchableOpacity
                key={s}
                style={[styles.pickerOption, { backgroundColor: style.bg, borderColor: style.border }]}
                onPress={() => { onSelect(s); onClose(); }}
              >
                <Text style={[styles.pickerOptionText, { color: style.text }]}>{s || '— Clear Status —'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

function NotesInput({ value, contractId, contractDate, uidCollection, onChange, editable }) {
  const [local, setLocal] = useState(value || '');
  const timerRef = useRef(null);

  useEffect(() => { setLocal(value || ''); }, [value]);

  const handleChange = (v) => {
    setLocal(v);
    onChange(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateContractField(uidCollection, contractId, contractDate, { shipmentNotes: v });
    }, 800);
  };

  return (
    <TextInput
      style={styles.notesInput}
      value={local}
      onChangeText={handleChange}
      placeholder="Add notes..."
      placeholderTextColor="#b8ddf8"
      multiline
      editable={editable !== false}
    />
  );
}

export default function ShipmentScreen() {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const { canEdit } = usePermission();
  const [contracts, setContracts] = useState([]);
  const [invoiceMap, setInvoiceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [year, setYear] = useState(new Date().getFullYear());
  const [pickerTarget, setPickerTarget] = useState(null); // contractId being edited

  const dateSelect = { start: `${year}-01-01`, end: `${year}-12-31` };

  const fetchData = async () => {
    if (!uidCollection) return;
    try {
      const [contractsData, invoicesData] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
      ]);
      // Build contractId → clientId map from invoices
      const map = {};
      (invoicesData || []).forEach(inv => {
        const cid = inv.poSupplier?.id;
        if (cid && inv.invType === '1111' && !map[cid]) {
          map[cid] = { client: inv.client };
        }
      });
      const sorted = (contractsData || []).sort((a, b) =>
        (a.date || '').localeCompare(b.date || '')
      );
      setContracts(sorted);
      setInvoiceMap(map);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, [uidCollection, year]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const getSupplierName = (contract) =>
    getName(settings, 'Supplier', contract.supplier);

  const getClientName = (contractId) => {
    const inv = invoiceMap[contractId];
    if (!inv) return '—';
    return getName(settings, 'Client', inv.client);
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }); }
    catch { return d; }
  };

  const handleStatusChange = async (contractId, contractDate, status) => {
    setContracts(prev => prev.map(c => c.id === contractId ? { ...c, shipmentStatus: status } : c));
    setPickerTarget(null);
    await updateContractField(uidCollection, contractId, contractDate, { shipmentStatus: status });
  };

  const handleNotesChange = (contractId, value) => {
    setContracts(prev => prev.map(c => c.id === contractId ? { ...c, shipmentNotes: value } : c));
  };

  // Filter by search + status
  const filtered = contracts.filter(c => {
    const matchStatus = statusFilter === 'All' || (c.shipmentStatus || '') === statusFilter;
    if (!matchStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.order || '').toLowerCase().includes(q) ||
      getSupplierName(c).toLowerCase().includes(q) ||
      getClientName(c.id).toLowerCase().includes(q)
    );
  });

  const pickerContract = pickerTarget ? contracts.find(c => c.id === pickerTarget) : null;

  const renderItem = ({ item }) => {
    const status = item.shipmentStatus || '';
    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.poNum}>PO# {item.order || '—'}</Text>
          <TouchableOpacity onPress={() => canEdit && setPickerTarget(item.id)}>
            <StatusBadge status={status} />
          </TouchableOpacity>
        </View>

        {/* Info rows */}
        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Supplier</Text>
            <Text style={styles.infoValue}>{getSupplierName(item)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Client</Text>
            <Text style={styles.infoValue}>{getClientName(item.id)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Shipment Date</Text>
            <Text style={styles.infoValue}>{formatDate(item.date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Arrival Date</Text>
            <Text style={styles.infoValue}>{formatDate(item.dateRange?.endDate)}</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.notesWrap}>
          <Text style={styles.infoLabel}>Notes</Text>
          <NotesInput
            value={item.shipmentNotes}
            contractId={item.id}
            contractDate={item.date}
            uidCollection={uidCollection}
            onChange={(v) => handleNotesChange(item.id, v)}
            editable={canEdit}
          />
        </View>
      </View>
    );
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Shipments Tracking" />
      <YearPicker year={year} setYear={setYear} />

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9fb8d4" style={styles.searchIcon} />
        <TextInput
          style={styles.search}
          placeholder="Search shipments..."
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

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBar} contentContainerStyle={styles.chipsContent}>
        {FILTER_CHIPS.map(chip => {
          const active = statusFilter === chip;
          const s = STATUS_STYLES[chip === 'All' ? '' : chip] || STATUS_STYLES[''];
          return (
            <TouchableOpacity
              key={chip}
              onPress={() => setStatusFilter(chip)}
              style={[
                styles.filterChip,
                active
                  ? { backgroundColor: chip === 'All' ? '#103a7a' : s.bg, borderColor: chip === 'All' ? '#103a7a' : s.border }
                  : { backgroundColor: '#fff', borderColor: '#b8ddf8' },
              ]}
            >
              <Text style={[
                styles.filterChipText,
                { color: active ? (chip === 'All' ? '#fff' : s.text) : '#9fb8d4' },
              ]}>
                {chip}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.count}>{filtered.length} shipments</Text>

      <FlatList
        data={filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0366ae" />}
        ListEmptyComponent={<EmptyState icon="boat-outline" title="No shipments found" subtitle="Try changing the year or filters" />}
      />

      {/* Status picker modal */}
      <StatusPicker
        visible={!!pickerTarget}
        value={pickerContract?.shipmentStatus || ''}
        onSelect={(s) => pickerContract && handleStatusChange(pickerContract.id, pickerContract.date, s)}
        onClose={() => setPickerTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 4, marginBottom: 8,
    paddingHorizontal: 14, height: 40,
    backgroundColor: '#fff', borderRadius: 999,
    borderWidth: 1, borderColor: '#b8ddf8',
  },
  searchIcon: { marginRight: 8 },
  search: { flex: 1, fontSize: 13, color: '#103a7a' },
  chipsBar: { flexGrow: 0, marginBottom: 4 },
  chipsContent: { paddingHorizontal: 12, gap: 6, flexDirection: 'row' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  filterChipText: { fontSize: 11, fontWeight: '600' },
  count: { paddingHorizontal: 16, fontSize: 11, color: '#9fb8d4', marginBottom: 4 },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#b8ddf8', padding: 14,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  poNum: { fontSize: 13, fontWeight: '700', color: '#0366ae' },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  infoGrid: { gap: 6, marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 10, color: '#9fb8d4', fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 11, color: '#103a7a', fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  notesWrap: { gap: 4 },
  notesInput: {
    borderWidth: 1, borderColor: '#dbeeff', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 12, color: '#103a7a', backgroundColor: '#f8fbff',
    minHeight: 36,
  },
  empty: { textAlign: 'center', color: '#9fb8d4', marginTop: 40, fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, gap: 8,
  },
  pickerTitle: { fontSize: 14, fontWeight: '700', color: '#103a7a', marginBottom: 8 },
  pickerOption: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  pickerOptionText: { fontSize: 13, fontWeight: '600' },
});
