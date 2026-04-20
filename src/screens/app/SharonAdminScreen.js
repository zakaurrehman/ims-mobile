import { useEffect, useState, useMemo } from 'react';
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
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../shared/firebase';
import { UserAuth } from '../../contexts/AuthContext';
import { loadMargins, saveMarginMonth } from '../../shared/utils/firestore';
import { getName } from '../../shared/utils/helpers';
import { usePermission } from '../../shared/hooks/usePermission';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import YearPicker from '../../components/YearPicker';
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BLANK_ITEM = {
  description: '', supplier: '', client: '', date: '',
  purchase: '', shipped: '', openShip: '', remaining: '', margin: '', totalMargin: '',
  gis: false,
};

const fmt = (n, digits = 2) => {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const fmtUSD = (n) => '$' + fmt(n, 0);

const countDecimals = (val) => {
  const match = String(val).match(/\.(\d+)$/);
  return match ? match[1].length : 0;
};

const normalizeDate = (d) => {
  if (!d) return '';
  if (typeof d === 'object') return d.startDate || d.endDate || '';
  return String(d);
};

const recalcItem = (item) => {
  const purchase = parseFloat(item.purchase) || 0;
  const shipped = parseFloat(item.shipped) || 0;
  const margin = parseFloat(item.margin) || 0;
  const openShip = purchase - shipped;
  return {
    ...item,
    openShip: String(openShip),
    totalMargin: String(purchase * margin),
    remaining: String(openShip * margin),
  };
};

const recalcMonthTotals = (items) => ({
  purchase: items.reduce((s, x) => s + (parseFloat(x.purchase) || 0), 0),
  openShip: items.reduce((s, x) => s + (parseFloat(x.openShip) || 0), 0),
  remaining: items.reduce((s, x) => s + (x.gis ? (parseFloat(x.remaining) || 0) / 2 : (parseFloat(x.remaining) || 0)), 0),
  totalMargin: items.reduce((s, x) => s + (x.gis ? (parseFloat(x.totalMargin) || 0) / 2 : (parseFloat(x.totalMargin) || 0)), 0),
});

export default function SharonAdminScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, userTitle, settings } = UserAuth();
  const { canEdit, canDelete } = usePermission();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      const data = docs.map(d => ({
        ...d,
        items: Array.isArray(d.ids) && Array.isArray(d.items)
          ? d.ids.map(id => d.items.find(x => x.id === id)).filter(Boolean)
          : (d.items || []),
      }));
      data.sort((a, b) => String(a.month).localeCompare(String(b.month)));
      setMonthsData(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection, year]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // ─── Totals ───────────────────────────────────────────────────────────────
  const totals = monthsData.reduce((acc, m) => {
    acc.purchase += parseFloat(m.purchase) || 0;
    acc.openShip += parseFloat(m.openShip) || 0;
    acc.remaining += parseFloat(m.remaining) || 0;
    acc.totalMargin += parseFloat(m.totalMargin) || 0;
    return acc;
  }, { purchase: 0, openShip: 0, remaining: 0, totalMargin: 0 });

  // ─── GIS-only per month ────────────────────────────────────────────────────
  const gisMonthsData = useMemo(() => monthsData.map(m => {
    const gi = (m.items || []).filter(x => x.gis);
    return {
      month: m.month,
      purchase: gi.reduce((s, x) => s + (parseFloat(x.purchase) || 0), 0),
      openShip: gi.reduce((s, x) => s + (parseFloat(x.openShip) || 0), 0),
      remaining: gi.reduce((s, x) => s + (parseFloat(x.remaining) || 0), 0),
      totalMargin: gi.reduce((s, x) => s + (parseFloat(x.totalMargin) || 0), 0),
    };
  }), [monthsData]);

  const gisTotals = useMemo(() => gisMonthsData.reduce((acc, m) => ({
    purchase: acc.purchase + m.purchase,
    openShip: acc.openShip + m.openShip,
    remaining: acc.remaining + m.remaining,
    totalMargin: acc.totalMargin + m.totalMargin,
  }), { purchase: 0, openShip: 0, remaining: 0, totalMargin: 0 }), [gisMonthsData]);

  // ─── Add month ─────────────────────────────────────────────────────────────
  const addMonth = () => {
    const nextNum = monthsData.length + 1;
    if (nextNum > 12) return;
    const month = String(nextNum).padStart(2, '0');
    setMonthsData(prev => [...prev, { month, items: [], ids: [], purchase: '', openShip: '', remaining: '', totalMargin: '' }]);
  };

  // ─── Delete month ──────────────────────────────────────────────────────────
  const handleDeleteMonth = (month) => {
    Alert.alert('Delete Month', `Remove month ${MONTH_NAMES[parseInt(month, 10) - 1]}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setMonthsData(prev => prev.filter(m => m.month !== month));
          try {
            await deleteDoc(doc(db, uidCollection, 'margins', String(year), String(month)));
          } catch (e) { console.error('deleteMonth', e); }
        },
      },
    ]);
  };

  // ─── Save month ────────────────────────────────────────────────────────────
  const saveMonth = async (monthDoc) => {
    const ok = await saveMarginMonth(uidCollection, year, {
      ...monthDoc,
      ids: monthDoc.items.map(x => x.id),
    });
    if (!ok) Alert.alert('Error', 'Failed to save.');
    return ok;
  };

  // ─── Add item ──────────────────────────────────────────────────────────────
  const handleAddItem = (month) => {
    setEditItem({ ...BLANK_ITEM, id: uuidv4() });
    setEditMonth(month);
  };

  // ─── Edit field change with auto-calc ─────────────────────────────────────
  const handleEditChange = (field, value) => {
    const isNumeric = !['description', 'date', 'supplier', 'client'].includes(field);
    if (isNumeric && countDecimals(value) > 3) return;
    setEditItem(prev => {
      const updated = { ...prev, [field]: value };
      return ['purchase', 'shipped', 'margin'].includes(field) ? recalcItem(updated) : updated;
    });
  };

  // ─── Save item ─────────────────────────────────────────────────────────────
  const handleSaveItem = async () => {
    if (!editItem || !editMonth) return;
    setSaving(true);
    const finalItem = recalcItem(editItem);
    const updatedMonths = monthsData.map(m => {
      if (m.month !== editMonth) return m;
      const idx = m.items.findIndex(x => x.id === finalItem.id);
      const newItems = idx >= 0
        ? m.items.map((x, i) => i === idx ? finalItem : x)
        : [...m.items, finalItem];
      return { ...m, items: newItems, ...recalcMonthTotals(newItems) };
    });
    setMonthsData(updatedMonths);
    const monthDoc = updatedMonths.find(m => m.month === editMonth);
    if (monthDoc) await saveMonth(monthDoc);
    setEditItem(null);
    setEditMonth(null);
    setSaving(false);
  };

  // ─── Delete item ───────────────────────────────────────────────────────────
  const handleDeleteItem = (month, itemId) => {
    Alert.alert('Delete Row', 'Remove this margin row?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const updatedMonths = monthsData.map(m => {
            if (m.month !== month) return m;
            const newItems = m.items.filter(x => x.id !== itemId);
            return { ...m, items: newItems, ...recalcMonthTotals(newItems) };
          });
          setMonthsData(updatedMonths);
          const monthDoc = updatedMonths.find(m => m.month === month);
          if (monthDoc) await saveMonth(monthDoc);
        },
      },
    ]);
  };

  // ─── Drag end ──────────────────────────────────────────────────────────────
  const handleDragEnd = async (month, newItems) => {
    const updatedMonths = monthsData.map(m =>
      m.month !== month ? m : { ...m, items: newItems }
    );
    setMonthsData(updatedMonths);
    const monthDoc = updatedMonths.find(m => m.month === month);
    if (monthDoc) await saveMonth(monthDoc);
  };

  // ─── GIS toggle ────────────────────────────────────────────────────────────
  const handleGisToggle = async (month, itemId) => {
    const updatedMonths = monthsData.map(m => {
      if (m.month !== month) return m;
      const newItems = m.items.map(x => x.id === itemId ? { ...x, gis: !x.gis } : x);
      return { ...m, items: newItems, ...recalcMonthTotals(newItems) };
    });
    setMonthsData(updatedMonths);
    const monthDoc = updatedMonths.find(m => m.month === month);
    if (monthDoc) await saveMonth(monthDoc);
  };

  // ─── Picker ────────────────────────────────────────────────────────────────
  const openPicker = (field, settingsKey, nameField, title) => {
    const arr = settings?.[settingsKey]?.[settingsKey] || [];
    const options = arr.filter(x => !x.deleted).map(x => ({ id: x.id, label: x[nameField] || x.id }));
    setPickerState({ field, options, title });
  };
  const getLabel = (settingsKey, id) => getName(settings, settingsKey, id, 'nname') || '';

  if (loading) return <Spinner />;

  if (userTitle !== 'Admin') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AppHeader title="Sharon Admin" navigation={navigation} showBack />
        <View style={styles.noAccess}>
          <Ionicons name="lock-closed-outline" size={48} color={C.text2} />
          <Text style={styles.noAccessText}>Admin access required</Text>
        </View>
      </View>
    );
  }

  const hasGisData = gisMonthsData.some(m => m.purchase > 0 || m.totalMargin > 0);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AppHeader title="Sharon Admin" navigation={navigation} showBack />
        <YearPicker year={year} setYear={setYear} />

        {/* Summary bar */}
        <View style={styles.summaryRow}>
          <SumBox label="Purchase" value={fmtUSD(totals.purchase)} />
          <SumBox label="Shipped" value={fmtUSD(totals.purchase - totals.openShip)} />
          <SumBox label="Remaining" value={fmtUSD(totals.remaining)} color="#fde68a" />
          <SumBox label="Outstanding" value={fmtUSD(totals.openShip)} color="#fca5a5" />
          <SumBox label="Margin $" value={fmtUSD(totals.totalMargin)} color="#86efac" />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: getBottomPad(insets) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
          nestedScrollEnabled
        >
          {monthsData.map(m => {
            const monthName = MONTH_NAMES[parseInt(m.month, 10) - 1] || m.month;
            const isOpen = !!expandedMonths[m.month];
            const mPurchase = parseFloat(m.purchase) || m.items.reduce((s, x) => s + (parseFloat(x.purchase) || 0), 0);

            return (
              <View key={m.month} style={styles.monthSection}>
                {/* Month header */}
                <View style={styles.monthHeaderWrap}>
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
                      <Text style={styles.monthMarginVal}>{fmtUSD(parseFloat(m.totalMargin) || 0)}</Text>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.text2} />
                    </View>
                  </TouchableOpacity>
                  {canDelete && (
                    <TouchableOpacity style={styles.deleteMonthBtn} onPress={() => handleDeleteMonth(m.month)}>
                      <Ionicons name="trash-outline" size={15} color={C.danger} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Month body */}
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
                              <Ionicons name="reorder-three-outline" size={18} color={C.text2} />
                            </TouchableOpacity>
                            <View style={styles.itemContent}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <Text style={styles.itemDesc} numberOfLines={1}>{item.description || '—'}</Text>
                                {item.gis && <View style={styles.gisBadge}><Text style={styles.gisBadgeText}>GIS</Text></View>}
                              </View>
                              <Text style={styles.itemParties}>
                                {getLabel('Supplier', item.supplier)} → {getLabel('Client', item.client)}
                              </Text>
                              <View style={styles.itemStats}>
                                <Stat label="Purchase" value={fmt(item.purchase, 3)} />
                                <Stat label="Shipped" value={fmt(item.shipped, 3)} />
                                <Stat label="Open Ship" value={fmt(item.openShip, 3)} />
                                <Stat label="Remaining" value={fmtUSD(item.remaining)} />
                              </View>
                            </View>
                            <View style={styles.itemRight}>
                              <Text style={styles.itemMarginTotal}>{fmtUSD(item.totalMargin)}</Text>
                              <TouchableOpacity
                                style={[styles.gisToggle, item.gis && styles.gisToggleOn]}
                                onPress={() => handleGisToggle(m.month, item.id)}
                              >
                                <Text style={[styles.gisToggleText, item.gis && styles.gisToggleTextOn]}>GIS</Text>
                              </TouchableOpacity>
                              <View style={styles.itemActions}>
                                <TouchableOpacity
                                  style={styles.editBtn}
                                  onPress={() => { setEditItem({ ...item, date: normalizeDate(item.date) }); setEditMonth(m.month); }}
                                >
                                  <Ionicons name="pencil-outline" size={14} color={C.accent} />
                                </TouchableOpacity>
                                {canDelete && (
                                  <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={() => handleDeleteItem(m.month, item.id)}
                                  >
                                    <Ionicons name="trash-outline" size={14} color={C.danger} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                        </ScaleDecorator>
                      )}
                    />
                    {canEdit && (
                      <TouchableOpacity style={styles.addRowBtn} onPress={() => handleAddItem(m.month)}>
                        <Ionicons name="add-circle-outline" size={16} color={C.accent} />
                        <Text style={styles.addRowText}>Add Row</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Add month */}
          {canEdit && monthsData.length < 12 && (
            <TouchableOpacity style={styles.addMonthBtn} onPress={addMonth}>
              <Ionicons name="add-outline" size={18} color={C.text1} />
              <Text style={styles.addMonthText}>Add Month</Text>
            </TouchableOpacity>
          )}

          {/* ThirdPart: Totals */}
          {monthsData.length > 0 && (
            <ThirdPartTable title="Totals" rows={monthsData} grandTotals={totals} year={year} />
          )}

          {/* ThirdPart: GIS */}
          {hasGisData && (
            <ThirdPartTable title="Total GIS" rows={gisMonthsData} grandTotals={gisTotals} year={year} />
          )}
        </ScrollView>

        {/* Edit Modal */}
        <Modal visible={!!editItem} animationType="slide" transparent onRequestClose={() => setEditItem(null)}>
          <View style={styles.overlay}>
            <View style={styles.modal}>
            <View style={styles.handle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editItem?.description ? 'Edit Row' : 'New Row'}</Text>
                <TouchableOpacity onPress={() => setEditItem(null)}>
                  <Ionicons name="close" size={22} color={C.text1} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalBody}>
                {editItem && (<>
                  <MField label="Description" field="description" value={editItem.description} onChange={handleEditChange} />
                  <MField label="Date (YYYY-MM-DD)" field="date" value={editItem.date} onChange={handleEditChange} />
                  <MPicker label="Supplier" value={getLabel('Supplier', editItem.supplier)} onPress={() => openPicker('supplier', 'Supplier', 'nname', 'Select Supplier')} />
                  <MPicker label="Client" value={getLabel('Client', editItem.client)} onPress={() => openPicker('client', 'Client', 'nname', 'Select Client')} />
                  <MField label="Purchase (MT)" field="purchase" value={editItem.purchase} onChange={handleEditChange} keyboardType="numeric" />
                  <MField label="Shipped (MT)" field="shipped" value={editItem.shipped} onChange={handleEditChange} keyboardType="numeric" />
                  <MField label="Margin" field="margin" value={editItem.margin} onChange={handleEditChange} keyboardType="numeric" />

                  <View style={styles.calcSection}>
                    <Text style={styles.calcLabel}>Auto-calculated</Text>
                    <View style={styles.calcRow}>
                      <CalcField label="Open Ship" value={fmt(editItem.openShip, 3)} />
                      <CalcField label="Total Margin $" value={fmtUSD(editItem.totalMargin)} />
                      <CalcField label="Remaining $" value={fmtUSD(editItem.remaining)} />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.gisCheckRow, editItem.gis && styles.gisCheckRowOn]}
                    onPress={() => setEditItem(p => ({ ...p, gis: !p.gis }))}
                  >
                    <View style={[styles.checkbox, editItem.gis && styles.checkboxOn]}>
                      {editItem.gis && <Ionicons name="checkmark" size={12} color={C.text1} />}
                    </View>
                    <Text style={[styles.gisCheckLabel, editItem.gis && styles.gisCheckLabelOn]}>GIS</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSaveItem}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color={C.text1} size="small" />
                      : <Text style={styles.saveBtnText}>Save</Text>}
                  </TouchableOpacity>
                </>)}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Picker Modal */}
        <Modal visible={!!pickerState} animationType="slide" transparent onRequestClose={() => setPickerState(null)}>
          <View style={styles.overlay}>
            <View style={[styles.modal, { maxHeight: '60%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{pickerState?.title}</Text>
                <TouchableOpacity onPress={() => setPickerState(null)}>
                  <Ionicons name="close" size={22} color={C.text1} />
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

// ─── ThirdPart table ──────────────────────────────────────────────────────────
function ThirdPartTable({ title, rows, grandTotals, year }) {
  return (
    <View style={styles.tpCard}>
      <Text style={styles.tpTitle}>{title}</Text>
      <View style={styles.tpRow}>
        <Text style={[styles.tpCell, styles.tpHeader, { flex: 1.2 }]}>Month</Text>
        <Text style={[styles.tpCell, styles.tpHeader, { flex: 1.5 }]}>Purchase</Text>
        <Text style={[styles.tpCell, styles.tpHeader, { flex: 1.5 }]}>Profit</Text>
        <Text style={[styles.tpCell, styles.tpHeader, { flex: 1.5 }]}>Open Ship</Text>
        <Text style={[styles.tpCell, styles.tpHeader, { flex: 1.5 }]}>Remaining</Text>
      </View>
      {rows.map((m, i) => (
        <View key={i} style={[styles.tpRow, i % 2 === 1 && styles.tpRowAlt]}>
          <View style={[styles.tpMonthCell, { flex: 1.2 }]}>
            <Text style={styles.tpMonthText}>{MONTH_NAMES[parseInt(m.month, 10) - 1] || m.month}-{year}</Text>
          </View>
          <Text style={[styles.tpCell, { flex: 1.5 }]}>{fmt(m.purchase, 2)}</Text>
          <Text style={[styles.tpCell, { flex: 1.5 }]}>{fmtUSD(m.totalMargin)}</Text>
          <Text style={[styles.tpCell, { flex: 1.5 }]}>{fmt(m.openShip, 2)}</Text>
          <Text style={[styles.tpCell, { flex: 1.5 }]}>{fmtUSD(m.remaining)}</Text>
        </View>
      ))}
      <View style={styles.tpTotalsRow}>
        <Text style={[styles.tpCell, styles.tpTotalLabel, { flex: 1.2 }]}>Total</Text>
        <Text style={[styles.tpCell, styles.tpTotalVal, { flex: 1.5 }]}>{fmt(grandTotals.purchase, 2)}</Text>
        <Text style={[styles.tpCell, styles.tpTotalVal, { flex: 1.5 }]}>{fmtUSD(grandTotals.totalMargin)}</Text>
        <Text style={[styles.tpCell, styles.tpTotalVal, { flex: 1.5 }]}>{fmt(grandTotals.openShip, 2)}</Text>
        <Text style={[styles.tpCell, styles.tpTotalVal, { flex: 1.5 }]}>{fmtUSD(grandTotals.remaining)}</Text>
      </View>
    </View>
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

function CalcField({ label, value }) {
  return (
    <View style={styles.calcItem}>
      <Text style={styles.calcItemLabel}>{label}</Text>
      <Text style={styles.calcItemValue}>{value}</Text>
    </View>
  );
}

function MField({ label, field, value, onChange, keyboardType }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
        value={String(value || '')}
        onChangeText={v => onChange(field, v)}
        placeholder={label}
        placeholderTextColor={C.text3}
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
        <Text style={[styles.pickerBtnText, !value && { color: C.text2 }]}>{value || `Select ${label}`}</Text>
        <Ionicons name="chevron-down" size={16} color={C.text2} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  noAccess: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  noAccessText: { fontSize: 15, color: C.text2, fontWeight: '600' },

  summaryRow: {
    flexDirection: 'row', backgroundColor: C.accent,
    paddingVertical: 10, paddingHorizontal: 8,
  },
  sumBox: { flex: 1, alignItems: 'center' },
  sumVal: { fontSize: 11, fontWeight: '800', color: C.text1 },
  sumLabel: { fontSize: 8, color: C.text2, fontWeight: '600', textTransform: 'uppercase', marginTop: 1 },

  scroll: { padding: 12, gap: 10 },

  monthSection: {
    backgroundColor: C.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  monthHeaderWrap: { flexDirection: 'row', alignItems: 'center' },
  monthHeader: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14,
  },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthBadge: { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  monthBadgeText: { color: C.text1, fontSize: 13, fontWeight: '700' },
  monthCount: { fontSize: 11, color: C.text2 },
  monthPurchase: { fontSize: 12, fontWeight: '700', color: C.text1 },
  monthMarginVal: { fontSize: 11, fontWeight: '600', color: C.success },
  deleteMonthBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: C.dangerDim,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },

  monthBody: { borderTopWidth: 1, borderTopColor: '#EBF4FB' },

  itemRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.bg2,
  },
  itemRowActive: { backgroundColor: C.bgPrimary, opacity: 0.9 },
  dragHandle: { paddingRight: 8, paddingTop: 2, justifyContent: 'center' },
  itemContent: { flex: 1 },
  itemDesc: { fontSize: 12, fontWeight: '700', color: C.text1 },
  gisBadge: { backgroundColor: C.warningDim, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  gisBadgeText: { fontSize: 9, fontWeight: '700', color: C.warning },
  itemParties: { fontSize: 10, color: C.accent, marginBottom: 4 },
  itemStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statItem: { gap: 1 },
  statLabel: { fontSize: 8, color: C.text2, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 10, fontWeight: '600', color: C.text1 },

  itemRight: { alignItems: 'flex-end', gap: 4, paddingLeft: 8 },
  itemMarginTotal: { fontSize: 12, fontWeight: '800', color: C.text1 },
  gisToggle: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2,
  },
  gisToggleOn: { backgroundColor: C.warningDim, borderColor: C.warning },
  gisToggleText: { fontSize: 9, fontWeight: '600', color: C.text2 },
  gisToggleTextOn: { color: C.warning },
  itemActions: { flexDirection: 'row', gap: 4 },
  editBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.bgTertiary, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.dangerDim, justifyContent: 'center', alignItems: 'center' },

  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 12, justifyContent: 'center',
    borderTopWidth: 1, borderTopColor: '#EBF4FB',
  },
  addRowText: { fontSize: 13, fontWeight: '600', color: C.accent },

  addMonthBtn: {
    flexDirection: 'row', backgroundColor: C.accent, borderRadius: 12,
    padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addMonthText: { color: C.text1, fontSize: 14, fontWeight: '700' },

  tpCard: {
    backgroundColor: C.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  tpTitle: { fontSize: 12, fontWeight: '700', color: C.text1, padding: 10, paddingBottom: 6 },
  tpRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  tpRowAlt: { backgroundColor: C.bgSecondary },
  tpCell: { fontSize: 10, color: C.text1, paddingHorizontal: 5, paddingVertical: 7, textAlign: 'center' },
  tpHeader: { backgroundColor: C.bgTertiary, fontWeight: '700', color: C.accent, paddingVertical: 8 },
  tpMonthCell: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, paddingVertical: 6 },
  tpMonthText: {
    fontSize: 9, fontWeight: '600', color: C.accent,
    backgroundColor: C.bgTertiary, borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 2,
  },
  tpTotalsRow: { flexDirection: 'row', backgroundColor: C.accentGlow, borderTopWidth: 1, borderTopColor: C.border2 },
  tpTotalLabel: { fontWeight: '700', color: C.text1 },
  tpTotalVal: { fontWeight: '700', color: C.accent },

  handle: { width: 36, height: 4, backgroundColor: C.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.text1 },
  modalBody: { padding: 20, gap: 10, paddingBottom: 32 },

  formField: { gap: 4 },
  formLabel: { fontSize: 11, fontWeight: '700', color: C.text1, textTransform: 'uppercase' },
  formInput: { backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text1 },
  pickerBtn: { backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerBtnText: { fontSize: 14, color: C.text1 },
  pickerItem: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerItemText: { fontSize: 14, color: C.text1 },

  calcSection: { marginTop: 4 },
  calcLabel: { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', marginBottom: 6 },
  calcRow: { flexDirection: 'row', gap: 8 },
  calcItem: { flex: 1, backgroundColor: C.accentGlow, borderRadius: 10, padding: 10, alignItems: 'center' },
  calcItemLabel: { fontSize: 9, color: C.text2, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  calcItemValue: { fontSize: 12, fontWeight: '700', color: C.accent },

  gisCheckRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg2,
  },
  gisCheckRowOn: { backgroundColor: C.warningDim, borderColor: C.warning },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.border, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg2 },
  checkboxOn: { backgroundColor: C.warning, borderColor: C.warning },
  gisCheckLabel: { fontSize: 13, fontWeight: '600', color: C.text2 },
  gisCheckLabelOn: { color: C.warning },

  saveBtn: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: C.text1, fontSize: 15, fontWeight: '700' },
});
