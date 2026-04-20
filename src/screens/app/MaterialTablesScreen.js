// MaterialTablesScreen — full parity with ims-main/app/(root)/materialtables/page.js
// M1:  Table name (editable per table)
// M2:  Unit selector + auto-conversion (kgs/lbs/mt)
// M3:  Custom elements add/remove/reorder (DraggableFlatList)
// M4:  Container column toggle + custom label
// M5:  Costs column toggle + custom label
// M6:  Ni% setting per table
// M7:  Element prices per table
// M8:  Preset configurations (7 presets from web)
// M9:  Auto-compute Fe = 100 − Σ(non-Fe elements), _feManual flag
// M10: Live Ni LME price via useMetalPrices + formulasCalc nilme sync
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ScrollView,
  TouchableOpacity, TextInput, Modal, Alert, Switch, Pressable,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../shared/firebase';
import { UserAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../shared/hooks/usePermission';
import { useToast } from '../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../shared/utils/haptics';
import { exportToExcel, buildTablePDF, exportToPDF } from '../../shared/utils/exportUtils';
import { loadDataSettings } from '../../shared/utils/firestore';
import { getBottomPad } from '../../theme/spacing';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import C from '../../theme/colors';
import useMetalPrices from '../../shared/hooks/useMetalPrices';

// ─── M8: Presets — exact port from ims-main/app/(root)/materialtables/newTable.js ─
const PRESETS = [
  { label: 'Ni Cr Fe',         keys: ['ni', 'cr', 'fe'] },
  { label: 'Ni Cr Mo Fe',      keys: ['ni', 'cr', 'mo', 'fe'] },
  { label: 'Ni Cr Mo Co',      keys: ['ni', 'cr', 'mo', 'co'] },
  { label: 'Ni Cr Mo Co Nb',   keys: ['ni', 'cr', 'mo', 'co', 'nb'] },
  { label: 'Ni Cr Mo Co Nb W', keys: ['ni', 'cr', 'mo', 'co', 'nb', 'w'] },
  { label: 'Ni Cu',            keys: ['ni', 'cu'] },
  { label: 'Full',             keys: ['ni', 'cr', 'mo', 'co', 'nb', 'w', 'cu', 'fe'] },
];

// ─── M2: Unit constants — exact port from ims-main/app/(root)/materialtables/constants.js ─
const DEFAULT_ELEMENTS = [
  { key: 'ni', label: 'Ni' },
  { key: 'cr', label: 'Cr' },
  { key: 'mo', label: 'Mo' },
  { key: 'co', label: 'Co' },
  { key: 'nb', label: 'Nb' },
  { key: 'w',  label: 'W'  },
  { key: 'cu', label: 'Cu' },
  { key: 'fe', label: 'Fe', autoCalc: true },
  { key: 'ti', label: 'Ti' },
];
const UNIT_LABELS = { mt: 'MT', kgs: 'Kgs', lbs: 'Lbs' };
const TO_KGS      = { mt: 1000, kgs: 1, lbs: 0.453592 };
const FROM_KGS    = { mt: 0.001, kgs: 1, lbs: 2.20462 };

const COL_W = { material: 130, kgs: 64, container: 90, costs: 70, el: 52 };

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const fmtNum = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toFixed(2);
};

// ─── M9: Auto-compute Fe — exact port from ims-main/app/(root)/materialtables/page.js ─
function autoFe(row, elements) {
  const nonFe  = elements.filter(el => el.key !== 'fe');
  const hasAny = nonFe.some(el => parseFloat(row[el.key]) > 0);
  if (!hasAny) return '';
  const sum = nonFe.reduce((s, el) => s + (parseFloat(row[el.key]) || 0), 0);
  return parseFloat(Math.max(0, 100 - sum).toFixed(2)).toString();
}

// Decimal precision guard (mirrors web's countDecimalDigits)
function countDecimalDigits(str) {
  const match = (str || '').match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) return 0;
  return ((match[1] || '') + (match[2] || '')).replace(/^0+/, '').length;
}

// Weighted-average totals for a table (uses dynamic elements)
const calcTotals = (rows, elements) => {
  const elems     = elements || DEFAULT_ELEMENTS;
  const totalKgs  = rows.reduce((s, r) => s + (Number(r.kgs) || 0), 0);
  const obj       = { kgs: totalKgs };
  elems.forEach(el => {
    const ws = rows.reduce((s, r) => s + (parseFloat(r[el.key] || 0) * (Number(r.kgs) || 0)), 0);
    obj[el.key] = totalKgs > 0 ? (ws / totalKgs).toFixed(2) : '—';
  });
  return obj;
};

// Global totals: average of per-table averages (matches web page.js setTotals)
const calcGlobalTotals = (tables) => {
  const perTable = tables.map(t => calcTotals(t.data || [], t.elements || DEFAULT_ELEMENTS));
  const totalKgs = perTable.reduce((s, t) => s + (Number(t.kgs) || 0), 0);
  const obj      = { kgs: totalKgs.toFixed(2) };
  DEFAULT_ELEMENTS.forEach(el => {
    const valid = perTable.filter(item => !isNaN(parseFloat(item[el.key])));
    const sum   = valid.reduce((acc, item) => acc + parseFloat(item[el.key] || 0), 0);
    obj[el.key] = valid.length > 0 ? (sum / valid.length).toFixed(2) : '—';
  });
  return obj;
};

