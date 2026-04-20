// Company Details settings screen — matches web's settings/tabs/general.js
import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../../contexts/AuthContext';
import { loadDataSettings, saveDataSettings } from '../../../shared/utils/firestore';
import { usePermission } from '../../../shared/hooks/usePermission';
import { useToast } from '../../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../../shared/utils/haptics';
import AppHeader from '../../../components/AppHeader';
import Card from '../../../components/Card';
import { SETTINGS_DOCS } from '../../../constants/collections';
import { getBottomPad } from '../../../theme/spacing';
import C from '../../../theme/colors';

const LANGUAGES = ['English', 'Русский'];

// ST1: Company profile presets (mirrors web settings/tabs/logos.js)
const PROFILES = [
  {
    key: 'stainless',
    label: 'IMS Stainless & Alloys',
    data: {
      name: 'IMS Stainless and Alloys OU',
      street: 'Narva Mnt 13a',
      reg: '14976408',
      eori: 'EE14976408',
      email: 'sbashan@ims-stainless.com',
      website: 'www.ims-stainless.com',
      logolink: '/logo/imsLogo.png',
    },
  },
  {
    key: 'metals',
    label: 'IMS Metals & Alloys',
    data: {
      name: 'IMS Metals & Alloys OU',
      street: 'Jõe tn 4C',
      reg: '17031890',
      eori: 'EE17031890',
      email: 'sbashan@ims-metals.com',
      website: 'www.ims-metals.com',
      logolink: '/logo/logoNew.png',
    },
  },
];

const FIELDS = [
  { key: 'name',    label: 'Company Name',    placeholder: 'IMS Trading Ltd',    required: true },
  { key: 'street',  label: 'Street',           placeholder: '123 Business St' },
  { key: 'city',    label: 'City',             placeholder: 'London' },
  { key: 'country', label: 'Country',          placeholder: 'United Kingdom' },
  { key: 'zip',     label: 'ZIP / Postal Code', placeholder: 'EC1A 1BB' },
  { key: 'reg',     label: 'Registration #',   placeholder: 'UK12345678' },
  { key: 'vat',     label: 'VAT Number',       placeholder: 'GB123456789' },
  { key: 'eori',    label: 'EORI Number',      placeholder: 'GB123456789000' },
  { key: 'email',   label: 'Email',            placeholder: 'info@company.com', keyboard: 'email-address' },
  { key: 'website', label: 'Website',          placeholder: 'www.company.com',  keyboard: 'url' },
  { key: 'phone',   label: 'Phone',            placeholder: '+1 234 567 8900',  keyboard: 'phone-pad' },
  { key: 'mobile',  label: 'Mobile',           placeholder: '+1 234 567 8901',  keyboard: 'phone-pad' },
];

export default function CompanyDetailsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, compData, setCompData } = UserAuth();
  const { canEdit } = usePermission();
  const { setToast } = useToast();
  const [form, setForm] = useState({
    name: '', street: '', city: '', country: '', zip: '',
    reg: '', vat: '', eori: '', email: '', website: '',
    phone: '', mobile: '', lng: 'English',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (compData && Object.keys(compData).length > 0) {
      setForm(prev => ({ ...prev, ...compData }));
      setLoading(false);
    } else if (uidCollection) {
      loadDataSettings(uidCollection, SETTINGS_DOCS.COMPANY_DATA).then(data => {
        if (data) setForm(prev => ({ ...prev, ...data }));
        setLoading(false);
      });
    }
  }, [uidCollection, compData]);

  const handleSave = async () => {
    if (!canEdit) return;
    if (!form.name?.trim()) {
      hapticWarning();
      setToast({ text: 'Company name is required.', clr: 'error' });
      return;
    }
    setSaving(true);
    const ok = await saveDataSettings(uidCollection, SETTINGS_DOCS.COMPANY_DATA, form);
    setSaving(false);
    if (ok) {
      setCompData?.(form);
      hapticSuccess();
      setToast({ text: 'Company details saved.', clr: 'success' });
    } else {
      hapticWarning();
      setToast({ text: 'Failed to save. Please try again.', clr: 'error' });
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={C.accent} />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Company Details" navigation={navigation} showBack />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: getBottomPad(insets) }]} keyboardShouldPersistTaps="handled">
        {/* ST1: Profile preset selector */}
        {canEdit && (
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Company Profile</Text>
            <View style={styles.profileBtns}>
              {PROFILES.map(p => {
                const active = form.logolink === p.data.logolink;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.profileBtn, active && styles.profileBtnActive]}
                    onPress={() => setForm(prev => ({ ...prev, ...p.data }))}
                  >
                    <Ionicons name="business-outline" size={14} color={active ? C.text1 : C.accent} />
                    <Text style={[styles.profileBtnText, active && styles.profileBtnTextActive]} numberOfLines={2}>
                      {p.label}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={14} color={C.text1} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <Card style={styles.card}>
          {FIELDS.map(f => (
            <View key={f.key} style={styles.field}>
              <Text style={styles.label}>
                {f.label}{f.required ? ' *' : ''}
              </Text>
              <TextInput
                style={styles.input}
                value={form[f.key] || ''}
                onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                placeholder={f.placeholder}
                placeholderTextColor={C.text3}
                keyboardType={f.keyboard || 'default'}
                autoCapitalize={f.keyboard === 'email-address' || f.keyboard === 'url' ? 'none' : 'words'}
                editable={canEdit}
              />
            </View>
          ))}

          {/* Language selector */}
          <View style={styles.field}>
            <Text style={styles.label}>Language</Text>
            <View style={styles.langRow}>
              {LANGUAGES.map(lng => (
                <TouchableOpacity
                  key={lng}
                  style={[styles.langBtn, form.lng === lng && styles.langBtnActive]}
                  onPress={() => canEdit && setForm(p => ({ ...p, lng }))}
                  disabled={!canEdit}
                >
                  <Text style={[styles.langText, form.lng === lng && styles.langTextActive]}>{lng}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {canEdit && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={C.text1} size="small" />
              : <><Ionicons name="save-outline" size={18} color={C.text1} /><Text style={styles.saveBtnText}>Save Changes</Text></>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, gap: 16 },
  card: { padding: 18, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '700', color: C.text1, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: C.bgSecondary, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text1,
  },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 999,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', backgroundColor: C.bgPrimary,
  },
  langBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  langText: { fontSize: 13, fontWeight: '600', color: C.accent },
  langTextActive: { color: C.text1 },
  saveBtn: {
    flexDirection: 'row', backgroundColor: C.accent, borderRadius: 999,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: C.text1, fontSize: 15, fontWeight: '700' },

  // ST1: Profile preset picker
  profileRow: { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 },
  profileLabel: { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase' },
  profileBtns: { flexDirection: 'row', gap: 10 },
  profileBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    padding: 12, backgroundColor: C.bgSecondary,
  },
  profileBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  profileBtnText: { flex: 1, fontSize: 11, fontWeight: '600', color: C.accent },
  profileBtnTextActive: { color: C.text1 },
});
