// Setup Settings Screen — matches web's settings/tabs/setup.js
// Manages all configurable dropdown/picklist values used throughout the app.
// Each category is stored as its own Firestore doc: /{uidCollection}/{categoryKey}
import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { UserAuth } from '../../../contexts/AuthContext';
import { saveDataSettings } from '../../../shared/utils/firestore';
import { usePermission } from '../../../shared/hooks/usePermission';
import { useToast } from '../../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../../shared/utils/haptics';
import AppHeader from '../../../components/AppHeader';
import { getBottomPad } from '../../../theme/spacing';
import C from '../../../theme/colors';

// Excluded from Setup (managed in dedicated screens)
const EXCLUDED = new Set(['Supplier', 'Client', 'Bank Account', 'InvTypes', 'ExpPmnt', 'Currency', 'Stocks']);

// Field name for each category's item value (matches web's fieldByKey)
const FIELD_BY_KEY = {
  'Container Type': 'contType',
  'Delivery Terms': 'delTerm',
  'Delivery Time':  'delTime',
  'Expenses':       'expType',
  'Hs':             'hs',
  'Origin':         'origin',
  'POD':            'pod',
  'POL':            'pol',
  'Packing':        'packing',
  'Payment Terms':  'payTerm',
  'Quantity':       'qty',
  'Remarks':        'remarks',
  'Shipment':       'shipment',
  'Size':           'size',
};

function getFieldName(key, list) {
  if (FIELD_BY_KEY[key]) return FIELD_BY_KEY[key];
  // fallback: first non-id/non-deleted key of first item
  if (list?.length > 0) {
    const candidate = Object.keys(list[0]).find(k => k !== 'id' && k !== 'deleted');
    if (candidate) return candidate;
  }
  return 'value';
}

