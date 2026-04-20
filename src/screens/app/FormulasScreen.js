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
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';

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
  const ni = parseFloat(fn.ni) || 0;
  const cr = parseFloat(fn.cr) || 0;
  const mo = parseFloat(fn.mo) || 0;
  const fe = Math.max(0, 100 - ni - cr - mo).toFixed(2);
  const feN = parseFloat(fe);
  const euroRate = parseFloat(g.euroRate) || 1;

  // Cost (LME)
  const costSolids =
    ni * (parseFloat(g.nilme) || 0) * (parseFloat(fn.formulaNiCost) || 0) / 10000 +
    cr * (parseFloat(fn.crPrice) || 0) / 100 +
    mo * (parseFloat(fn.moPrice) || 0) / 100 +
    feN * (parseFloat(fn.fePrice) || 0) / 100;
  const costTurnings = costSolids * 0.92;
  const costPriceEuro = euroRate > 0 ? costSolids / euroRate : 0;

  // Sales (Argus)
  const salesSolids =
    ni * (parseFloat(g.nilme) || 0) / 100 * (parseFloat(fn.formulaNiPrice) || 0) / 100 +
    cr / 100 * (parseFloat(g.chargeCrLb) || 0) * (parseFloat(g.mt) || 0) * (parseFloat(fn.crPriceArgus) || 0) / 100 +
    mo / 100 * ((parseFloat(g.MoOxideLb) || 0) * (parseFloat(fn.moPriceArgus) || 0) * (parseFloat(g.mt) || 0) / 100) +
    feN * (parseFloat(fn.fePrice1) || 0) / 100;
  const salesTurnings = salesSolids * 0.9;
  const salesPriceEuro = euroRate > 0 ? salesSolids / euroRate : 0;

  const compFields = [
    { key: 'ni', label: 'Ni %' },
    { key: 'cr', label: 'Cr %' },
    { key: 'mo', label: 'Mo %' },
  ];
  const costFields = [
    { key: 'formulaNiCost', label: 'Ni Cost Formula' },
    { key: 'crPrice', label: 'Cr Price' },
    { key: 'moPrice', label: 'Mo Price' },
    { key: 'fePrice', label: 'Fe Price' },
  ];
  const salesFields = [
    { key: 'formulaNiPrice', label: 'Ni Price Formula' },
    { key: 'crPriceArgus', label: 'Cr Price (Argus)' },
    { key: 'moPriceArgus', label: 'Mo Price (Argus)' },
    { key: 'fePrice1', label: 'Fe Price (Argus)' },
  ];

  return (
    <View style={ts.wrap}>
      <Text style={ts.calcTitle}>FeNiCr Composition & Pricing</Text>

      {/* Composition */}
      {compFields.map(f => (
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
      <View style={ts.feRow}>
        <Text style={ts.feLabel}>Fe (auto-calc)</Text>
        <Text style={ts.feValue}>{fe}%</Text>
      </View>

      {/* Cost Section */}
      <View style={ts.sectionHeader}>
        <Text style={ts.sectionLabelCost}>Cost (LME)</Text>
      </View>
      {costFields.map(f => (
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
          <Text style={ts.resultValue}>${costSolids.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Turnings (×0.92)</Text>
          <Text style={ts.resultValue}>${costTurnings.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Price / Euro</Text>
          <Text style={ts.resultValue}>€{costPriceEuro.toFixed(2)}</Text>
        </View>
      </View>

      {/* Sales Section */}
      <View style={ts.sectionHeader}>
        <Text style={ts.sectionLabelSales}>Sales (Argus)</Text>
      </View>
      {salesFields.map(f => (
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
          <Text style={ts.resultLabel}>Solids Price (Argus)</Text>
          <Text style={ts.resultValue}>${salesSolids.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Turnings (×0.9)</Text>
          <Text style={ts.resultValue}>${salesTurnings.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Price / Euro</Text>
          <Text style={ts.resultValue}>€{salesPriceEuro.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── SuperAlloys Calculator ────────────────────────────────────────────────────
function SuperAlloysTab({ value, onChange }) {
  const sa = value?.supperalloys || {};
  const g = value?.general || {};
  const ni = parseFloat(sa.ni) || 0;
  const cr = parseFloat(sa.cr) || 0;
  const mo = parseFloat(sa.mo) || 0;
  const nb = parseFloat(sa.nb) || 0;
  const co = parseFloat(sa.co) || 0;
  const w  = parseFloat(sa.w)  || 0;
  const hf = parseFloat(sa.hf) || 0;
  const ta = parseFloat(sa.ta) || 0;
  const fe = Math.max(0, 100 - ni - cr - mo - nb - co - w - hf - ta).toFixed(2);

  const nilme = parseFloat(g.nilme) || 0;
  const mt = parseFloat(g.mt) || 1;
  const euroRate = parseFloat(g.euroRate) || 1;
  const moOxide = parseFloat(g.MoOxideLb) || 0;

  // Read-only computed prices
  const niPrice = mt > 0 ? nilme / mt : 0;
  const moPrice = moOxide;

  // Base solids price from all 8 elements
  const solidsPrice =
    ni * niPrice / 100 +
    cr * (parseFloat(sa.crPrice) || 0) / 100 +
    mo * moPrice / 100 +
    nb * (parseFloat(sa.nbPrice) || 0) / 100 +
    co * (parseFloat(sa.coPrice) || 0) / 100 +
    w  * (parseFloat(sa.wPrice)  || 0) / 100 +
    hf * (parseFloat(sa.hfPrice) || 0) / 100 +
    ta * (parseFloat(sa.taPrice) || 0) / 100;

  const formulaIntsCost  = parseFloat(sa.formulaIntsCost)  || 0;
  const formulaIntsPrice = parseFloat(sa.formulaIntsPrice) || 0;
  const costSolids       = solidsPrice * formulaIntsCost  / 100;
  const salesSolids      = solidsPrice * formulaIntsPrice / 100;
  const costPricePerMT   = costSolids  * mt;
  const salesPricePerMT  = salesSolids * mt;
  const costPriceEuro    = euroRate > 0 ? costSolids  / euroRate : 0;
  const salesPriceEuro   = euroRate > 0 ? salesSolids / euroRate : 0;

  const compFields = [
    { key: 'ni', label: 'Ni %' },
    { key: 'cr', label: 'Cr %' },
    { key: 'mo', label: 'Mo %' },
    { key: 'nb', label: 'Nb %' },
    { key: 'co', label: 'Co %' },
    { key: 'w',  label: 'W %' },
    { key: 'hf', label: 'Hf %' },
    { key: 'ta', label: 'Ta %' },
  ];
  const priceFields = [
    { key: 'crPrice', label: 'Cr Price' },
    { key: 'nbPrice', label: 'Nb Price' },
    { key: 'coPrice', label: 'Co Price' },
    { key: 'wPrice',  label: 'W Price' },
    { key: 'hfPrice', label: 'Hf Price' },
    { key: 'taPrice', label: 'Ta Price' },
  ];

  return (
    <View style={ts.wrap}>
      <Text style={ts.calcTitle}>SuperAlloys Composition & Pricing</Text>

      {/* Composition */}
      {compFields.map(f => (
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
      <View style={ts.feRow}>
        <Text style={ts.feLabel}>Fe (auto-calc)</Text>
        <Text style={ts.feValue}>{fe}%</Text>
      </View>

      {/* Read-only computed prices */}
      <View style={ts.readOnlyRow}>
        <Text style={ts.rowLabel}>Ni Price (NiLME / MT)</Text>
        <Text style={ts.readOnlyValue}>${niPrice.toFixed(4)}</Text>
      </View>
      <View style={ts.readOnlyRow}>
        <Text style={ts.rowLabel}>Mo Price (MoOxide Lb)</Text>
        <Text style={ts.readOnlyValue}>${moOxide.toFixed(4)}</Text>
      </View>

      {/* Element price inputs */}
      {priceFields.map(f => (
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

      {/* Base solids */}
      <View style={ts.resultBox}>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Solids Price</Text>
          <Text style={ts.resultValue}>${solidsPrice.toFixed(4)}</Text>
        </View>
      </View>

      {/* Formula Intrinsic % */}
      <View style={ts.sectionHeader}>
        <Text style={ts.sectionLabelCost}>Formula Intrinsic</Text>
      </View>
      <View style={ts.row}>
        <Text style={ts.rowLabel}>Cost %</Text>
        <TextInput
          style={ts.rowInput}
          keyboardType="decimal-pad"
          value={String(sa.formulaIntsCost || '')}
          onChangeText={v => onChange('supperalloys', 'formulaIntsCost', v.replace(/[^0-9.]/g, ''))}
        />
      </View>
      <View style={ts.row}>
        <Text style={ts.rowLabel}>Price %</Text>
        <TextInput
          style={ts.rowInput}
          keyboardType="decimal-pad"
          value={String(sa.formulaIntsPrice || '')}
          onChangeText={v => onChange('supperalloys', 'formulaIntsPrice', v.replace(/[^0-9.]/g, ''))}
        />
      </View>

      {/* Cost Results */}
      <View style={ts.sectionHeader}>
        <Text style={ts.sectionLabelCost}>Cost Results</Text>
      </View>
      <View style={ts.resultBox}>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Solids (Cost)</Text>
          <Text style={ts.resultValue}>${costSolids.toFixed(4)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Price per MT</Text>
          <Text style={ts.resultValue}>${costPricePerMT.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Price / Euro</Text>
          <Text style={ts.resultValue}>€{costPriceEuro.toFixed(4)}</Text>
        </View>
      </View>

      {/* Sales Results */}
      <View style={ts.sectionHeader}>
        <Text style={ts.sectionLabelSales}>Sales Results</Text>
      </View>
      <View style={ts.resultBox}>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Solids (Sales)</Text>
          <Text style={ts.resultValue}>${salesSolids.toFixed(4)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Price per MT</Text>
          <Text style={ts.resultValue}>${salesPricePerMT.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Price / Euro</Text>
          <Text style={ts.resultValue}>€{salesPriceEuro.toFixed(4)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Stainless Calculator ──────────────────────────────────────────────────────
function StainlessTab({ value, onChange }) {
  const st = value?.stainless || {};
  const g = value?.general || {};
  const ni = parseFloat(st.ni) || 0;
  const cr = parseFloat(st.cr) || 0;
  const mo = parseFloat(st.mo) || 0;
  const fe = Math.max(0, 100 - ni - cr - mo).toFixed(2);
  const feN = parseFloat(fe);
  const euroRate = parseFloat(g.euroRate) || 1;

  // Cost (LME)
  const costSolids =
    ni * (parseFloat(g.nilme) || 0) * (parseFloat(st.formulaNiCost) || 0) / 10000 +
    cr * (parseFloat(st.crPrice) || 0) / 100 +
    mo * (parseFloat(st.moPrice) || 0) / 100 +
    feN * (parseFloat(st.fePrice) || 0) / 100;
  const costTurnings = costSolids * 0.92;
  const costPriceEuro = euroRate > 0 ? costSolids / euroRate : 0;

  // Sales (Argus)
  const salesSolids =
    ni * (parseFloat(g.nilme) || 0) / 100 * (parseFloat(st.formulaNiPrice) || 0) / 100 +
    cr / 100 * (parseFloat(g.chargeCrLb) || 0) * (parseFloat(g.mt) || 0) * (parseFloat(st.crPriceArgus) || 0) / 100 +
    mo / 100 * ((parseFloat(g.MoOxideLb) || 0) * (parseFloat(st.moPriceArgus) || 0) * (parseFloat(g.mt) || 0) / 100) +
    feN * (parseFloat(st.fePrice1) || 0) / 100;
  const salesTurnings = salesSolids * 0.9;
  const salesPriceEuro = euroRate > 0 ? salesSolids / euroRate : 0;

  const compFields = [
    { key: 'ni', label: 'Ni %' },
    { key: 'cr', label: 'Cr %' },
    { key: 'mo', label: 'Mo %' },
  ];
  const costFields = [
    { key: 'formulaNiCost', label: 'Ni Cost Formula' },
    { key: 'crPrice', label: 'Cr Price' },
    { key: 'moPrice', label: 'Mo Price' },
    { key: 'fePrice', label: 'Fe Price' },
  ];
  const salesFields = [
    { key: 'formulaNiPrice', label: 'Ni Price Formula' },
    { key: 'crPriceArgus', label: 'Cr Price (Argus)' },
    { key: 'moPriceArgus', label: 'Mo Price (Argus)' },
    { key: 'fePrice1', label: 'Fe Price (Argus)' },
  ];

  return (
    <View style={ts.wrap}>
      <Text style={ts.calcTitle}>Stainless Steel Composition & Pricing</Text>

      {/* Composition */}
      {compFields.map(f => (
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
      <View style={ts.feRow}>
        <Text style={ts.feLabel}>Fe (auto-calc)</Text>
        <Text style={ts.feValue}>{fe}%</Text>
      </View>

      {/* Cost Section */}
      <View style={ts.sectionHeader}>
        <Text style={ts.sectionLabelCost}>Cost (LME)</Text>
      </View>
      {costFields.map(f => (
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
          <Text style={ts.resultLabel}>Solids Price (LME)</Text>
          <Text style={ts.resultValue}>${costSolids.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Turnings (×0.92)</Text>
          <Text style={ts.resultValue}>${costTurnings.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Price / Euro</Text>
          <Text style={ts.resultValue}>€{costPriceEuro.toFixed(2)}</Text>
        </View>
      </View>

      {/* Sales Section */}
      <View style={ts.sectionHeader}>
        <Text style={ts.sectionLabelSales}>Sales (Argus)</Text>
      </View>
      {salesFields.map(f => (
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
          <Text style={ts.resultLabel}>Solids Price (Argus)</Text>
          <Text style={ts.resultValue}>${salesSolids.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Turnings (×0.9)</Text>
          <Text style={ts.resultValue}>${salesTurnings.toFixed(2)}</Text>
        </View>
        <View style={ts.resultRow}>
          <Text style={ts.resultLabel}>Price / Euro</Text>
          <Text style={ts.resultValue}>€{salesPriceEuro.toFixed(2)}</Text>
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
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: getBottomPad(insets) }]} keyboardShouldPersistTaps="handled">

        {/* ── Material Tabs Section ── */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flask-outline" size={20} color={C.accent} />
            <Text style={styles.sectionTitle}>Material Calculators</Text>
            {autoSaving && (
              <View style={styles.autoSaveRow}>
                <ActivityIndicator size="small" color={C.text2} />
                <Text style={styles.autoSaveText}>Saving…</Text>
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical: 20 }} />
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
            <Ionicons name="calculator-outline" size={20} color={C.accent} />
            <Text style={styles.sectionTitle}>Margin Calculator</Text>
          </View>
          <Text style={styles.inputLabel}>Cost Price</Text>
          <TextInput
            style={styles.input}
            value={margin.cost}
            onChangeText={v => setMargin(p => ({ ...p, cost: v }))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={C.text3}
          />
          <Text style={styles.inputLabel}>Selling Price</Text>
          <TextInput
            style={styles.input}
            value={margin.sell}
            onChangeText={v => setMargin(p => ({ ...p, sell: v }))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={C.text3}
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
            <Ionicons name="trending-up-outline" size={20} color={C.accent} />
            <Text style={styles.sectionTitle}>Markup Calculator</Text>
          </View>
          <Text style={styles.inputLabel}>Cost</Text>
          <TextInput
            style={styles.input}
            value={markup.cost}
            onChangeText={v => setMarkup(p => ({ ...p, cost: v }))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={C.text3}
          />
          <Text style={styles.inputLabel}>Profit</Text>
          <TextInput
            style={styles.input}
            value={markup.profit}
            onChangeText={v => setMarkup(p => ({ ...p, profit: v }))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={C.text3}
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
  root: { flex: 1, backgroundColor: C.bgPrimary },
  scroll: { padding: 16, gap: 16 },
  card: { padding: 16, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text1, flex: 1 },
  autoSaveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  autoSaveText: { fontSize: 11, color: C.text2 },
  subsectionLabel: { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', marginTop: 4 },
  tabBar: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 999,
    backgroundColor: C.bgPrimary, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  tabLabel: { fontSize: 11, fontWeight: '600', color: C.accent },
  tabLabelActive: { color: C.text1 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: C.text2, textTransform: 'uppercase' },
  input: {
    backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.text1,
  },
  resultBox: {
    backgroundColor: C.bgTertiary, borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  resultLabel: { fontSize: 13, fontWeight: '600', color: C.text1 },
  resultValue: { fontSize: 22, fontWeight: '800', color: C.accent },
});

const gs = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    flex: 1, minWidth: 90,
    borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden',
  },
  cellLabel: {
    fontSize: 9, fontWeight: '700', color: C.accent,
    backgroundColor: C.bgTertiary, textAlign: 'center', paddingVertical: 4,
  },
  cellInput: {
    fontSize: 12, fontWeight: '600', color: C.danger,
    textAlign: 'center', paddingVertical: 6, backgroundColor: C.bg2,
  },
  rateHint: {
    fontSize: 10, color: C.text2, textAlign: 'right',
    marginTop: 4, fontStyle: 'italic',
  },
});

const ts = StyleSheet.create({
  wrap: { gap: 8, marginTop: 4 },
  calcTitle: { fontSize: 12, fontWeight: '700', color: C.text1, marginBottom: 4 },
  feRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  feLabel: { fontSize: 12, color: C.text2, fontWeight: '600' },
  feValue: { fontSize: 13, fontWeight: '700', color: C.text1 },
  sectionHeader: {
    marginTop: 10, marginBottom: 2,
    paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: C.accentGlow,
  },
  sectionLabelCost:  { fontSize: 11, fontWeight: '700', color: C.accent, textTransform: 'uppercase' },
  sectionLabelSales: { fontSize: 11, fontWeight: '700', color: C.success, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: C.bg1, paddingVertical: 6,
  },
  rowLabel: { fontSize: 12, color: C.text1, flex: 1 },
  rowInput: {
    width: 100, textAlign: 'right', fontSize: 13, fontWeight: '600', color: C.danger,
    backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  readOnlyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: C.bg1, paddingVertical: 6,
    backgroundColor: C.bg2, paddingHorizontal: 4, borderRadius: 4,
  },
  readOnlyValue: { fontSize: 13, fontWeight: '700', color: C.text1 },
  resultBox: { backgroundColor: C.bgTertiary, borderRadius: 10, padding: 12, gap: 6, marginTop: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resultLabel: { fontSize: 12, color: C.text1, fontWeight: '600' },
  resultValue: { fontSize: 14, fontWeight: '800', color: C.accent },
});
