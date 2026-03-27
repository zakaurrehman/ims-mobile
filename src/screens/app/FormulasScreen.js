// Formulas screen — matches web's formulas/page.js
// General inputs (NiLME, MoOxideLb, ChargeCrLb, MT, Euro/USD) + 3 material tabs
// Web reference: ims-main/app/(root)/formulas/page.js
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import Card from '../../components/Card';
import { UserAuth } from '../../contexts/AuthContext';
import { loadDataSettings, saveDataSettings } from '../../shared/utils/firestore';
import { SETTINGS_DOCS } from '../../constants/collections';

// ─── getCur: port of web's components/exchangeApi.js ──────────────────────────
const getCur = async () => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const appId = process.env.EXPO_PUBLIC_OPENEXCHANGERATES_APP_ID || '';
  if (!appId || appId === 'PASTE_OPENEXCHANGERATES_APP_ID_HERE') return 1.05;
  try {
    const res = await fetch(
      `https://openexchangerates.org/api/historical/${dateStr}.json?app_id=${appId}`
    );
    if (res.status === 400) return 1.05;
    if (!res.ok) return 1;
    const data = await res.json();
    const eur = data?.rates?.EUR;
    if (!eur) return 1;
    return +(1 / eur).toFixed(4);
  } catch {
    return 1.05;
  }
};

const addComma = (nStr) => {
  if (!nStr && nStr !== 0) return '$0';
  nStr = (nStr + '').replace(/[^0-9.]/g, '');
  if (!nStr) return '$0';
  let [x1, x2 = ''] = nStr.split('.');
  x2 = x2 ? '.' + x2 : '';
  x1 = x1.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + x1 + x2;
};

// ─── General Inputs Section ────────────────────────────────────────────────────
const GENERAL_FIELDS = [
  { key: 'nilme',      label: 'Ni LME' },
  { key: 'MoOxideLb', label: 'Mo Oxide - Lb' },
  { key: 'chargeCrLb', label: 'Charge Cr - Lb' },
  { key: 'mt',         label: '1 MT (Lb)' },
  { key: 'euroRate',   label: 'Euro / USD' },
];

function GeneralInputs({ value, onChange, focusedField, setFocusedField, rateTime }) {
  return (
    <View>
      <View style={gs.wrap}>
        {GENERAL_FIELDS.map(f => (
          <View key={f.key} style={gs.cell}>
            <Text style={gs.cellLabel}>{f.label}</Text>
            <TextInput
              style={gs.cellInput}
              keyboardType="decimal-pad"
              value={
                focusedField === f.key
                  ? String(value?.general?.[f.key] || '')
                  : addComma(value?.general?.[f.key] || '0')
              }
              onFocus={() => setFocusedField(f.key)}
              onBlur={() => setFocusedField(null)}
              onChangeText={v => {
                const clean = v.replace(/[^0-9.]/g, '');
                onChange(f.key, clean);
              }}
            />
          </View>
        ))}
      </View>
      {rateTime && value?.general?.euroRate ? (
        <Text style={gs.rateHint}>
          1 EUR = {value.general.euroRate} USD • Updated {
            rateTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          }
        </Text>
      ) : null}
    </View>
  );
}

