// Stocks Configuration — matches web's settings/tabs/stocks.js
// CRUD for stock types/warehouses: stock, nname, country, address, sType
import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Modal, Alert, ActivityIndicator, ScrollView,
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
import EmptyState from '../../../components/EmptyState';
import { SETTINGS_DOCS } from '../../../constants/collections';
import { getBottomPad } from '../../../theme/spacing';
import C from '../../../theme/colors';

const EMPTY_STOCK = { stock: '', nname: '', country: '', address: '', phone: '', sType: '', other: '', deleted: false };

const FIELDS = [
  { key: 'nname',   label: 'Display Name',    required: true },
  { key: 'stock',   label: 'Stock Code / ID', required: true },
  { key: 'sType',   label: 'Stock Type',      required: false },
  { key: 'country', label: 'Country',         required: false },
  { key: 'address', label: 'Address',         required: false },
  { key: 'phone',   label: 'Phone',           required: false },
  { key: 'other',   label: 'Other Info',      required: false },
];

export default function StocksConfigScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings, setSettings } = UserAuth();
  const { canEdit, canDelete } = usePermission();
  const { setToast } = useToast();
  const stockTypeOptions = useMemo(() => {
    const types = (settings?.StockType?.StockType || []).filter(x => !x.deleted).map(x => x.sType || x.nname);
    return types.length ? types : ['Warehouse', 'Virtual'];
  }, [settings]);

  const [stocks, setStocks] = useState([]);
  const [form, setForm] = useState(EMPTY_STOCK);
  const [editing, setEditing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const list = settings?.Stocks?.Stocks || [];
    setStocks(list.filter(x => !x.deleted));
  }, [settings]);

  const validate = () => {
    const errs = {};
    FIELDS.filter(f => f.required).forEach(f => {
      if (!form[f.key]?.trim()) errs[f.key] = true;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveToFirestore = async (newList) => {
    setSaving(true);
    const newObj = { ...settings?.Stocks, Stocks: newList };
    const ok = await saveDataSettings(uidCollection, SETTINGS_DOCS.SETTINGS, { ...settings, Stocks: newObj });
    if (ok) {
      setSettings(prev => ({ ...prev, Stocks: newObj }));
      setStocks(newList.filter(x => !x.deleted));
    } else {
      hapticWarning();
      setToast({ text: 'Failed to save.', clr: 'error' });
    }
    setSaving(false);
    return ok;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    const current = settings?.Stocks?.Stocks || [];
    const ok = await saveToFirestore([...current, { ...form, id: uuidv4() }]);
    if (ok) {
      hapticSuccess();
      setToast({ text: 'Stock location added.', clr: 'success' });
      setForm(EMPTY_STOCK);
      setModalVisible(false);
    }
  };

  const handleUpdate = async () => {
    if (!validate()) return;
    const current = settings?.Stocks?.Stocks || [];
    const ok = await saveToFirestore(current.map(x => x.id === form.id ? form : x));
    if (ok) {
      hapticSuccess();
      setToast({ text: 'Stock location updated.', clr: 'success' });
      setForm(EMPTY_STOCK);
      setEditing(false);
      setModalVisible(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Delete Stock', `Remove "${item.nname}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const current = settings?.Stocks?.Stocks || [];
          const ok = await saveToFirestore(current.map(x => x.id === item.id ? { ...x, deleted: true } : x));
          if (ok) {
            hapticSuccess();
            setToast({ text: 'Stock location removed.', clr: 'success' });
          }
        },
      },
    ]);
  };

  const openAdd = () => { setForm(EMPTY_STOCK); setEditing(false); setErrors({}); setModalVisible(true); };
  const openEdit = (item) => { setForm(item); setEditing(true); setErrors({}); setModalVisible(true); };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.nname}>{item.nname}</Text>
        <Text style={styles.code}>{item.stock}</Text>
        {item.sType ? <Text style={styles.detail}>Type: {item.sType}</Text> : null}
        {item.country ? <Text style={styles.detail}>{item.country}</Text> : null}
      </View>
      <View style={styles.actions}>
        {canEdit && (
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
            <Ionicons name="pencil-outline" size={16} color={C.accent} />
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={16} color={C.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Stocks Configuration" navigation={navigation} showBack />
      <FlatList
        data={stocks}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
        ListEmptyComponent={
          <EmptyState icon="cube-outline" title="No stock locations configured" subtitle="Tap Add to create your first location" />
        }
        ListHeaderComponent={canEdit ? (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add-circle-outline" size={18} color={C.text1} />
            <Text style={styles.addBtnText}>Add Stock / Warehouse</Text>
          </TouchableOpacity>
        ) : null}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Stock' : 'Add Stock'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {FIELDS.map(f => (
                <View key={f.key} style={styles.field}>
                  <Text style={[styles.fieldLabel, errors[f.key] && { color: C.danger }]}>
                    {f.label}{f.required ? ' *' : ''}
                  </Text>
                  {f.key === 'sType' ? (
                    <View style={styles.typeRow}>
                      {stockTypeOptions.map(opt => (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.typeBtn, form.sType === opt && styles.typeBtnActive]}
                          onPress={() => setForm(p => ({ ...p, sType: opt }))}
                        >
                          <Text style={[styles.typeBtnText, form.sType === opt && styles.typeBtnTextActive]}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      style={[styles.fieldInput, errors[f.key] && styles.fieldInputError]}
                      value={form[f.key] || ''}
                      onChangeText={v => { setForm(p => ({ ...p, [f.key]: v })); setErrors(p => ({ ...p, [f.key]: false })); }}
                      placeholder={f.label}
                      placeholderTextColor={C.text3}
                    />
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={editing ? handleUpdate : handleAdd}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color={C.text1} size="small" />
                  : <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Add Stock'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  list: { padding: 16, gap: 12 },
  addBtn: {
    flexDirection: 'row', backgroundColor: C.accent, borderRadius: 12,
    padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4,
  },
  addBtnText: { color: C.text1, fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  info: { flex: 1, gap: 3 },
  nname: { fontSize: 14, fontWeight: '700', color: C.text1 },
  code: { fontSize: 12, color: C.accent, fontWeight: '600' },
  detail: { fontSize: 11, color: C.text2 },
  actions: { flexDirection: 'row', gap: 8, marginLeft: 12 },
  editBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.bgTertiary, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.dangerDim, justifyContent: 'center', alignItems: 'center' },
  handle: { width: 36, height: 4, backgroundColor: C.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.text1 },
  modalBody: { padding: 20, gap: 12, paddingBottom: 32 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.text1, textTransform: 'uppercase' },
  fieldInput: {
    backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text1,
  },
  fieldInputError: { borderColor: C.danger, backgroundColor: C.dangerDim },
  saveBtn: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: C.text1, fontSize: 15, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border,
  },
  typeBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: C.text2 },
  typeBtnTextActive: { color: C.text1 },
});