// ─── M3+M4+M5+M6+M7+M8: Table Settings Modal ─────────────────────────────────
function TableSettingsModal({
  visible, table, onClose,
  onSetName, onSetUnit,
  onToggleContainer, onSetContainerLabel,
  onToggleCosts, onSetCostLabel,
  onSetNiPercent,
  onSetPrice,
  onAddElement, onRemoveElement, onReorderElements,
  onApplyPreset,
}) {
  const elems     = table?.elements || DEFAULT_ELEMENTS;
  const [addKey, setAddKey] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  if (!table) return null;

  const handleAddElement = () => {
    const k = addKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (!k) return;
    onAddElement(k, addLabel || (k.charAt(0).toUpperCase() + k.slice(1)));
    setAddKey('');
    setAddLabel('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={msStyles.overlay}>
        <View style={msStyles.sheet}>
          <View style={msStyles.sheetHandle} />

          {/* Header */}
          <View style={msStyles.header}>
            <Text style={msStyles.title}>Table Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={C.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={msStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* M1: Table Name */}
            <Text style={msStyles.sectionLabel}>Table Name</Text>
            <TextInput
              style={msStyles.textInput}
              value={table.name || ''}
              onChangeText={onSetName}
              placeholder="e.g. Batch A-2024"
              placeholderTextColor={C.textTertiary}
            />

            {/* M2: Unit Selector */}
            <Text style={[msStyles.sectionLabel, { marginTop: 16 }]}>Weight Unit</Text>
            <View style={msStyles.pillRow}>
              {Object.keys(UNIT_LABELS).map(u => (
                <TouchableOpacity
                  key={u}
                  style={[msStyles.pill, (table.unit || 'kgs') === u && msStyles.pillActive]}
                  onPress={() => onSetUnit(u)}
                >
                  <Text style={[(table.unit || 'kgs') === u ? msStyles.pillTextActive : msStyles.pillText]}>
                    {UNIT_LABELS[u]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* M4: Container Column */}
            <View style={[msStyles.toggleRow, { marginTop: 16 }]}>
              <View>
                <Text style={msStyles.toggleLabel}>Container Column</Text>
                <Text style={msStyles.toggleSub}>Show container column in table</Text>
              </View>
              <Switch
                value={table.showContainer || false}
                onValueChange={onToggleContainer}
                trackColor={{ false: C.border, true: C.accentBlue }}
                thumbColor={C.bgSecondary}
              />
            </View>
            {table.showContainer && (
              <TextInput
                style={[msStyles.textInput, { marginTop: 6 }]}
                value={table.containerLabel || 'Container'}
                onChangeText={onSetContainerLabel}
                placeholder="Container label"
                placeholderTextColor={C.textTertiary}
              />
            )}

            {/* M5: Costs Column */}
            <View style={[msStyles.toggleRow, { marginTop: 12 }]}>
              <View>
                <Text style={msStyles.toggleLabel}>Costs Column</Text>
                <Text style={msStyles.toggleSub}>Show cost per row in table</Text>
              </View>
              <Switch
                value={table.showCosts || false}
                onValueChange={onToggleCosts}
                trackColor={{ false: C.border, true: C.accentBlue }}
                thumbColor={C.bgSecondary}
              />
            </View>
            {table.showCosts && (
              <TextInput
                style={[msStyles.textInput, { marginTop: 6 }]}
                value={table.costLabel || 'Price'}
                onChangeText={onSetCostLabel}
                placeholder="Costs column label"
                placeholderTextColor={C.textTertiary}
              />
            )}

            {/* M6: Ni% */}
            <Text style={[msStyles.sectionLabel, { marginTop: 16 }]}>Ni% (0–100)</Text>
            <TextInput
              style={msStyles.textInput}
              value={String(table.niPercent != null ? table.niPercent : 100)}
              onChangeText={v => onSetNiPercent(v)}
              keyboardType="decimal-pad"
              placeholder="100"
              placeholderTextColor={C.textTertiary}
            />

            {/* M7: Element Prices */}
            <Text style={[msStyles.sectionLabel, { marginTop: 16 }]}>Element Prices (USD/MT)</Text>
            <View style={msStyles.pricesGrid}>
              {elems.map(el => (
                <View key={el.key} style={msStyles.priceCell}>
                  <Text style={msStyles.priceLabel}>{el.label}</Text>
                  <TextInput
                    style={msStyles.priceInput}
                    value={String(table.prices?.[el.key] ?? '')}
                    onChangeText={v => onSetPrice(el.key, v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={C.textTertiary}
                  />
                </View>
              ))}
            </View>

            {/* M8: Presets */}
            <View style={[msStyles.toggleRow, { marginTop: 16 }]}>
              <Text style={msStyles.sectionLabel}>Price Presets</Text>
              <TouchableOpacity
                style={msStyles.presetToggleBtn}
                onPress={() => setShowPresets(v => !v)}
              >
                <Text style={msStyles.presetToggleBtnText}>{showPresets ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {showPresets && (
              <View style={msStyles.presetGrid}>
                {PRESETS.map(p => (
                  <TouchableOpacity
                    key={p.label}
                    style={msStyles.presetBtn}
                    onPress={() => { onApplyPreset(p.keys); setShowPresets(false); }}
                  >
                    <Text style={msStyles.presetBtnText}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* M3: Add Custom Element */}
            <Text style={[msStyles.sectionLabel, { marginTop: 16 }]}>Elements</Text>
            <View style={msStyles.addElemRow}>
              <TextInput
                style={[msStyles.textInput, { flex: 1 }]}
                value={addKey}
                onChangeText={setAddKey}
                placeholder="Key (e.g. mn)"
                placeholderTextColor={C.textTertiary}
                autoCapitalize="none"
              />
              <TextInput
                style={[msStyles.textInput, { flex: 1 }]}
                value={addLabel}
                onChangeText={setAddLabel}
                placeholder="Label (e.g. Mn)"
                placeholderTextColor={C.textTertiary}
              />
              <TouchableOpacity style={msStyles.addElemBtn} onPress={handleAddElement}>
                <Ionicons name="add" size={18} color={C.bgSecondary} />
              </TouchableOpacity>
            </View>

            {/* M3: Reorderable element list (DraggableFlatList) */}
            <DraggableFlatList
              data={elems}
              keyExtractor={item => item.key}
              onDragEnd={({ data }) => onReorderElements(data)}
              scrollEnabled={false}
              renderItem={({ item, drag, isActive }) => (
                <ScaleDecorator>
                  <View style={[msStyles.elemRow, isActive && msStyles.elemRowActive]}>
                    <TouchableOpacity onLongPress={drag} style={msStyles.dragHandle}>
                      <Ionicons name="reorder-three-outline" size={18} color={C.textTertiary} />
                    </TouchableOpacity>
                    <Text style={msStyles.elemKey}>{item.label}</Text>
                    {item.autoCalc && (
                      <Text style={msStyles.autoCalcBadge}>auto</Text>
                    )}
                    {!item.autoCalc && (
                      <TouchableOpacity
                        onPress={() => onRemoveElement(item.key)}
                        style={msStyles.removeElemBtn}
                      >
                        <Ionicons name="close-circle" size={16} color={C.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </ScaleDecorator>
              )}
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const msStyles = StyleSheet.create({
  handle: { width: 36, height: 4, backgroundColor: C.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bgSecondary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.border, alignSelf: 'center', marginTop: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  body: { padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  textInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: C.textPrimary, backgroundColor: C.bgTertiary,
  },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bgTertiary,
  },
  pillActive: { backgroundColor: C.accentBlue, borderColor: C.accentBlue },
  pillText: { fontSize: 13, fontWeight: '600', color: C.accentBlue },
  pillTextActive: { fontSize: 13, fontWeight: '600', color: C.bgSecondary },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: C.textPrimary },
  toggleSub: { fontSize: 11, color: C.textTertiary },
  pricesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceCell: { width: '22%' },
  priceLabel: { fontSize: 10, fontWeight: '700', color: C.textSecondary, marginBottom: 3 },
  priceInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 6,
    fontSize: 12, color: C.textPrimary, backgroundColor: C.bgTertiary, textAlign: 'center',
  },
  presetToggleBtn: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999,
    backgroundColor: C.accentBlueSoft, borderWidth: 1, borderColor: C.border,
  },
  presetToggleBtnText: { fontSize: 11, fontWeight: '700', color: C.accentBlue },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  presetBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: C.bgTertiary, borderWidth: 1, borderColor: C.borderStrong,
  },
  presetBtnText: { fontSize: 11, fontWeight: '600', color: C.textPrimary },
  addElemRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  addElemBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: C.accentBlue, justifyContent: 'center', alignItems: 'center',
  },
  elemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  elemRowActive: { backgroundColor: C.accentBlueSoft },
  dragHandle: { padding: 4 },
  elemKey: { flex: 1, fontSize: 13, color: C.textPrimary, fontWeight: '600' },
  autoCalcBadge: { fontSize: 10, color: C.accentBlue, fontStyle: 'italic' },
  removeElemBtn: { padding: 4 },
});

// ─── Edit Row Modal (M3: dynamic elements, M9: auto-Fe, M4: container) ────────
function EditRowModal({ visible, table, draft, setDraft, onSave, onClose }) {
  const elems = table?.elements || DEFAULT_ELEMENTS;

  const handleElChange = (key, val) => {
    if (key !== 'material' && key !== 'container' && key !== 'kgs') {
      if (countDecimalDigits(val) > 2) return;
    }
    setDraft(prev => {
      const updated = { ...prev, [key]: val };
      // M9: Auto-compute Fe if it's not manually overridden
      const hasFe = elems.some(el => el.key === 'fe');
      if (hasFe && key !== 'fe' && key !== 'kgs' && key !== 'material' && key !== 'container') {
        if (!prev._feManual) {
          const computed = autoFe(updated, elems);
          if (computed !== '') updated.fe = computed;
        }
      }
      // M9: User editing Fe directly
      if (key === 'fe') {
        if (val === '') {
          updated._feManual = false;
          const computed = autoFe(updated, elems);
          if (computed !== '') updated.fe = computed;
        } else {
          updated._feManual = true;
        }
      }
      return updated;
    });
  };

  if (!table) return null;

  const feEl = elems.find(el => el.key === 'fe');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={editStyles.overlay}>
        <View style={editStyles.modal}>
          <View style={editStyles.header}>
            <Text style={editStyles.title}>{draft.id ? 'Edit Material' : 'Add Material'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={C.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={editStyles.body} keyboardShouldPersistTaps="handled">
            {/* Material name */}
            <EField label="Material Name" value={draft.material} onChange={v => handleElChange('material', v)} />
            {/* Weight */}
            <EField
              label={`Weight (${UNIT_LABELS[table.unit || 'kgs']})`}
              value={draft.kgs}
              onChange={v => handleElChange('kgs', v.replace(/[^0-9.-]/g, ''))}
              keyboardType="decimal-pad"
            />
            {/* M4: Container field */}
            {table.showContainer && (
              <EField
                label={table.containerLabel || 'Container'}
                value={draft.container}
                onChange={v => handleElChange('container', v)}
              />
            )}
            {/* Dynamic elements */}
            <Text style={editStyles.gridTitle}>Composition %</Text>
            <View style={editStyles.grid}>
              {elems.map(el => {
                const isFe = el.key === 'fe';
                return (
                  <View key={el.key} style={editStyles.elWrap}>
                    <Text style={editStyles.elLabel}>
                      {el.label}{isFe ? ' (auto)' : ''}
                    </Text>
                    <TextInput
                      style={[editStyles.elInput, isFe && !draft._feManual && editStyles.elInputAuto]}
                      value={String(draft[el.key] ?? '')}
                      onChangeText={v => handleElChange(el.key, v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={C.textTertiary}
                      editable={true}
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={editStyles.actions}>
            <TouchableOpacity style={editStyles.cancelBtn} onPress={onClose}>
              <Text style={editStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={editStyles.saveBtn} onPress={onSave}>
              <Text style={editStyles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EField({ label, value, onChange, keyboardType }) {
  return (
    <View style={editStyles.fieldWrap}>
      <Text style={editStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={editStyles.fieldInput}
        value={String(value ?? '')}
        onChangeText={onChange}
        keyboardType={keyboardType || 'default'}
        placeholderTextColor={C.textTertiary}
      />
    </View>
  );
}

const editStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: C.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  body: { padding: 16 },
  gridTitle: { fontSize: 11, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  elWrap: { width: '30%' },
  elLabel: { fontSize: 10, color: C.textTertiary, fontWeight: '600', marginBottom: 4 },
  elInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 13, color: C.textPrimary, backgroundColor: C.bgTertiary, textAlign: 'center',
  },
  elInputAuto: { borderColor: C.accentBlue, backgroundColor: C.accentBlueSoft },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: C.textPrimary, backgroundColor: C.bgTertiary,
  },
  actions: {
    flexDirection: 'row', padding: 16, gap: 10,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  cancelBtn: {
    flex: 1, height: 44, borderRadius: 999,
    borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center',
  },
  cancelText: { fontSize: 14, color: C.textSecondary, fontWeight: '600' },
  saveBtn: {
    flex: 2, height: 44, borderRadius: 999,
    backgroundColor: C.accentBlue, justifyContent: 'center', alignItems: 'center',
  },
  saveText: { fontSize: 14, color: C.bgSecondary, fontWeight: '700' },
});

// ─── Table Card ───────────────────────────────────────────────────────────────
function TableCard({ table, canEdit, nilmePrice, onAddRow, onEditRow, onDeleteRow, onDeleteTable, onExportPDF, onOpenSettings }) {
  const elems   = table.elements || DEFAULT_ELEMENTS;
  const totals  = calcTotals(table.data || [], elems);
  const unit    = table.unit || 'kgs';
  const unitLbl = UNIT_LABELS[unit] || 'Kgs';

  return (
    <View style={cardStyles.card}>
      {/* Table header: name + buttons */}
      <View style={cardStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.tableName} numberOfLines={1}>
            {table.name || `Table ${table.id.slice(0, 6)}…`}
          </Text>
          <View style={cardStyles.metaRow}>
            <Text style={cardStyles.metaText}>{unitLbl}</Text>
            {/* M10: Live Ni price badge */}
            {nilmePrice ? (
              <View style={cardStyles.niPriceBadge}>
                <Ionicons name="flash-outline" size={9} color={C.success} />
                <Text style={cardStyles.niPriceText}>Ni ${nilmePrice}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {table.data?.length > 0 && (
            <TouchableOpacity style={cardStyles.btn} onPress={() => onExportPDF(table)}>
              <Ionicons name="document-outline" size={13} color={C.accentBlue} />
              <Text style={cardStyles.btnText}>PDF</Text>
            </TouchableOpacity>
          )}
          {canEdit && (
            <TouchableOpacity style={cardStyles.btn} onPress={() => onOpenSettings(table)}>
              <Ionicons name="settings-outline" size={13} color={C.accentBlue} />
            </TouchableOpacity>
          )}
          {canEdit && (
            <TouchableOpacity style={cardStyles.btn} onPress={() => onAddRow(table)}>
              <Ionicons name="add" size={14} color={C.accentBlue} />
              <Text style={cardStyles.btnText}>Row</Text>
            </TouchableOpacity>
          )}
          {canEdit && (
            <TouchableOpacity style={[cardStyles.btn, cardStyles.btnDanger]} onPress={() => onDeleteTable(table)}>
              <Ionicons name="trash-outline" size={13} color={C.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Scrollable table body */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Column headers */}
          <View style={cardStyles.colHeader}>
            {table.showContainer && (
              <Text style={[cardStyles.colHeaderText, { width: COL_W.container }]}>
                {table.containerLabel || 'Container'}
              </Text>
            )}
            <Text style={[cardStyles.colHeaderText, { width: COL_W.material }]}>Material</Text>
            <Text style={[cardStyles.colHeaderText, { width: COL_W.kgs }]}>{unitLbl}</Text>
            {elems.map(el => (
              <Text key={el.key} style={[cardStyles.colHeaderText, { width: COL_W.el }]}>
                {el.label}{el.autoCalc ? '*' : ''}
              </Text>
            ))}
            {table.showCosts && (
              <Text style={[cardStyles.colHeaderText, { width: COL_W.costs }]}>
                {table.costLabel || 'Price'}
              </Text>
            )}
            {canEdit && <View style={{ width: 32 }} />}
          </View>

          {/* Data rows */}
          {!table.data?.length ? (
            <View style={cardStyles.emptyRow}>
              <Text style={cardStyles.emptyText}>No materials — tap Row to add</Text>
            </View>
          ) : (
            table.data.map((row, i) => (
              <Pressable
                key={row.id}
                style={[cardStyles.dataRow, i % 2 === 1 && cardStyles.dataRowAlt]}
                onPress={() => canEdit && onEditRow(table, row)}
              >
                {table.showContainer && (
                  <Text style={[cardStyles.cell, { width: COL_W.container }]} numberOfLines={1}>
                    {row.container || '—'}
                  </Text>
                )}
                <Text style={[cardStyles.cell, cardStyles.cellMaterial, { width: COL_W.material }]} numberOfLines={1}>
                  {row.material || '—'}
                </Text>
                <Text style={[cardStyles.cell, { width: COL_W.kgs }]}>{row.kgs || '—'}</Text>
                {elems.map(el => (
                  <Text key={el.key} style={[cardStyles.cell, { width: COL_W.el }]}>
                    {row[el.key] || '—'}
                  </Text>
                ))}
                {table.showCosts && (
                  <Text style={[cardStyles.cell, cardStyles.costsCell, { width: COL_W.costs }]}>
                    {computeRowCost(row, table)}
                  </Text>
                )}
                {canEdit && (
                  <TouchableOpacity style={cardStyles.delCell} onPress={() => onDeleteRow(table, row)}>
                    <Ionicons name="close" size={14} color={C.danger} />
                  </TouchableOpacity>
                )}
              </Pressable>
            ))
          )}

          {/* Totals row */}
          {table.data?.length > 0 && (
            <View style={cardStyles.totalsRow}>
              {table.showContainer && <View style={{ width: COL_W.container }} />}
              <Text style={[cardStyles.totalsLabel, { width: COL_W.material }]}>Totals</Text>
              <Text style={[cardStyles.totalsVal, { width: COL_W.kgs }]}>{fmtNum(totals.kgs)}</Text>
              {elems.map(el => (
                <Text key={el.key} style={[cardStyles.totalsEl, { width: COL_W.el }]}>{totals[el.key]}</Text>
              ))}
              {table.showCosts && <View style={{ width: COL_W.costs }} />}
              {canEdit && <View style={{ width: 32 }} />}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// M5/M7: Compute cost per row — (kgs × niPercent/100 × niPrice) + sum of other elements
function computeRowCost(row, table) {
  const prices    = table.prices || {};
  const niPercent = table.niPercent != null ? table.niPercent / 100 : 1;
  const elems     = table.elements || DEFAULT_ELEMENTS;
  const kgs       = parseFloat(row.kgs) || 0;
  // Convert to MT for cost calc
  const unit      = table.unit || 'kgs';
  const mt        = kgs * (TO_KGS[unit] || 1) * 0.001;
  let total       = 0;
  elems.forEach(el => {
    const prc  = parseFloat(prices[el.key]);
    const pct  = parseFloat(row[el.key]) || 0;
    if (!isNaN(prc) && pct > 0) {
      const factor = el.key === 'ni' ? niPercent : pct / 100;
      total += mt * factor * prc;
    }
  });
  if (total === 0) return '—';
  return `$${total.toFixed(0)}`;
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: C.bgSecondary, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tableName: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaText: { fontSize: 10, color: C.textTertiary },
  niPriceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: C.successSoft, borderRadius: 999,
  },
  niPriceText: { fontSize: 9, fontWeight: '700', color: C.success },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgTertiary,
  },
  btnDanger: { borderColor: C.dangerSoft, backgroundColor: C.dangerSoft },
  btnText: { fontSize: 11, color: C.accentBlue, fontWeight: '600' },
  colHeader: { flexDirection: 'row', backgroundColor: C.textPrimary, paddingHorizontal: 8, paddingVertical: 7 },
  colHeaderText: { fontSize: 10, fontWeight: '700', color: C.bgSecondary, textAlign: 'center' },
  emptyRow: { paddingVertical: 16, paddingHorizontal: 12 },
  emptyText: { fontSize: 12, color: C.textTertiary, fontStyle: 'italic' },
  dataRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.bgTertiary },
  dataRowAlt: { backgroundColor: C.bgTertiary },
  cell: { fontSize: 11, color: C.textPrimary, textAlign: 'center' },
  cellMaterial: { textAlign: 'left', fontWeight: '600' },
  costsCell: { fontWeight: '600', color: C.success },
  delCell: { width: 32, alignItems: 'center', justifyContent: 'center' },
  totalsRow: {
    flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: C.warningSoft, borderTopWidth: 1, borderTopColor: C.border,
  },
  totalsLabel: { fontSize: 10, fontWeight: '700', color: C.warning, textAlign: 'left' },
  totalsVal:   { fontSize: 11, fontWeight: '700', color: C.textPrimary, textAlign: 'center' },
  totalsEl:    { fontSize: 11, fontWeight: '600', color: C.danger, textAlign: 'center' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MaterialTablesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection } = UserAuth();
  const { canEdit }       = usePermission();
  const { setToast }      = useToast();

  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const [tables, setTables]       = useState([]);
  const [search, setSearch]       = useState('');
  const [dirty, setDirty]         = useState(false);
  const [saving, setSaving]       = useState(false);

  // M10: Live Ni LME price from metals-api.com + formulasCalc nilme seed
  const [nilmePrice, setNilmePrice] = useState('');
  const { prices: metalPrices }     = useMetalPrices();

  // Edit row modal state
  const [editCtx, setEditCtx] = useState(null);
  const [draft, setDraft]     = useState({});

  // Settings modal state
  const [settingsTable, setSettingsTable] = useState(null);

  // ─── M10: Update Ni price when live LME price arrives ──────────────────────
  useEffect(() => {
    if (metalPrices?.['LME-NI']?.price != null && !loading) {
      const liveNi = String(Math.round(metalPrices['LME-NI'].price));
      setNilmePrice(liveNi);
      setTables(prev => prev.map(t => ({
        ...t,
        prices: { ...(t.prices || {}), ni: liveNi },
      })));
    }
  }, [metalPrices, loading]);

  // ─── Load materials + formulasCalc ─────────────────────────────────────────
  const load = useCallback(async () => {
    if (!uidCollection) return;
    try {
      setError(null);
      // M10: Load formulasCalc for nilme seed value (matches web page.js)
      const [snap, formulaData] = await Promise.all([
        getDocs(collection(db, uidCollection, 'data', 'materialtables')),
        loadDataSettings(uidCollection, 'formulasCalc').catch(() => ({})),
      ]);

      const nilme = formulaData?.general?.nilme ? String(formulaData.general.nilme) : '';
      setNilmePrice(nilme);

      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Normalize table fields (matches web page.js normalized)
      const normalized = raw.map(t => ({
        ...t,
        name:           t.name || '',
        unit:           t.unit || 'kgs',
        elements:       t.elements || DEFAULT_ELEMENTS,
        prices:         { ...(nilme ? { ni: nilme } : {}), ...(t.prices || {}) },
        containerNo:    t.containerNo || '',
        showContainer:  t.showContainer || false,
        containerLabel: t.containerLabel || 'Container',
        showCosts:      t.showCosts || false,
        costLabel:      t.costLabel || 'Price',
        niPercent:      t.niPercent != null ? t.niPercent : 100,
        priceKeys:      t.priceKeys || null,
        data:           t.data || [],
      }));

      setTables(normalized);
      setDirty(false);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uidCollection]);

  useEffect(() => { load(); }, [load]);

  // ─── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return tables;
    const q = search.toLowerCase();
    return tables
      .map(t => ({
        ...t,
        data: (t.data || []).filter(r => (r.material || '').toLowerCase().includes(q)),
      }))
      .filter(t => t.data.length > 0);
  }, [tables, search]);

  const globalTotals = useMemo(
    () => calcGlobalTotals(tables.filter(t => (t.data || []).length > 0)),
    [tables]
  );

  // ─── Table-level mutations ──────────────────────────────────────────────────
  const mutTable = useCallback((tableId, updater) => {
    setTables(prev => prev.map(t => t.id === tableId ? updater(t) : t));
    setDirty(true);
  }, []);

  const addTable = () => {
    setTables(prev => [...prev, {
      id: genId(), name: '', unit: 'kgs',
      elements: [...DEFAULT_ELEMENTS],
      prices: nilmePrice ? { ni: nilmePrice } : {},
      containerNo: '', showContainer: false, containerLabel: 'Container',
      showCosts: false, costLabel: 'Price', niPercent: 100, priceKeys: null, data: [],
    }]);
    setDirty(true);
  };

  const deleteTable = (table) => {
    if ((table.data || []).length > 0) {
      setToast({ text: 'Remove all rows before deleting', clr: 'error' });
      hapticWarning();
      return;
    }
    Alert.alert('Delete Table', 'Delete this empty table?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, uidCollection, 'data', 'materialtables', table.id));
            setTables(prev => prev.filter(t => t.id !== table.id));
            hapticSuccess();
            setToast({ text: 'Table deleted', clr: 'success' });
          } catch { setToast({ text: 'Delete failed', clr: 'error' }); hapticWarning(); }
        },
      },
    ]);
  };

  // ─── M1: Table name ─────────────────────────────────────────────────────────
  const setTableName = (tableId, name) => mutTable(tableId, t => ({ ...t, name }));

  // ─── M2: Unit selector + auto-conversion ───────────────────────────────────
  const setUnit = (tableId, newUnit) => {
    setTables(prev => prev.map(t => {
      if (t.id !== tableId) return t;
      const oldUnit = t.unit || 'kgs';
      if (oldUnit === newUnit) return t;
      const factor = (TO_KGS[oldUnit] || 1) * (FROM_KGS[newUnit] || 1);
      return {
        ...t, unit: newUnit,
        data: (t.data || []).map(row => {
          const v = parseFloat(row.kgs);
          if (isNaN(v) || row.kgs === '') return row;
          const result    = v * factor;
          const converted = (newUnit === 'kgs' || newUnit === 'lbs')
            ? Math.round(result).toString()
            : parseFloat(result.toFixed(6)).toString();
          return { ...row, kgs: converted };
        }),
      };
    }));
    setDirty(true);
  };

  // ─── M3: Custom elements ────────────────────────────────────────────────────
  const addElement = (tableId, key, label) => {
    const k   = key.trim().toLowerCase().replace(/\s+/g, '_');
    const lbl = (label || '').trim() || k.charAt(0).toUpperCase() + k.slice(1);
    mutTable(tableId, t => {
      const elems = t.elements || DEFAULT_ELEMENTS;
      if (elems.some(e => e.key === k)) return t;
      return { ...t, elements: [...elems, { key: k, label: lbl }] };
    });
  };
  const removeElement    = (tableId, key)         => mutTable(tableId, t => ({ ...t, elements: (t.elements || DEFAULT_ELEMENTS).filter(e => e.key !== key) }));
  const reorderElements  = (tableId, newElements) => mutTable(tableId, t => ({ ...t, elements: newElements }));

  // ─── M4: Container toggle ───────────────────────────────────────────────────
  const toggleContainer    = (tableId)       => mutTable(tableId, t => ({ ...t, showContainer: !t.showContainer }));
  const setContainerLabel  = (tableId, v)    => mutTable(tableId, t => ({ ...t, containerLabel: v }));

  // ─── M5: Costs toggle ──────────────────────────────────────────────────────
  const toggleCosts        = (tableId)       => mutTable(tableId, t => ({ ...t, showCosts: !t.showCosts }));
  const setCostLabel       = (tableId, v)    => mutTable(tableId, t => ({ ...t, costLabel: v }));

  // ─── M6: Ni% ───────────────────────────────────────────────────────────────
  const setNiPercent = (tableId, v) => {
    const clamped = Math.min(100, Math.max(0, parseFloat(v) || 0));
    mutTable(tableId, t => ({ ...t, niPercent: clamped }));
  };

  // ─── M7: Element prices ─────────────────────────────────────────────────────
  const setPrice = (tableId, key, val) => mutTable(tableId, t => ({
    ...t, prices: { ...(t.prices || {}), [key]: val },
  }));

  // ─── M8: Apply preset ──────────────────────────────────────────────────────
  const applyPreset = (tableId, keys) => mutTable(tableId, t => {
    const newPrices = {};
    keys.forEach(k => { if (t.prices?.[k] != null) newPrices[k] = t.prices[k]; });
    return { ...t, prices: newPrices, priceKeys: keys };
  });

  // ─── Row mutations ──────────────────────────────────────────────────────────
  const addRow = (table) => {
    const elems  = table.elements || DEFAULT_ELEMENTS;
    const newRow = { id: '', material: '', kgs: '', container: '', _feManual: false };
    elems.forEach(el => { newRow[el.key] = ''; });
    setDraft(newRow);
    setEditCtx({ table });
  };

  const editRow = (table, row) => {
    const elems  = table.elements || DEFAULT_ELEMENTS;
    const base   = { id: '', material: '', kgs: '', container: '', _feManual: false };
    elems.forEach(el => { base[el.key] = ''; });
    setDraft({ ...base, ...row });
    setEditCtx({ table, row });
  };

  const handleSaveRow = () => {
    if (!draft.material) {
      setToast({ text: 'Material name is required', clr: 'error' });
      hapticWarning();
      return;
    }
    const id     = draft.id || genId();
    const newRow = { ...draft, id };
    setTables(prev => prev.map(t => {
      if (t.id !== editCtx.table.id) return t;
      return {
        ...t,
        data: editCtx.row
          ? (t.data || []).map(r => r.id === editCtx.row.id ? newRow : r)
          : [...(t.data || []), newRow],
      };
    }));
    setDirty(true);
    setEditCtx(null);
  };

  const deleteRow = (table, row) => {
    Alert.alert('Delete Row', `Delete "${row.material || 'this row'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          setTables(prev => prev.map(t =>
            t.id === table.id ? { ...t, data: (t.data || []).filter(r => r.id !== row.id) } : t
          ));
          setDirty(true);
        },
      },
    ]);
  };

  // ─── Save all ───────────────────────────────────────────────────────────────
  const saveAll = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      tables.forEach(t => {
        batch.set(doc(db, uidCollection, 'data', 'materialtables', t.id), t);
      });
      await batch.commit();
      setDirty(false);
      hapticSuccess();
      setToast({ text: 'Saved successfully', clr: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ text: 'Save failed', clr: 'error' });
      hapticWarning();
    } finally {
      setSaving(false);
    }
  };

  // ─── PDF export per table ───────────────────────────────────────────────────
  const exportTablePDF = (table) => {
    const elems = table.elements || DEFAULT_ELEMENTS;
    const unit  = table.unit || 'kgs';
    const cols  = [
      ...(table.showContainer ? [{ key: 'container', label: table.containerLabel || 'Container' }] : []),
      { key: 'material', label: 'Material' },
      { key: 'kgs', label: UNIT_LABELS[unit] || 'Kgs' },
      ...elems.map(el => ({ key: el.key, label: el.label + ' %' })),
    ];
    const totRow = calcTotals(table.data || [], elems);
    const dataWithTotals = [
      ...(table.data || []),
      { material: 'TOTALS', kgs: fmtNum(totRow.kgs), ...Object.fromEntries(elems.map(el => [el.key, totRow[el.key]])) },
    ];
    const title = table.name || `Material Table — ${table.id.slice(0, 8)}`;
    const html  = buildTablePDF(title, cols, dataWithTotals, `${(table.data || []).length} materials`);
    exportToPDF(html, `material_table_${table.id.slice(0, 8)}`);
  };

  // ─── Excel export ───────────────────────────────────────────────────────────
  const handleExport = () => {
    const elems = DEFAULT_ELEMENTS;
    const rows  = [];
    tables.forEach(t => {
      (t.data || []).forEach(r => rows.push({ ...r, tableName: t.name || t.id }));
      const tot = calcTotals(t.data || [], t.elements || DEFAULT_ELEMENTS);
      rows.push({ material: 'TOTAL', kgs: tot.kgs, ...Object.fromEntries(elems.map(el => [el.key, tot[el.key]])), tableName: t.name || t.id });
    });
    const cols = [
      { key: 'tableName', label: 'Table' },
      { key: 'material', label: 'Material' },
      { key: 'kgs', label: 'Kgs' },
      ...elems.map(el => ({ key: el.key, label: el.label })),
    ];
    exportToExcel(rows, cols, 'material_tables');
  };

  if (loading)  return <Spinner />;
  if (error)    return <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />;

  return (
    <View style={[screenStyles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Material Tables" navigation={navigation} showBack />

      {/* Toolbar */}
      <View style={screenStyles.toolRow}>
        <View style={screenStyles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            style={screenStyles.searchInput}
            placeholder="Search materials..."
            placeholderTextColor={C.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={C.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={screenStyles.iconBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={16} color={C.accentBlue} />
        </TouchableOpacity>
        {canEdit && (
          <TouchableOpacity style={[screenStyles.iconBtn, screenStyles.addBtn]} onPress={addTable}>
            <Ionicons name="add" size={18} color={C.bgSecondary} />
          </TouchableOpacity>
        )}
        {canEdit && dirty && (
          <TouchableOpacity
            style={[screenStyles.iconBtn, screenStyles.saveGreen, saving && { opacity: 0.5 }]}
            onPress={saveAll}
            disabled={saving}
          >
            <Ionicons name="save-outline" size={16} color={C.bgSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* M10: Live Ni price header */}
      <View style={screenStyles.statusRow}>
        <Text style={screenStyles.count}>
          {tables.length} tables · {tables.reduce((s, t) => s + (t.data || []).length, 0)} materials
          {dirty ? ' · unsaved' : ''}
        </Text>
        {nilmePrice ? (
          <View style={screenStyles.niLiveBadge}>
            <Ionicons name="flash" size={10} color={C.success} />
            <Text style={screenStyles.niLiveText}>LME Ni ${nilmePrice}/MT</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TableCard
            table={item}
            canEdit={canEdit}
            nilmePrice={nilmePrice}
            onAddRow={addRow}
            onEditRow={editRow}
            onDeleteRow={deleteRow}
            onDeleteTable={deleteTable}
            onExportPDF={exportTablePDF}
            onOpenSettings={t => setSettingsTable(t)}
          />
        )}
        contentContainerStyle={[screenStyles.list, { paddingBottom: getBottomPad(insets) }]}
        windowSize={5}
        maxToRenderPerBatch={5}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.accentBlue}
          />
        }
        ListEmptyComponent={
          <EmptyState icon="grid-outline" title="No material tables" subtitle={canEdit ? 'Tap + to add a table' : ''} />
        }
        ListFooterComponent={
          tables.some(t => (t.data || []).length > 0) ? (
            <View style={[cardStyles.card, { marginTop: 4 }]}>
              <Text style={screenStyles.globalTitle}>Global Totals</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={cardStyles.colHeader}>
                    <Text style={[cardStyles.colHeaderText, { width: COL_W.material }]}>—</Text>
                    <Text style={[cardStyles.colHeaderText, { width: COL_W.kgs }]}>Kgs</Text>
                    {DEFAULT_ELEMENTS.map(el => (
                      <Text key={el.key} style={[cardStyles.colHeaderText, { width: COL_W.el }]}>{el.label}</Text>
                    ))}
                  </View>
                  <View style={cardStyles.totalsRow}>
                    <Text style={[cardStyles.totalsLabel, { width: COL_W.material }]}>All Tables</Text>
                    <Text style={[cardStyles.totalsVal, { width: COL_W.kgs }]}>{globalTotals.kgs}</Text>
                    {DEFAULT_ELEMENTS.map(el => (
                      <Text key={el.key} style={[cardStyles.totalsEl, { width: COL_W.el }]}>{globalTotals[el.key]}</Text>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          ) : null
        }
      />

      {/* Edit Row Modal (M3 dynamic + M9 auto-Fe) */}
      <EditRowModal
        visible={!!editCtx}
        table={editCtx?.table}
        draft={draft}
        setDraft={setDraft}
        onSave={handleSaveRow}
        onClose={() => setEditCtx(null)}
      />

      {/* Table Settings Modal (M1–M8) */}
      <TableSettingsModal
        visible={!!settingsTable}
        table={settingsTable
          ? tables.find(t => t.id === settingsTable.id) || settingsTable
          : null}
        onClose={() => setSettingsTable(null)}
        onSetName={v     => setTableName(settingsTable?.id, v)}
        onSetUnit={u     => setUnit(settingsTable?.id, u)}
        onToggleContainer={() => toggleContainer(settingsTable?.id)}
        onSetContainerLabel={v => setContainerLabel(settingsTable?.id, v)}
        onToggleCosts={() => toggleCosts(settingsTable?.id)}
        onSetCostLabel={v => setCostLabel(settingsTable?.id, v)}
        onSetNiPercent={v => setNiPercent(settingsTable?.id, v)}
        onSetPrice={(k, v) => setPrice(settingsTable?.id, k, v)}
        onAddElement={(k, l) => addElement(settingsTable?.id, k, l)}
        onRemoveElement={k => removeElement(settingsTable?.id, k)}
        onReorderElements={els => reorderElements(settingsTable?.id, els)}
        onApplyPreset={keys => applyPreset(settingsTable?.id, keys)}
      />
    </View>
  );
}

const screenStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  toolRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 6, gap: 8,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 40,
    backgroundColor: C.bgSecondary, borderRadius: 999, borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: C.textPrimary },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: C.bgSecondary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  addBtn: { backgroundColor: C.accentBlue, borderColor: C.accentBlue },
  saveGreen: { backgroundColor: C.success, borderColor: C.success },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 4 },
  count: { fontSize: 11, color: C.textTertiary },
  niLiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: C.successSoft, borderRadius: 999,
  },
  niLiveText: { fontSize: 10, fontWeight: '700', color: C.success },
  globalTitle: { fontSize: 12, fontWeight: '700', color: C.textPrimary, padding: 12, paddingBottom: 6 },
  list: { padding: 12, gap: 12 },
});
