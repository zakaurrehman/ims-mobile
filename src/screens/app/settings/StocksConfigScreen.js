// Stocks Configuration — matches web's settings/tabs/stocks.js
// CRUD for stock types/warehouses: stock, nname, country, address, sType
import { useState, useEffect } from 'react';
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
            <Ionicons name="pencil-outline" size={16} color="#0366ae" />
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={16} color="#dc2626" />
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
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="cube-outline" title="No stock locations configured" subtitle="Tap Add to create your first location" />
        }
        ListHeaderComponent={canEdit ? (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Stock / Warehouse</Text>
          </TouchableOpacity>
        ) : null}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Stock' : 'Add Stock'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#103a7a" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {FIELDS.map(f => (
                <View key={f.key} style={styles.field}>
                  <Text style={[styles.fieldLabel, errors[f.key] && { color: '#dc2626' }]}>
                    {f.label}{f.required ? ' *' : ''}
                  </Text>
                  <TextInput
                    style={[styles.fieldInput, errors[f.key] && styles.fieldInputError]}
                    value={form[f.key] || ''}
                    onChangeText={v => { setForm(p => ({ ...p, [f.key]: v })); setErrors(p => ({ ...p, [f.key]: false })); }}
                    placeholder={f.label}
                    placeholderTextColor="#b8ddf8"
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={editing ? handleUpdate : handleAdd}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" />
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
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  addBtn: {
    flexDirection: 'row', backgroundColor: '#0366ae', borderRadius: 12,
    padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8',
    padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  info: { flex: 1, gap: 3 },
  nname: { fontSize: 14, fontWeight: '700', color: '#103a7a' },
  code: { fontSize: 12, color: '#0366ae', fontWeight: '600' },
  detail: { fontSize: 11, color: '#9fb8d4' },
  actions: { flexDirection: 'row', gap: 8, marginLeft: 12 },
  editBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#e3f0fb',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#103a7a' },
  modalBody: { padding: 20, gap: 12, paddingBottom: 32 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#103a7a', textTransform: 'uppercase' },
  fieldInput: {
    backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#b8ddf8',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#103a7a',
  },
  fieldInputError: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  saveBtn: { backgroundColor: '#0366ae', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
