import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, ScrollView,
  TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { UserAuth } from '../../contexts/AuthContext';
import { loadMargins, saveMarginMonth } from '../../shared/utils/firestore';
import { getName } from '../../shared/utils/helpers';
import { usePermission } from '../../shared/hooks/usePermission';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import YearPicker from '../../components/YearPicker';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BLANK_ITEM = {
  description: '', supplier: '', client: '', date: '',
  purchase: '', shipped: '', openShip: '', remaining: '', margin: '', totalMargin: '',
};

const fmt = (n, digits = 2) => {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const fmtUSD = (n) => '$' + fmt(n, 0);

export default function MarginsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings } = UserAuth();
  const { canEdit, canDelete } = usePermission();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthsData, setMonthsData] = useState([]);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [editItem, setEditItem] = useState(null);
  const [editMonth, setEditMonth] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickerState, setPickerState] = useState(null);

  const load = async () => {
    if (!uidCollection) return;
    try {
      const docs = await loadMargins(uidCollection, year);
      // Reorder items by ids array
      const data = docs.map(d => ({
        ...d,
        items: Array.isArray(d.ids) && Array.isArray(d.items)
          ? d.ids.map(id => d.items.find(x => x.id === id)).filter(Boolean)
          : (d.items || []),
      }));
      data.sort((a, b) => String(a.month).localeCompare(String(b.month)));
      setMonthsData(data);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, year]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // ─── Totals across all months ───────────────────────────────────────────────
  const totals = monthsData.reduce((acc, m) => {
    acc.purchase += parseFloat(m.purchase) || 0;
    acc.openShip += parseFloat(m.openShip) || 0;
    acc.remaining += parseFloat(m.remaining) || 0;
    acc.totalMargin += parseFloat(m.totalMargin) || 0;
    return acc;
  }, { purchase: 0, openShip: 0, remaining: 0, totalMargin: 0 });
  const totalShipped = totals.purchase - totals.openShip;
  const totalIncoming = totals.remaining;
  const totalOutstanding = totals.openShip;

  // ─── Add new month ──────────────────────────────────────────────────────────
  const addMonth = () => {
    const nextNum = monthsData.length + 1;
    if (nextNum > 12) return;
    const month = String(nextNum).padStart(2, '0');
    setMonthsData(prev => [...prev, { month, items: [], ids: [], purchase: '', openShip: '', remaining: '', totalMargin: '' }]);
  };

  // ─── Save a month to Firestore ──────────────────────────────────────────────
  const saveMonth = async (monthDoc) => {
    setSaving(true);
    const ok = await saveMarginMonth(uidCollection, year, {
      ...monthDoc,
      ids: monthDoc.items.map(x => x.id),
    });
    if (!ok) Alert.alert('Error', 'Failed to save month data.');
    setSaving(false);
    return ok;
  };

  // ─── Add item to month ──────────────────────────────────────────────────────
  const handleAddItem = (month) => {
    setEditItem({ ...BLANK_ITEM, id: uuidv4() });
    setEditMonth(month);
  };

  // ─── Save edited item ────────────────────────────────────────────────────────
  const handleSaveItem = async () => {
    if (!editItem || !editMonth) return;
    setSaving(true);
    const updatedMonths = monthsData.map(m => {
      if (m.month !== editMonth) return m;
      const existsIdx = m.items.findIndex(x => x.id === editItem.id);
      const newItems = existsIdx >= 0
        ? m.items.map((x, i) => i === existsIdx ? editItem : x)
        : [...m.items, editItem];

      // Auto-compute totalMargin = purchase * margin / 100
      const purchase = parseFloat(editItem.purchase) || 0;
      const marginPct = parseFloat(editItem.margin) || 0;
      const totalMarginVal = purchase * marginPct / 100;
      const updatedItem = { ...editItem, totalMargin: totalMarginVal.toFixed(2) };
      const finalItems = existsIdx >= 0
        ? m.items.map((x, i) => i === existsIdx ? updatedItem : x)
        : [...m.items, updatedItem];

      return { ...m, items: finalItems };
    });
    setMonthsData(updatedMonths);
    const monthDoc = updatedMonths.find(m => m.month === editMonth);
    if (monthDoc) await saveMonth(monthDoc);
    setEditItem(null);
    setEditMonth(null);
    setSaving(false);
  };

  // ─── Delete item ────────────────────────────────────────────────────────────
  const handleDeleteItem = (month, itemId) => {
    Alert.alert('Delete Row', 'Remove this margin row?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const updatedMonths = monthsData.map(m =>
            m.month !== month ? m : { ...m, items: m.items.filter(x => x.id !== itemId) }
          );
          setMonthsData(updatedMonths);
          const monthDoc = updatedMonths.find(m => m.month === month);
          if (monthDoc) await saveMonth(monthDoc);
        },
      },
    ]);
  };

  // ─── Drag end handler ────────────────────────────────────────────────────────
  const handleDragEnd = async (month, newItems) => {
    const updatedMonths = monthsData.map(m =>
      m.month !== month ? m : { ...m, items: newItems }
    );
    setMonthsData(updatedMonths);
    const monthDoc = updatedMonths.find(m => m.month === month);
    if (monthDoc) await saveMonth(monthDoc);
  };

  // ─── Picker helpers ─────────────────────────────────────────────────────────
  const openPicker = (field, settingsKey, nameField, title) => {
    const arr = settings?.[settingsKey]?.[settingsKey] || [];
    const options = arr.filter(x => !x.deleted).map(x => ({ id: x.id, label: x[nameField] || x.id }));
    setPickerState({ field, options, title });
  };
  const getLabel = (settingsKey, id, nameField = 'nname') => getName(settings, settingsKey, id, nameField) || '';

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AppHeader title="Margins" navigation={navigation} showBack />
        <YearPicker year={year} setYear={setYear} />

        {/* Summary totals */}
        <View style={styles.summaryRow}>
          <SumBox label="Purchase" value={fmtUSD(totals.purchase)} />
          <SumBox label="Shipped" value={fmtUSD(totalShipped)} />
          <SumBox label="Remaining" value={fmtUSD(totals.remaining)} color="#d97706" />
          <SumBox label="Outstanding" value={fmtUSD(totalOutstanding)} color="#dc2626" />
          <SumBox label="Margin" value={fmtUSD(totals.totalMargin)} color="#16a34a" />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0366ae" />}
          nestedScrollEnabled
        >
          {monthsData.map(m => {
            const monthIdx = parseInt(m.month, 10) - 1;
            const monthName = MONTH_NAMES[monthIdx] || m.month;
            const isOpen = !!expandedMonths[m.month];
            const mPurchase = parseFloat(m.purchase) || m.items.reduce((s, x) => s + (parseFloat(x.purchase) || 0), 0);
            const mMargin = m.items.length > 0
              ? m.items.reduce((s, x) => s + (parseFloat(x.margin) || 0), 0) / m.items.length
              : 0;

            return (
              <View key={m.month} style={styles.monthSection}>
                {/* Month header */}
                <TouchableOpacity
                  style={styles.monthHeader}
                  onPress={() => setExpandedMonths(prev => ({ ...prev, [m.month]: !prev[m.month] }))}
                  activeOpacity={0.85}
                >
                  <View style={styles.monthHeaderLeft}>
                    <View style={styles.monthBadge}>
                      <Text style={styles.monthBadgeText}>{monthName}</Text>
                    </View>
                    <Text style={styles.monthCount}>{m.items.length} rows</Text>
                  </View>
                  <View style={styles.monthHeaderRight}>
                    <Text style={styles.monthPurchase}>{fmtUSD(mPurchase)}</Text>
                    <View style={[styles.marginBadge, { backgroundColor: mMargin >= 0 ? '#dcfce7' : '#fee2e2' }]}>
                      <Text style={[styles.marginBadgeText, { color: mMargin >= 0 ? '#16a34a' : '#dc2626' }]}>
                        {fmt(mMargin, 1)}%
                      </Text>
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#9fb8d4" />
                  </View>
                </TouchableOpacity>

                {/* Month body (expanded) */}
                {isOpen && (
                  <View style={styles.monthBody}>
                    <DraggableFlatList
                      data={m.items}
                      keyExtractor={item => item.id}
                      onDragEnd={({ data }) => handleDragEnd(m.month, data)}
                      scrollEnabled={false}
                      renderItem={({ item, drag, isActive }) => (
                        <ScaleDecorator>
                          <View style={[styles.itemRow, isActive && styles.itemRowActive]}>
                            <TouchableOpacity onLongPress={drag} style={styles.dragHandle}>
                              <Ionicons name="reorder-three-outline" size={18} color="#b8ddf8" />
                            </TouchableOpacity>
                            <View style={styles.itemContent}>
                              <Text style={styles.itemDesc} numberOfLines={1}>
                                {item.description || '—'}
                              </Text>
                              <Text style={styles.itemParties}>
                                {getLabel('Supplier', item.supplier)} → {getLabel('Client', item.client)}
                              </Text>
                              <View style={styles.itemStats}>
                                <Stat label="Purchase" value={fmt(item.purchase)} />
                                <Stat label="Shipped" value={fmt(item.shipped)} />
                                <Stat label="Remaining" value={fmt(item.remaining)} />
                                <Stat label="Open Ship" value={fmt(item.openShip)} />
                              </View>
                            </View>
                            <View style={styles.itemRight}>
                              <Text style={styles.itemMarginTotal}>{fmtUSD(item.totalMargin)}</Text>
                              <View style={[styles.marginBadge, { backgroundColor: parseFloat(item.margin) >= 0 ? '#dcfce7' : '#fee2e2' }]}>
                                <Text style={[styles.marginBadgeText, { color: parseFloat(item.margin) >= 0 ? '#16a34a' : '#dc2626' }]}>
                                  {fmt(item.margin, 1)}%
                                </Text>
                              </View>
                              <View style={styles.itemActions}>
                                <TouchableOpacity
                                  style={styles.editBtn}
                                  onPress={() => { setEditItem({ ...item }); setEditMonth(m.month); }}
                                >
                                  <Ionicons name="pencil-outline" size={14} color="#0366ae" />
                                </TouchableOpacity>
                                {canDelete && (
                                  <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={() => handleDeleteItem(m.month, item.id)}
                                  >
                                    <Ionicons name="trash-outline" size={14} color="#dc2626" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                        </ScaleDecorator>
                      )}
                    />

                    {/* Add row button */}
                    {canEdit && (
                      <TouchableOpacity style={styles.addRowBtn} onPress={() => handleAddItem(m.month)}>
                        <Ionicons name="add-circle-outline" size={16} color="#0366ae" />
                        <Text style={styles.addRowText}>Add Row</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Add month */}
          {monthsData.length < 12 && (
            <TouchableOpacity style={styles.addMonthBtn} onPress={addMonth}>
              <Ionicons name="add-outline" size={18} color="#fff" />
              <Text style={styles.addMonthText}>Add Month</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ─── Edit Item Modal ────────────────────────────────────────────── */}
        <Modal visible={!!editItem} animationType="slide" transparent onRequestClose={() => setEditItem(null)}>
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editItem?.description ? 'Edit Row' : 'New Row'}
                </Text>
                <TouchableOpacity onPress={() => setEditItem(null)}>
                  <Ionicons name="close" size={22} color="#103a7a" />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalBody}>
                {editItem && (<>
                  <MField label="Description" value={editItem.description} onChangeText={v => setEditItem(p => ({ ...p, description: v }))} />
                  <MField label="Date (YYYY-MM-DD)" value={editItem.date} onChangeText={v => setEditItem(p => ({ ...p, date: v }))} />
                  <MPicker label="Supplier" value={getLabel('Supplier', editItem.supplier)} onPress={() => openPicker('supplier', 'Supplier', 'nname', 'Select Supplier')} />
                  <MPicker label="Client" value={getLabel('Client', editItem.client)} onPress={() => openPicker('client', 'Client', 'nname', 'Select Client')} />
                  <MField label="Purchase" value={editItem.purchase} onChangeText={v => setEditItem(p => ({ ...p, purchase: v }))} keyboardType="numeric" />
                  <MField label="Shipped" value={editItem.shipped} onChangeText={v => setEditItem(p => ({ ...p, shipped: v }))} keyboardType="numeric" />
                  <MField label="Open/Outstanding" value={editItem.openShip} onChangeText={v => setEditItem(p => ({ ...p, openShip: v }))} keyboardType="numeric" />
                  <MField label="Remaining" value={editItem.remaining} onChangeText={v => setEditItem(p => ({ ...p, remaining: v }))} keyboardType="numeric" />
                  <MField label="Margin %" value={editItem.margin} onChangeText={v => setEditItem(p => ({ ...p, margin: v }))} keyboardType="numeric" />
                  <MField label="Total Margin $" value={editItem.totalMargin} onChangeText={v => setEditItem(p => ({ ...p, totalMargin: v }))} keyboardType="numeric" />

                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSaveItem}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.saveBtnText}>Save</Text>}
                  </TouchableOpacity>
                </>)}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ─── Picker Modal ───────────────────────────────────────────────── */}
        <Modal visible={!!pickerState} animationType="slide" transparent onRequestClose={() => setPickerState(null)}>
          <View style={styles.overlay}>
            <View style={[styles.modal, { maxHeight: '60%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{pickerState?.title}</Text>
                <TouchableOpacity onPress={() => setPickerState(null)}>
                  <Ionicons name="close" size={22} color="#103a7a" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {(pickerState?.options || []).map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      setEditItem(p => ({ ...p, [pickerState.field]: opt.id }));
                      setPickerState(null);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

function SumBox({ label, value, color }) {
  return (
    <View style={styles.sumBox}>
      <Text style={[styles.sumVal, color && { color }]}>{value}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value || '—'}</Text>
    </View>
  );
}

function MField({ label, value, onChangeText, keyboardType }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
        value={String(value || '')}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#b8ddf8"
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

function MPicker({ label, value, onPress }) {
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

  summaryRow: {
    flexDirection: 'row', backgroundColor: '#103a7a',
    paddingVertical: 10, paddingHorizontal: 8,
  },
  sumBox: { flex: 1, alignItems: 'center' },
  sumVal: { fontSize: 12, fontWeight: '800', color: '#fff' },
  sumLabel: { fontSize: 8, color: '#9fb8d4', fontWeight: '600', textTransform: 'uppercase', marginTop: 1 },

  scroll: { padding: 12, gap: 10, paddingBottom: 32 },

  monthSection: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#b8ddf8', overflow: 'hidden',
  },
  monthHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14,
  },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthBadge: { backgroundColor: '#0366ae', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  monthBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  monthCount: { fontSize: 11, color: '#9fb8d4' },
  monthPurchase: { fontSize: 12, fontWeight: '700', color: '#103a7a' },
  marginBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  marginBadgeText: { fontSize: 10, fontWeight: '700' },

  monthBody: { borderTopWidth: 1, borderTopColor: '#f0f8ff' },

  itemRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f8ff',
    backgroundColor: '#fff',
  },
  itemRowActive: { backgroundColor: '#f0f8ff', opacity: 0.9 },
  dragHandle: { paddingRight: 8, paddingTop: 2, justifyContent: 'center' },
  itemContent: { flex: 1 },
  itemDesc: { fontSize: 12, fontWeight: '700', color: '#103a7a', marginBottom: 2 },
  itemParties: { fontSize: 10, color: '#0366ae', marginBottom: 4 },
  itemStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statItem: { gap: 1 },
  statLabel: { fontSize: 8, color: '#9fb8d4', fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 10, fontWeight: '600', color: '#103a7a' },

  itemRight: { alignItems: 'flex-end', gap: 4, paddingLeft: 8 },
  itemMarginTotal: { fontSize: 12, fontWeight: '800', color: '#103a7a' },
  itemActions: { flexDirection: 'row', gap: 4 },
  editBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center' },

  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 12, justifyContent: 'center',
    borderTopWidth: 1, borderTopColor: '#f0f8ff',
  },
  addRowText: { fontSize: 13, fontWeight: '600', color: '#0366ae' },

  addMonthBtn: {
    flexDirection: 'row', backgroundColor: '#0366ae', borderRadius: 12,
    padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addMonthText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e3f0fb' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#103a7a' },
  modalBody: { padding: 20, gap: 10, paddingBottom: 32 },

  formField: { gap: 4 },
  formLabel: { fontSize: 11, fontWeight: '700', color: '#103a7a', textTransform: 'uppercase' },
  formInput: { backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#103a7a' },
  pickerBtn: { backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerBtnText: { fontSize: 14, color: '#103a7a' },
  pickerItem: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  pickerItemText: { fontSize: 14, color: '#103a7a' },
  saveBtn: { backgroundColor: '#0366ae', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