// ─── FeNiCr Calculator ─────────────────────────────────────────────────────────
function FeNiCrTab({ value, onChange }) {
  const fn = value?.fenicr || {};
  const g = value?.general || {};
  const fe = Math.max(0, 100 - (parseFloat(fn.ni) || 0) - (parseFloat(fn.cr) || 0) - (parseFloat(fn.mo) || 0)).toFixed(2);

  const solidsPrice =
    (parseFloat(fn.ni) || 0) * (parseFloat(g.nilme) || 0) * (parseFloat(fn.formulaNiCost) || 0) / 10000 +
    (parseFloat(fn.cr) || 0) * (parseFloat(fn.crPrice) || 0) / 100 +
    (parseFloat(fn.mo) || 0) * (parseFloat(fn.moPrice) || 0) / 100 +
    parseFloat(fe) * (parseFloat(fn.fePrice) || 0) / 100;

  const solidsPrice1 =
    (parseFloat(fn.ni) || 0) * (parseFloat(g.nilme) || 0) / 100 * (parseFloat(fn.formulaNiPrice) || 0) / 100 +
    (parseFloat(fn.cr) || 0) / 100 * (parseFloat(g.chargeCrLb) || 0) * (parseFloat(g.mt) || 0) * (parseFloat(fn.crPriceArgus) || 0) / 100 +
    (parseFloat(fn.mo) || 0) / 100 * ((parseFloat(g.MoOxideLb) || 0) * (parseFloat(fn.moPriceArgus) || 0) * (parseFloat(g.mt) || 0) / 100) +
    parseFloat(fe) * (parseFloat(fn.fePrice1) || 0) / 100;

  const fields = [
    { key: 'ni', label: 'Ni %', suffix: '%' },
    { key: 'cr', label: 'Cr %', suffix: '%' },
    { key: 'mo', label: 'Mo %', suffix: '%' },
    { key: 'formulaNiCost', label: 'Ni Cost Formula', suffix: '' },
    { key: 'formulaNiPrice', label: 'Ni Price Formula', suffix: '' },
    { key: 'crPrice', label: 'Cr Price', suffix: '' },
    { key: 'crPriceArgus', label: 'Cr Argus', suffix: '' },
    { key: 'moPrice', label: 'Mo Price', suffix: '' },
    { key: 'moPriceArgus', label: 'Mo Argus', suffix: '' },
    { key: 'fePrice', label: 'Fe Price', suffix: '' },
    { key: 'fePrice1', label: 'Fe Price (Argus)', suffix: '' },
  ];

  return (
    <View style={ts.wrap}>
      <Text style={ts.calcTitle}>FeNiCr Composition & Pricing</Text>
      <View style={ts.feRow}>
        <Text style={ts.feLabel}>Fe (auto-calc)</Text>
        <Text style={ts.feValue}>{fe}%</Text>
      </View>
      {fields.map(f => (
        <View key={f.key} style={ts.row}>
          <Text style={ts.rowLabel}>{f.label}</Text>
          <TextInput
            style={ts.rowInput}
            keyboardType="decimal-pad"
            value={String(fn[f.key] || '')}
            onChangeText={v => onChange('fenicr', f.key, v.replace(/[^0-9.]/g, ''))}
          />
        </View>
      ))}
      <View style={ts.resultBox}>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Solids Price (LME)</Text>
          <Text style={ts.resultValue}>${solidsPrice.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Solids Price (Argus)</Text>
          <Text style={ts.resultValue}>${solidsPrice1.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── SuperAlloys Calculator ────────────────────────────────────────────────────
function SuperAlloysTab({ value, onChange }) {
  const sa = value?.supperalloys || {};
  const g = value?.general || {};
  const fe = Math.max(0, 100 - (parseFloat(sa.ni) || 0) - (parseFloat(sa.cr) || 0) - (parseFloat(sa.mo) || 0)).toFixed(2);

  const solidsPrice =
    (parseFloat(sa.ni) || 0) * (parseFloat(g.nilme) || 0) * (parseFloat(sa.formulaNiCost) || 0) / 10000 +
    (parseFloat(sa.cr) || 0) * (parseFloat(sa.crPrice) || 0) / 100 +
    (parseFloat(sa.mo) || 0) * (parseFloat(sa.moPrice) || 0) / 100 +
    parseFloat(fe) * (parseFloat(sa.fePrice) || 0) / 100;

  const fields = [
    { key: 'ni', label: 'Ni %' },
    { key: 'cr', label: 'Cr %' },
    { key: 'mo', label: 'Mo %' },
    { key: 'formulaNiCost', label: 'Ni Cost Formula' },
    { key: 'crPrice', label: 'Cr Price' },
    { key: 'moPrice', label: 'Mo Price' },
    { key: 'fePrice', label: 'Fe Price' },
  ];

  return (
    <View style={ts.wrap}>
      <Text style={ts.calcTitle}>SuperAlloys Composition & Pricing</Text>
      <View style={ts.feRow}>
        <Text style={ts.feLabel}>Fe (auto-calc)</Text>
        <Text style={ts.feValue}>{fe}%</Text>
      </View>
      {fields.map(f => (
        <View key={f.key} style={ts.row}>
          <Text style={ts.rowLabel}>{f.label}</Text>
          <TextInput
            style={ts.rowInput}
            keyboardType="decimal-pad"
            value={String(sa[f.key] || '')}
            onChangeText={v => onChange('supperalloys', f.key, v.replace(/[^0-9.]/g, ''))}
          />
        </View>
      ))}
      <View style={ts.resultBox}>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Solids Price</Text>
          <Text style={ts.resultValue}>${solidsPrice.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Stainless Calculator ──────────────────────────────────────────────────────
function StainlessTab({ value, onChange }) {
  const st = value?.stainless || {};
  const g = value?.general || {};
  const fe = Math.max(0, 100 - (parseFloat(st.ni) || 0) - (parseFloat(st.cr) || 0) - (parseFloat(st.mo) || 0)).toFixed(2);

  const solidsPrice =
    (parseFloat(st.ni) || 0) * (parseFloat(g.nilme) || 0) * (parseFloat(st.formulaNiCost) || 0) / 10000 +
    (parseFloat(st.cr) || 0) * (parseFloat(st.crPrice) || 0) / 100 +
    (parseFloat(st.mo) || 0) * (parseFloat(st.moPrice) || 0) / 100 +
    parseFloat(fe) * (parseFloat(st.fePrice) || 0) / 100;

  const fields = [
    { key: 'ni', label: 'Ni %' },
    { key: 'cr', label: 'Cr %' },
    { key: 'mo', label: 'Mo %' },
    { key: 'formulaNiCost', label: 'Ni Cost Formula' },
    { key: 'crPrice', label: 'Cr Price' },
    { key: 'crPriceArgus', label: 'Cr Argus' },
    { key: 'moPrice', label: 'Mo Price' },
    { key: 'moPriceArgus', label: 'Mo Argus' },
    { key: 'fePrice', label: 'Fe Price' },
    { key: 'fePrice1', label: 'Fe Price (Argus)' },
  ];

  return (
    <View style={ts.wrap}>
      <Text style={ts.calcTitle}>Stainless Steel Composition & Pricing</Text>
      <View style={ts.feRow}>
        <Text style={ts.feLabel}>Fe (auto-calc)</Text>
        <Text style={ts.feValue}>{fe}%</Text>
      </View>
      {fields.map(f => (
        <View key={f.key} style={ts.row}>
          <Text style={ts.rowLabel}>{f.label}</Text>
          <TextInput
            style={ts.rowInput}
            keyboardType="decimal-pad"
            value={String(st[f.key] || '')}
            onChangeText={v => onChange('stainless', f.key, v.replace(/[^0-9.]/g, ''))}
          />
        </View>
      ))}
      <View style={ts.resultBox}>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Solids Price</Text>
          <Text style={ts.resultValue}>${solidsPrice.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
const TABS = ['General', 'FeNiCr', 'SuperAlloys', 'Stainless'];

export default function FormulasScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection } = UserAuth();
  const [value, setValue] = useState({ general: {} });
  const [loading, setLoading] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [focusedField, setFocusedField] = useState(null);
  const [rateTime, setRateTime] = useState(null);

  const hasLoadedRef = useRef(false);
  const saveTimerRef = useRef(null);

  // Also keep the simple calculators
  const [margin, setMargin] = useState({ cost: '', sell: '' });
  const [markup, setMarkup] = useState({ cost: '', profit: '' });

  const marginResult = margin.cost && margin.sell
    ? (((Number(margin.sell) - Number(margin.cost)) / Number(margin.sell)) * 100).toFixed(2)
    : null;
  const markupResult = markup.cost && markup.profit
    ? ((Number(markup.profit) / Number(markup.cost)) * 100).toFixed(2)
    : null;

  useEffect(() => {
    const load = async () => {
      if (!uidCollection) return;
      try {
        setLoading(true);
        let data = await loadDataSettings(uidCollection, SETTINGS_DOCS.FORMULAS_CALC);
        if (!data?.general) data = { general: {} };

        // Fetch live Euro/USD rate
        const rate = await getCur();
        setRateTime(new Date());
        data = {
          ...data,
          general: { ...data.general, euroRate: rate || data.general?.euroRate || 1.05 },
        };
        setValue(data);
        hasLoadedRef.current = true;
      } catch (e) {
        console.error('FormulasScreen load:', e);
        setValue({ general: {} });
        hasLoadedRef.current = true;
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uidCollection]);

  // Debounced auto-save: fires 800ms after any value change post-load
  useEffect(() => {
    if (!hasLoadedRef.current || !uidCollection) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setAutoSaving(true);
      await saveDataSettings(uidCollection, SETTINGS_DOCS.FORMULAS_CALC, value);
      setAutoSaving(false);
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [value]);

  const handleGeneralChange = (key, val) => {
    setValue(prev => ({ ...prev, general: { ...prev.general, [key]: val } }));
  };

  const handleTabChange = (section, key, val) => {
    setValue(prev => ({ ...prev, [section]: { ...(prev[section] || {}), [key]: val } }));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Formulas Calc" navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Material Tabs Section ── */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flask-outline" size={20} color="#0366ae" />
            <Text style={styles.sectionTitle}>Material Calculators</Text>
            {autoSaving && (
              <View style={styles.autoSaveRow}>
                <ActivityIndicator size="small" color="#9fb8d4" />
                <Text style={styles.autoSaveText}>Saving…</Text>
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color="#0366ae" style={{ marginVertical: 20 }} />
          ) : (
            <>
              {/* Tab selector */}
              <View style={styles.tabBar}>
                {TABS.map((t, i) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tabBtn, activeTab === i && styles.tabBtnActive]}
                    onPress={() => setActiveTab(i)}
                  >
                    <Text style={[styles.tabLabel, activeTab === i && styles.tabLabelActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tab content */}
              {activeTab === 0 && (
                <>
                  <Text style={styles.subsectionLabel}>General Inputs</Text>
                  <GeneralInputs
                    value={value}
                    onChange={handleGeneralChange}
                    focusedField={focusedField}
                    setFocusedField={setFocusedField}
                    rateTime={rateTime}
                  />
                </>
              )}
              {activeTab === 1 && <FeNiCrTab value={value} onChange={handleTabChange} />}
              {activeTab === 2 && <SuperAlloysTab value={value} onChange={handleTabChange} />}
              {activeTab === 3 && <StainlessTab value={value} onChange={handleTabChange} />}
            </>
          )}
        </Card>

        {/* ── Margin Calculator ── */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calculator-outline" size={20} color="#0366ae" />
            <Text style={styles.sectionTitle}>Margin Calculator</Text>
          </View>
          <Text style={styles.inputLabel}>Cost Price</Text>
          <TextInput
            style={styles.input}
            value={margin.cost}
            onChangeText={v => setMargin(p => ({ ...p, cost: v }))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9fb8d4"
          />
          <Text style={styles.inputLabel}>Selling Price</Text>
          <TextInput
            style={styles.input}
            value={margin.sell}
            onChangeText={v => setMargin(p => ({ ...p, sell: v }))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9fb8d4"
          />
          {marginResult !== null && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Gross Margin</Text>
              <Text style={styles.resultValue}>{marginResult}%</Text>
            </View>
          )}
        </Card>

        {/* ── Markup Calculator ── */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up-outline" size={20} color="#0366ae" />
            <Text style={styles.sectionTitle}>Markup Calculator</Text>
          </View>
          <Text style={styles.inputLabel}>Cost</Text>
          <TextInput
            style={styles.input}
            value={markup.cost}
            onChangeText={v => setMarkup(p => ({ ...p, cost: v }))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9fb8d4"
          />
          <Text style={styles.inputLabel}>Profit</Text>
          <TextInput
            style={styles.input}
            value={markup.profit}
            onChangeText={v => setMarkup(p => ({ ...p, profit: v }))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9fb8d4"
          />
          {markupResult !== null && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Markup %</Text>
              <Text style={styles.resultValue}>{markupResult}%</Text>
            </View>
          )}
        </Card>

      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  card: { padding: 16, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#103a7a', flex: 1 },
  autoSaveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  autoSaveText: { fontSize: 11, color: '#9fb8d4' },
  subsectionLabel: { fontSize: 11, fontWeight: '700', color: '#9fb8d4', textTransform: 'uppercase', marginTop: 4 },
  tabBar: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#f0f8ff', borderWidth: 1, borderColor: '#b8ddf8',
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#0366ae', borderColor: '#0366ae' },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#0366ae' },
  tabLabelActive: { color: '#fff' },
  inputLabel: { fontSize: 11, fontWeight: '600', color: '#9fb8d4', textTransform: 'uppercase' },
  input: {
    backgroundColor: '#f8fbff', borderWidth: 1, borderColor: '#b8ddf8',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#103a7a',
  },
  resultBox: {
    backgroundColor: '#ebf2fc', borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  resultLabel: { fontSize: 13, fontWeight: '600', color: '#103a7a' },
  resultValue: { fontSize: 22, fontWeight: '800', color: '#0366ae' },
});

const gs = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    flex: 1, minWidth: 90,
    borderWidth: 1, borderColor: '#b8ddf8', borderRadius: 10, overflow: 'hidden',
  },
  cellLabel: {
    fontSize: 9, fontWeight: '700', color: '#0366ae',
    backgroundColor: '#dbeeff', textAlign: 'center', paddingVertical: 4,
  },
  cellInput: {
    fontSize: 12, fontWeight: '600', color: '#e53e3e',
    textAlign: 'center', paddingVertical: 6, backgroundColor: '#fff',
  },
  rateHint: {
    fontSize: 10, color: '#9fb8d4', textAlign: 'right',
    marginTop: 4, fontStyle: 'italic',
  },
});

const ts = StyleSheet.create({
  wrap: { gap: 8, marginTop: 4 },
  calcTitle: { fontSize: 12, fontWeight: '700', color: '#103a7a', marginBottom: 4 },
  feRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f0f4f8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  feLabel: { fontSize: 12, color: '#9fb8d4', fontWeight: '600' },
  feValue: { fontSize: 13, fontWeight: '700', color: '#103a7a' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#f0f4f8', paddingVertical: 6,
  },
  rowLabel: { fontSize: 12, color: '#103a7a', flex: 1 },
  rowInput: {
    width: 100, textAlign: 'right', fontSize: 13, fontWeight: '600', color: '#e53e3e',
    backgroundColor: '#f8fbff', borderWidth: 1, borderColor: '#b8ddf8',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  resultBox: { backgroundColor: '#ebf2fc', borderRadius: 10, padding: 12, gap: 6, marginTop: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resultLabel: { fontSize: 12, color: '#103a7a', fontWeight: '600' },
  resultValue: { fontSize: 14, fontWeight: '800', color: '#0366ae' },
});
