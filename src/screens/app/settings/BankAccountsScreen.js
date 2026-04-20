// Bank Accounts settings — matches web's settings/tabs/bankAccounts.js
// Full CRUD: bankNname, bankName, cur, swiftCode, iban, corrBank, corrBankSwift, other
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
import { getBottomPad } from '../../../theme/spacing';
import C from '../../../theme/colors';

const EMPTY_BANK = {
  bankNname: '', bankName: '', cur: '', swiftCode: '',
  iban: '', corrBank: '', corrBankSwift: '', other: '', deleted: false,
};

const FIELDS = [
  { key: 'bankNname',    label: 'Account Nickname',   required: true },
  { key: 'bankName',     label: 'Bank Name',           required: true },
  { key: 'cur',          label: 'Currency',            required: true },
  { key: 'swiftCode',    label: 'SWIFT Code',          required: true },
  { key: 'iban',         label: 'IBAN / Account #',   required: true },
  { key: 'corrBank',     label: 'Correspondent Bank',  required: true },
  { key: 'corrBankSwift',label: 'Corresp. SWIFT',      required: true },
  { key: 'other',        label: 'Other Info',          required: false },
];

export default function BankAccountsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, settings, setSettings } = UserAuth();
  const { canEdit, canDelete } = usePermission();
  const { setToast } = useToast();
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState(EMPTY_BANK);
  const [editing, setEditing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [curPickerVisible, setCurPickerVisible] = useState(false);

  const currencies = (settings?.Currency?.Currency || []).filter(x => !x.deleted);

  useEffect(() => {
    const list = settings?.['Bank Account']?.['Bank Account'] || [];
    setBanks(list.filter(x => !x.deleted));
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
    const newObj = { ...settings?.['Bank Account'], 'Bank Account': newList };
    const ok = await saveDataSettings(uidCollection, SETTINGS_DOCS.BANK_ACCOUNT, newObj);
    if (ok) {
      setSettings(prev => ({ ...prev, 'Bank Account': newObj }));
      setBanks(newList.filter(x => !x.deleted));
    } else {
      hapticWarning();
      setToast({ text: 'Failed to save. Please try again.', clr: 'error' });
    }
    setSaving(false);
    return ok;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    const current = settings?.['Bank Account']?.['Bank Account'] || [];
    const ok = await saveToFirestore([...current, { ...form, id: uuidv4() }]);
    if (ok) {
      hapticSuccess();
      setToast({ text: 'Bank account added.', clr: 'success' });
      setForm(EMPTY_BANK);
      setModalVisible(false);
    }
  };

  const handleUpdate = async () => {
    if (!validate()) return;
    const current = settings?.['Bank Account']?.['Bank Account'] || [];
    const ok = await saveToFirestore(current.map(x => x.id === form.id ? form : x));
    if (ok) {
      hapticSuccess();
      setToast({ text: 'Bank account updated.', clr: 'success' });
      setForm(EMPTY_BANK);
      setEditing(false);
      setModalVisible(false);
    }
  };

  const handleDelete = (bank) => {
    Alert.alert('Delete Bank Account', `Remove "${bank.bankNname}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const current = settings?.['Bank Account']?.['Bank Account'] || [];
          const ok = await saveToFirestore(current.map(x => x.id === bank.id ? { ...x, deleted: true } : x));
          if (ok) {
            hapticSuccess();
            setToast({ text: 'Bank account removed.', clr: 'success' });
          }
        },
      },
    ]);
  };

  const openAdd = () => { setForm(EMPTY_BANK); setEditing(false); setErrors({}); setModalVisible(true); };
  const openEdit = (bank) => { setForm(bank); setEditing(true); setErrors({}); setModalVisible(true); };

  const renderBank = ({ item }) => (
    <View style={styles.bankCard}>
      <View style={styles.bankInfo}>
        <Text style={styles.bankNname}>{item.bankNname}</Text>
        <Text style={styles.bankName}>{item.bankName}</Text>
        <Text style={styles.bankDetail}>Currency: {item.cur}</Text>
        <Text style={styles.bankDetail}>SWIFT: {item.swiftCode}</Text>
        <Text style={styles.bankDetail} numberOfLines={1}>IBAN: {item.iban}</Text>
      </View>
      <View style={styles.bankActions}>
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
      <AppHeader title="Bank Accounts" navigation={navigation} showBack />

      <FlatList
        data={banks}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={renderBank}
        contentContainerStyle={[styles.list, { paddingBottom: getBottomPad(insets) }]}
        ListEmptyComponent={
          <EmptyState icon="card-outline" title="No bank accounts yet" subtitle="Tap Add to create your first account" />
        }
        ListHeaderComponent={canEdit ? (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add-circle-outline" size={18} color={C.text1} />
            <Text style={styles.addBtnText}>Add Bank Account</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Bank Account' : 'Add Bank Account'}</Text>
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
                  {f.key === 'cur' ? (
                    <TouchableOpacity
                      style={[styles.fieldInput, styles.pickerTouchable, errors[f.key] && styles.fieldInputError]}
                      onPress={() => setCurPickerVisible(true)}
                    >
                      <Text style={form.cur ? styles.pickerValue : styles.pickerPlaceholder}>
                        {form.cur || 'Select currency…'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={C.text2} />
                    </TouchableOpacity>
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
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={editing ? handleUpdate : handleAdd}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={C.text1} size="small" />
                  : <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Add Account'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Currency picker modal */}
      <Modal visible={curPickerVisible} transparent animationType="slide" onRequestClose={() => setCurPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setCurPickerVisible(false)}>
                <Ionicons name="close" size={22} color={C.text1} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {currencies.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.curItem, form.cur === c.cur && styles.curItemActive]}
                  onPress={() => {
                    setForm(p => ({ ...p, cur: c.cur }));
                    setErrors(p => ({ ...p, cur: false }));
                    setCurPickerVisible(false);
                  }}
                >
                  <Text style={[styles.curItemText, form.cur === c.cur && styles.curItemTextActive]}>{c.cur}</Text>
                  {form.cur === c.cur && <Ionicons name="checkmark" size={16} color={C.accent} />}
                </TouchableOpacity>
              ))}
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
  bankCard: {
    backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  bankInfo: { flex: 1, gap: 3 },
  bankNname: { fontSize: 14, fontWeight: '700', color: C.text1 },
  bankName: { fontSize: 13, color: C.accent, fontWeight: '600' },
  bankDetail: { fontSize: 11, color: C.text2 },
  bankActions: { flexDirection: 'row', gap: 8, marginLeft: 12 },
  editBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: C.bgTertiary,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: C.dangerDim,
    justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
  },
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
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: C.text1, fontSize: 15, fontWeight: '700' },
  pickerTouchable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerValue: { fontSize: 14, color: C.text1 },
  pickerPlaceholder: { fontSize: 14, color: C.text2 },
  curItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  curItemActive: { backgroundColor: C.bgTertiary },
  curItemText: { fontSize: 14, color: C.text1 },
  curItemTextActive: { fontWeight: '700', color: C.accent },
});
