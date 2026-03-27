import { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { v4 as uuidv4 } from 'uuid';
import { UserAuth } from '../../contexts/AuthContext';
import { saveDataSettings } from '../../shared/utils/firestore';
import { SETTINGS_DOCS } from '../../constants/collections';
import AppHeader from '../../components/AppHeader';

const EMPTY = {
  client: '', nname: '', street: '', city: '', country: '',
  other1: '', poc: '', email: '', phone: '', mobile: '', fax: '', other2: '',
  deleted: false,
};

const REQUIRED = ['client', 'nname', 'street', 'city', 'country'];

export default function ClientManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings, setSettings } = UserAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const allClients = settings?.Client?.Client || [];
  const active = allClients
    .filter(x => !x.deleted)
    .sort((a, b) => (a.client || '').localeCompare(b.client || ''));

  const filtered = search.trim()
    ? active.filter(x => x.client.toLowerCase().includes(search.toLowerCase()) || (x.nname || '').toLowerCase().includes(search.toLowerCase()))
    : active;

  const validate = () => {
    const errs = {};
    REQUIRED.forEach(f => { if (!form[f]?.trim()) errs[f] = true; });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const persistAndSync = async (newArr) => {
    const newObj = { ...(settings?.Client || {}), Client: newArr };
    await saveDataSettings(uidCollection, SETTINGS_DOCS.CLIENT, newObj);
    setSettings(prev => ({ ...prev, Client: newObj }));
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let newArr;
      if (form.id) {
        newArr = allClients.map(x => x.id === form.id ? { ...form } : x);
      } else {
        newArr = [...allClients, { ...form, id: uuidv4() }];
      }
      await persistAndSync(newArr);
      setModalVisible(false);
      setForm(EMPTY);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Client', `Remove "${form.client}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const newArr = allClients.map(x => x.id === form.id ? { ...x, deleted: true } : x);
          await persistAndSync(newArr);
          setModalVisible(false);
          setForm(EMPTY);
        },
      },
    ]);
  };

  const openAdd = () => { setForm(EMPTY); setErrors({}); setModalVisible(true); };
  const openEdit = (item) => { setForm({ ...item }); setErrors({}); setModalVisible(true); };

  const setField = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  };

  const Field = ({ label, field, required }) => (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, required && errors[field] && styles.fieldLabelErr]}>
        {label}{required ? ' *' : ''}
      </Text>
      <TextInput
        style={[styles.fieldInput, errors[field] && styles.fieldInputErr]}
        value={form[field]}
        onChangeText={v => setField(field, v)}
        placeholder={label}
        placeholderTextColor="#b8ddf8"
      />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Clients" navigation={navigation} showBack />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9fb8d4" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.search}
          placeholder="Search clients..."
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

      <Text style={styles.count}>{active.length} clients</Text>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No clients yet. Tap + to add one.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.7}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="briefcase-outline" size={20} color="#0366ae" />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{item.client}</Text>
              {item.nname ? <Text style={styles.cardNname}>{item.nname}</Text> : null}
              <Text style={styles.cardSub}>{[item.city, item.country].filter(Boolean).join(', ')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9fb8d4" />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={openAdd} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{form.id ? 'Edit Client' : 'Add Client'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#103a7a" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Basic Info</Text>
            <Field label="Name" field="client" required />
            <Field label="Nick Name" field="nname" required />
            <Field label="Street" field="street" required />
            <Field label="City" field="city" required />
            <Field label="Country" field="country" required />
            <Field label="Other" field="other1" />

            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Contact</Text>
            <Field label="POC" field="poc" />
            <Field label="Email" field="email" />
            <Field label="Phone" field="phone" />
            <Field label="Mobile" field="mobile" />
            <Field label="Fax" field="fax" />
            <Field label="Other" field="other2" />
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 12 }]}>
            {form.id && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : form.id ? 'Update' : 'Add Client'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 14, height: 40,
    backgroundColor: '#fff', borderRadius: 999,
    borderWidth: 1, borderColor: '#b8ddf8',
  },
  search: { flex: 1, fontSize: 13, color: '#103a7a' },
  count: { paddingHorizontal: 16, fontSize: 11, color: '#9fb8d4', marginBottom: 4 },
  list: { padding: 12, gap: 8, paddingBottom: 80 },
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#b8ddf8',
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#103a7a' },
  cardNname: { fontSize: 12, color: '#0366ae', marginTop: 1 },
  cardSub: { fontSize: 11, color: '#9fb8d4', marginTop: 2 },
  empty: { textAlign: 'center', color: '#9fb8d4', marginTop: 40, fontSize: 14 },
  fab: {
    position: 'absolute', right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#0366ae', justifyContent: 'center', alignItems: 'center',
    elevation: 4,
    shadowColor: '#0366ae', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6,
  },
  modalRoot: { flex: 1, backgroundColor: '#f0f8ff' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#b8ddf8',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#103a7a' },
  modalScroll: { padding: 20, gap: 12 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#9fb8d4',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#0366ae' },
  fieldLabelErr: { color: '#dc2626' },
  fieldInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8ddf8',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#103a7a',
  },
  fieldInputErr: { borderColor: '#dc2626' },
  modalFooter: {
    flexDirection: 'row', gap: 10,
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#b8ddf8',
  },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff2f2',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: '#dc2626' },
  saveBtn: {
    flex: 1, backgroundColor: '#0366ae',
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#9fb8d4' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