export default function SetupScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings, setSettings } = UserAuth();
  const { canEdit } = usePermission();
  const { setToast } = useToast();

  // Derive sorted list of setup categories from settings
  const categories = useMemo(() => {
    return Object.keys(settings || {})
      .filter(key => !EXCLUDED.has(key))
      .filter(key => {
        const node = settings[key];
        return node && typeof node === 'object' && !Array.isArray(node) && Array.isArray(node[key]);
      })
      .sort();
  }, [settings]);

  const [selectedCategory, setSelectedCategory] = useState(() => categories[0] || '');
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState(null); // null = add, object = edit
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [inputError, setInputError] = useState(false);

  const currentList = useMemo(() => {
    if (!selectedCategory) return [];
    return (settings?.[selectedCategory]?.[selectedCategory] || []).filter(x => !x.deleted);
  }, [settings, selectedCategory]);

  const fieldName = getFieldName(selectedCategory, currentList);

  const openAdd = () => {
    setEditItem(null);
    setInputValue('');
    setInputError(false);
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setInputValue(item[fieldName] || '');
    setInputError(false);
    setModalVisible(true);
  };

  const persistCategory = async (newList) => {
    const newObj = { ...(settings?.[selectedCategory] || {}), [selectedCategory]: newList };
    const ok = await saveDataSettings(uidCollection, selectedCategory, newObj);
    if (ok) {
      setSettings(prev => ({ ...prev, [selectedCategory]: newObj }));
    }
    return ok;
  };

  const handleSave = async () => {
    if (!inputValue.trim()) { setInputError(true); hapticWarning(); return; }
    setSaving(true);
    try {
      const all = settings?.[selectedCategory]?.[selectedCategory] || [];
      let newList;
      if (editItem) {
        newList = all.map(x => x.id === editItem.id ? { ...x, [fieldName]: inputValue.trim() } : x);
      } else {
        newList = [...all, { id: uuidv4(), [fieldName]: inputValue.trim(), deleted: false }];
      }
      const ok = await persistCategory(newList);
      if (ok) {
        hapticSuccess();
        setToast({ text: editItem ? 'Item updated.' : 'Item added.', clr: 'success' });
        setModalVisible(false);
      } else {
        hapticWarning();
        setToast({ text: 'Failed to save.', clr: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Delete Item', `Remove "${item[fieldName]}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const all = settings?.[selectedCategory]?.[selectedCategory] || [];
          const newList = all.map(x => x.id === item.id ? { ...x, deleted: true } : x);
          const ok = await persistCategory(newList);
          if (ok) {
            hapticSuccess();
            setToast({ text: 'Item removed.', clr: 'success' });
          } else {
            hapticWarning();
            setToast({ text: 'Failed to delete.', clr: 'error' });
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Setup" navigation={navigation} showBack />

      {categories.length === 0 ? (
        <View style={styles.emptyRoot}>
          <Ionicons name="settings-outline" size={48} color={C.text2} />
          <Text style={styles.emptyText}>No setup categories found.</Text>
        </View>
      ) : (
        <View style={styles.body}>
          {/* ─── Left: category list ─── */}
          <View style={styles.sidebar}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catItem, selectedCategory === cat && styles.catItemActive]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]} numberOfLines={2}>
                    {cat}
                  </Text>
                  {selectedCategory === cat && (
                    <View style={styles.catDot} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ─── Right: items list ─── */}
          <View style={styles.panel}>
            {/* Panel header */}
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{selectedCategory}</Text>
              {canEdit && (
                <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
                  <Ionicons name="add" size={16} color={C.text1} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={currentList}
              keyExtractor={(item, i) => item.id || String(i)}
              contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
              ListEmptyComponent={
                <View style={styles.emptyPanel}>
                  <Text style={styles.emptyPanelText}>No items yet{canEdit ? ' — tap Add' : ''}</Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <View style={[styles.listItem, index % 2 === 1 && styles.listItemAlt]}>
                  <Text style={styles.listItemText} numberOfLines={1}>{item[fieldName] || '—'}</Text>
                  {canEdit && (
                    <View style={styles.listItemActions}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                        <Ionicons name="pencil-outline" size={14} color={C.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                        <Ionicons name="trash-outline" size={14} color={C.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            />
          </View>
        </View>
      )}

      {/* ─── Add / Edit Modal ─── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editItem ? `Edit ${selectedCategory}` : `Add ${selectedCategory}`}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.fieldLabel, inputError && { color: C.danger }]}>
                Value {inputError ? '(required)' : ''}
              </Text>
              <TextInput
                style={[styles.input, inputError && styles.inputError]}
                value={inputValue}
                onChangeText={v => { setInputValue(v); setInputError(false); }}
                placeholder={`Enter ${selectedCategory.toLowerCase()} value`}
                placeholderTextColor={C.text3}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={C.text1} size="small" />
                  : <Text style={styles.saveBtnText}>{editItem ? 'Update' : 'Add Item'}</Text>}
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
  body: { flex: 1, flexDirection: 'row' },

  // Sidebar
  sidebar: {
    width: 120,
    backgroundColor: C.bgTertiary,
    paddingVertical: 8,
  },
  catItem: {
    paddingVertical: 12, paddingHorizontal: 12,
    marginHorizontal: 6, marginVertical: 2,
    borderRadius: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  catItemActive: { backgroundColor: C.bg2, shadowColor: C.accent, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  catText: { flex: 1, fontSize: 11, color: C.text2, fontWeight: '600', lineHeight: 15 },
  catTextActive: { color: C.accent, fontWeight: '700' },
  catDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent, marginLeft: 4 },

  // Panel
  panel: { flex: 1, backgroundColor: C.bgPrimary },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.bg2, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  panelTitle: { fontSize: 14, fontWeight: '700', color: C.text1, flex: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.accent, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: { color: C.text1, fontSize: 12, fontWeight: '700' },
  list: { paddingVertical: 4 },
  listItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: C.bg2,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  listItemAlt: { backgroundColor: C.bg1 },
  listItemText: { flex: 1, fontSize: 13, color: C.text1, fontWeight: '500' },
  listItemActions: { flexDirection: 'row', gap: 6 },
  editBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.bgTertiary, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.dangerDim, justifyContent: 'center', alignItems: 'center' },

  // Empty states
  emptyRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: C.text2 },
  emptyPanel: { paddingTop: 40, alignItems: 'center' },
  emptyPanelText: { fontSize: 13, color: C.text2, fontStyle: 'italic' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.bg2,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text1 },
  modalBody: { padding: 20, gap: 10, paddingBottom: 36 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.text1, textTransform: 'uppercase' },
  input: {
    backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text1,
  },
  inputError: { borderColor: C.danger, backgroundColor: C.dangerDim },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    paddingVertical: 14, alignItems: 'center', marginTop: 6,
  },
  saveBtnText: { color: C.text1, fontSize: 15, fontWeight: '700' },
});
