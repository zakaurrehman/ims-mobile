// Dashboard screen — full parity with ims-main/app/(root)/dashboard/page.js
// D1: Real metals-api.com prices (9 metals, 30-min cache, 24h change)
// D2: Per-MT metrics card (totalMT, avgCost/MT, avgExpense/MT, avgProfit/MT)
// D3: KPI cards match web exactly (P&L, Sales Revenue, Total Costs, MT, Expenses, Avg Profit/MT)
// D4: Currency pairs expanded — AED and CNY added to match web's 10 pairs
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Dimensions, Animated as RNAnimated, Easing,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Polyline, Rect, Text as SvgText, Line } from 'react-native-svg';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { getName } from '../../shared/utils/helpers';
import ErrorState from '../../components/ErrorState';
import Card from '../../components/ui/Card';
import SectionHeader from '../../components/ui/SectionHeader';
import { SkeletonCard, SkeletonStat } from '../../components/ui/SkeletonLoader';
import YearPicker from '../../components/YearPicker';
import { COLLECTIONS } from '../../constants/collections';
import { getBottomPad, space, radius } from '../../theme/spacing';
import { colors } from '../../theme/colors';
import { type } from '../../theme/typography';
import useMetalPrices from '../../shared/hooks/useMetalPrices';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SCREEN_W = Dimensions.get('window').width;
const MO_LABELS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

// ─── D4: All currencies (web has AED + CNY — added here) ─────────────────────
const ALL_CURRENCIES = ['USD', 'EUR', 'GBP', 'ILS', 'RUB', 'AED', 'CNY'];
const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', ILS: '₪', RUB: '₽', AED: 'د.إ', CNY: '¥',
};

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmtShort = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return '$0';
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000)     return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

const fmtMT = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0 MT';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num)} MT`;
};

// ─── D1: FX rates hook ────────────────────────────────────────────────────────
function useFXRates() {
  const [rates, setRates] = useState({
    USD: 1, EUR: 0.9150, GBP: 0.7850, ILS: 3.710,
    RUB: 89.50, AED: 3.672, CNY: 7.243,
  });
  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json())
      .then(d => {
        if (d?.rates) {
          setRates({
            USD: 1,
            EUR: d.rates.EUR || 0.9150,
            GBP: d.rates.GBP || 0.7850,
            ILS: d.rates.ILS || 3.710,
            RUB: d.rates.RUB || 89.50,
            AED: d.rates.AED || 3.672,
            CNY: d.rates.CNY || 7.243,
          });
        }
      })
      .catch(() => {});
  }, []);
  return { rates };
}

// Cross rate: units of quote per 1 base. rates[X] = X per 1 USD.
const getCrossRate = (rates, base, quote) => {
  const rBase  = base  === 'USD' ? 1 : rates[base];
  const rQuote = quote === 'USD' ? 1 : rates[quote];
  if (!rBase || !rQuote) return null;
  return rQuote / rBase;
};

// Hex color → rgba string for icon dim backgrounds
const toDim = (hex) => {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.15)`;
  } catch { return colors.accentGlow; }
};

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color = colors.accent, width = 80, height = 28 }) {
  const vals = data.filter(v => v !== 0);
  if (vals.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - 2 - ((v - min) / range) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
    </Svg>
  );
}

// ─── Dashboard Header ─────────────────────────────────────────────────────────
function DashHeader({ name, companyName }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = (companyName || name || 'there').split(' ')[0];
  const initial = displayName[0].toUpperCase();

  return (
    <View style={hdStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={hdStyles.greeting}>{greeting},</Text>
        <Text style={hdStyles.name}>{displayName}</Text>
      </View>
      <View style={hdStyles.actions}>
        <TouchableOpacity style={hdStyles.iconBtn}>
          <Feather name="bell" size={20} color={colors.text2} />
        </TouchableOpacity>
        <View style={hdStyles.avatar}>
          <Text style={hdStyles.avatarText}>{initial}</Text>
        </View>
      </View>
    </View>
  );
}

const hdStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    paddingTop: space.sm,
  },
  greeting: { ...type.bodyMuted },
  name:     { ...type.title, fontSize: 22 },
  actions:  { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border1,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 36, height: 36, borderRadius: radius.pill,
    backgroundColor: colors.accentGlow, borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...type.body, fontWeight: '700', color: colors.accent },
});

// ─── Hero P&L Card ─────────────────────────────────────────────────────────────
function HeroPnlCard({ pnl, prevPnl }) {
  const anim = useRef(new RNAnimated.Value(0)).current;
  const [display, setDisplay] = useState('$0');
  const isPositive = pnl >= 0;
  const valueColor = isPositive ? colors.success : colors.danger;

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(fmtShort(v)));
    anim.setValue(0);
    RNAnimated.timing(anim, { toValue: pnl, duration: 1100, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [pnl]);

  const changePct = prevPnl && prevPnl !== 0
    ? ((pnl - prevPnl) / Math.abs(prevPnl) * 100).toFixed(1)
    : null;

  return (
    <Card variant="elevated" style={heroStyles.card}>
      <Text style={heroStyles.label}>Total P&L</Text>
      <RNAnimated.Text style={[heroStyles.value, { color: valueColor }]}>
        {display}
      </RNAnimated.Text>
      {changePct !== null && (
        <View style={heroStyles.changeRow}>
          <Feather
            name={isPositive ? 'trending-up' : 'trending-down'}
            size={13}
            color={valueColor}
          />
          <Text style={[heroStyles.changeTxt, { color: valueColor }]}>
            {isPositive ? '+' : ''}{changePct}% vs previous period
          </Text>
        </View>
      )}
    </Card>
  );
}

const heroStyles = StyleSheet.create({
  card: { marginBottom: 0 },
  label: { ...type.sectionLabel, marginBottom: space.sm },
  value: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -2,
    lineHeight: 46,
  },
  changeRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginTop: space.sm,
  },
  changeTxt: { ...type.caption },
});

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function DashKpiCard({ label, rawValue, displayValue, accentColor, featherIcon, sparkData }) {
  const anim = useRef(new RNAnimated.Value(0)).current;
  const [display, setDisplay] = useState(displayValue);

  useEffect(() => {
    setDisplay(displayValue);
    if (typeof rawValue === 'number') {
      const id = anim.addListener(({ value: v }) => setDisplay(fmtShort(v)));
      anim.setValue(0);
      RNAnimated.timing(anim, { toValue: rawValue, duration: 900, useNativeDriver: false }).start();
      return () => anim.removeListener(id);
    }
  }, [rawValue, displayValue]);

  const dimBg = toDim(accentColor);

  return (
    <View style={kpiStyles.card}>
      {/* Left accent bar */}
      <View style={[kpiStyles.accentBar, { backgroundColor: accentColor }]} />
      <View style={kpiStyles.content}>
        <View style={[kpiStyles.iconCircle, { backgroundColor: dimBg }]}>
          <Feather name={featherIcon} size={13} color={accentColor} />
        </View>
        <Text style={[kpiStyles.value, { color: accentColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {display}
        </Text>
        {sparkData && (
          <Sparkline data={sparkData} color={accentColor} width={SCREEN_W / 2 - 76} height={22} />
        )}
        <Text style={kpiStyles.label} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    width: '47%',
    backgroundColor: colors.bg2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border2,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 110,
  },
  accentBar: { width: 3 },
  content: { flex: 1, padding: 12, gap: 3, justifyContent: 'space-between' },
  iconCircle: {
    width: 26, height: 26,
    borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

// ─── Per-MT Metrics Card ──────────────────────────────────────────────────────
function PerMtCard({ totalMT, avgCostPerMT, avgExpensePerMT, avgProfitPerMT }) {
  const profitColor = avgProfitPerMT >= 0 ? colors.success : colors.danger;

  const cells = [
    { icon: 'layers',      value: fmtMT(totalMT),           label: 'Total MT',       color: colors.success  },
    { icon: 'clock',       value: fmtShort(avgCostPerMT),   label: 'Avg Cost / MT',  color: colors.warning  },
    { icon: 'credit-card', value: fmtShort(avgExpensePerMT),label: 'Avg Expense / MT',color: colors.accent  },
    { icon: avgProfitPerMT >= 0 ? 'trending-up' : 'trending-down',
                           value: fmtShort(avgProfitPerMT), label: 'Avg Profit / MT', color: profitColor    },
  ];

  return (
    <Card variant="elevated" style={pmStyles.card}>
      <View style={pmStyles.grid}>
        {cells.map((c, i) => (
          <React.Fragment key={i}>
            <View style={pmStyles.cell}>
              <View style={[pmStyles.iconWrap, { backgroundColor: toDim(c.color) }]}>
                <Feather name={c.icon} size={15} color={c.color} />
              </View>
              <Text style={[pmStyles.val, { color: c.color }]}>{c.value}</Text>
              <Text style={pmStyles.cellLabel}>{c.label}</Text>
            </View>
            {/* Vertical divider after col 1 */}
            {i === 1 && <View style={pmStyles.vDivider} />}
            {i === 0 && <View style={pmStyles.vDivider} />}
          </React.Fragment>
        ))}
      </View>
    </Card>
  );
}

const pmStyles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    padding: space.lg,
    gap: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border1,
  },
  vDivider: {
    // Not used — borders handled via cell borderRight
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: space.xs,
  },
  val: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  cellLabel: { fontSize: 10, color: colors.text3, fontWeight: '500' },
});

// ─── Revenue vs Costs Chart ───────────────────────────────────────────────────
function RevenueChart({ income, costs }) {
  const W = SCREEN_W - (space.lg * 2) - 32;
  const H = 110;
  const slotW = W / 12;
  const barW  = slotW * 0.32;
  const allVals = [...income, ...costs];
  const maxVal  = Math.max(...allVals, 1);

  return (
    <Card variant="elevated" style={rcStyles.card}>
      <View style={rcStyles.header}>
        <Text style={rcStyles.title}>Revenue vs Costs</Text>
        <View style={rcStyles.legend}>
          <View style={rcStyles.legendItem}>
            <View style={[rcStyles.legendDot, { backgroundColor: colors.accent }]} />
            <Text style={rcStyles.legendLbl}>Revenue</Text>
          </View>
          <View style={rcStyles.legendItem}>
            <View style={[rcStyles.legendDot, { backgroundColor: colors.danger }]} />
            <Text style={rcStyles.legendLbl}>Costs</Text>
          </View>
        </View>
      </View>
      <Svg width={W} height={H + 18}>
        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <Line
            key={i}
            x1={0} y1={H - H * f}
            x2={W} y2={H - H * f}
            stroke={colors.border1}
            strokeWidth="1"
          />
        ))}
        {income.map((v, i) => {
          const incH = Math.max((v / maxVal) * H, 0);
          const cosH = Math.max((costs[i] / maxVal) * H, 0);
          const x    = i * slotW;
          return (
            <React.Fragment key={i}>
              <Rect
                x={x + slotW * 0.05} y={H - incH}
                width={barW} height={incH}
                fill={colors.accent} rx="2" opacity="0.85"
              />
              <Rect
                x={x + slotW * 0.05 + barW + 2} y={H - cosH}
                width={barW} height={cosH}
                fill={colors.danger} rx="2" opacity="0.75"
              />
              <SvgText
                x={x + slotW / 2} y={H + 14}
                fontSize="7" fill={colors.text3} textAnchor="middle"
              >
                {MO_LABELS[i]}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </Card>
  );
}

const rcStyles = StyleSheet.create({
  card: { padding: space.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  title: { ...type.heading, fontSize: 14 },
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLbl: { fontSize: 9, color: colors.text3, fontWeight: '600' },
});

// ─── Breakdown Card ───────────────────────────────────────────────────────────
const BREAKDOWN_PALETTE = [
  colors.accent, colors.purple, colors.success, colors.warning,
  colors.danger, '#0891b2', '#6366F1', '#22B0F0',
];

function DashBreakdownCard({ title, subtitle, data, accentColor }) {
  const entries = Object.entries(data).slice(0, 8);
  const max   = Math.max(...entries.map(([, v]) => v), 1);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  return (
    <Card variant="elevated" style={brStyles.card}>
      <View style={brStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={brStyles.title}>{title}</Text>
          <Text style={brStyles.subtitle}>{subtitle}</Text>
        </View>
        <Text style={[brStyles.total, { color: accentColor }]}>{fmtShort(total)}</Text>
      </View>
      {entries.map(([name, value], idx) => {
        const color = BREAKDOWN_PALETTE[idx % BREAKDOWN_PALETTE.length];
        const pct   = max > 0 ? (value / max) * 100 : 0;
        return (
          <View key={name} style={brStyles.row}>
            <View style={[brStyles.avatar, { backgroundColor: toDim(color), borderColor: color + '40' }]}>
              <Text style={[brStyles.avatarText, { color }]}>{(name || '?')[0].toUpperCase()}</Text>
            </View>
            <Text style={brStyles.name} numberOfLines={1}>{name}</Text>
            <View style={brStyles.barTrack}>
              <View style={[brStyles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={brStyles.value}>{fmtShort(value)}</Text>
          </View>
        );
      })}
    </Card>
  );
}

const brStyles = StyleSheet.create({
  card: { padding: space.lg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: space.md,
  },
  title: { ...type.body, fontWeight: '700', fontSize: 14 },
  subtitle: { ...type.caption, marginTop: 2 },
  total: { fontSize: 16, fontWeight: '800' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: space.sm, marginBottom: space.sm,
  },
  avatar: {
    width: 26, height: 26, borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 10, fontWeight: '700' },
  name: { width: 80, ...type.caption, color: colors.text1, fontWeight: '500' },
  barTrack: {
    flex: 1, height: 6, backgroundColor: colors.bg3,
    borderRadius: radius.pill, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.pill },
  value: { width: 52, ...type.mono, fontSize: 11, textAlign: 'right' },
});

// ─── Ticker Bar ───────────────────────────────────────────────────────────────
function TickerBar() {
  const { rates } = useFXRates();
  const metals = useMetalPrices();
  const [base, setBase] = useState('USD');
  const translateX = useRef(new RNAnimated.Value(0)).current;
  const animRef    = useRef(null);
  const singleWidth = useRef(0);

  const startAnim = useCallback((w) => {
    animRef.current?.stop();
    translateX.setValue(0);
    animRef.current = RNAnimated.loop(
      RNAnimated.timing(translateX, {
        toValue: -w,
        duration: w * 30,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animRef.current.start();
  }, [translateX]);

  useEffect(() => {
    animRef.current?.stop();
    singleWidth.current = 0;
    translateX.setValue(0);
  }, [base, metals.prices, translateX]);

  useEffect(() => () => animRef.current?.stop(), []);

  const fxItems = ALL_CURRENCIES
    .filter(c => c !== base)
    .map(c => {
      const rate = getCrossRate(rates, base, c);
      const isMajor = ['USD', 'EUR', 'GBP'].includes(c);
      const decimals = c === 'CNY' || c === 'RUB' ? 2 : (isMajor ? 4 : 4);
      return {
        label: `${c}/${base}`,
        value: rate != null ? rate.toFixed(decimals) : '—',
        symbol: CURRENCY_SYMBOLS[c],
        isMetal: false,
      };
    });

  const metalItems = metals.prices
    ? Object.entries(metals.prices)
        .sort((a, b) => (a[1].order ?? 99) - (b[1].order ?? 99))
        .map(([, m]) => ({
          label: `${m.name} (USD/MT)`,
          value: metals.formatPrice(m.price),
          change: m.change,
          pct: m.change_pct,
          isMetal: true,
        }))
    : [];

  const loadingMetals = metals.loading && !metals.prices;
  const items = [...fxItems, ...metalItems];

  const renderItem = (item, i) => {
    const up = item.isMetal ? (item.change ?? 0) >= 0 : true;
    return (
      <View key={i} style={tkStyles.item}>
        <Text style={tkStyles.itemLabel}>{item.label}</Text>
        <Text style={tkStyles.itemValue}>
          {item.isMetal ? item.value : `${item.value} ${item.symbol}`}
        </Text>
        {item.isMetal && item.pct != null && (
          <Text style={[tkStyles.itemChange, { color: up ? colors.success : colors.danger }]}>
            {(item.change ?? 0) >= 0 ? '+' : ''}{item.pct}%
          </Text>
        )}
        <Text style={tkStyles.sep}>·</Text>
      </View>
    );
  };

  const updatedLabel = metals.lastUpdated
    ? metals.lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <View style={tkStyles.wrap}>
      {/* Ticker row */}
      <View style={tkStyles.bar}>
        <View style={tkStyles.livePill}>
          <View style={tkStyles.liveDot} />
          <Text style={tkStyles.liveText}>LIVE</Text>
        </View>
        <View style={tkStyles.overflow}>
          {loadingMetals ? (
            <Text style={tkStyles.loadingText}>Loading market data…</Text>
          ) : (
            <RNAnimated.View style={[tkStyles.track, { transform: [{ translateX }] }]}>
              <View
                style={{ flexDirection: 'row' }}
                onLayout={e => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0 && w !== singleWidth.current) {
                    singleWidth.current = w;
                    startAnim(w);
                  }
                }}
              >
                {items.map((item, i) => renderItem(item, i))}
              </View>
              <View style={{ flexDirection: 'row' }}>
                {items.map((item, i) => renderItem(item, items.length + i))}
              </View>
            </RNAnimated.View>
          )}
        </View>
        <TouchableOpacity
          onPress={metals.refresh}
          style={tkStyles.refreshBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="refresh-cw" size={12} color={colors.text3} />
        </TouchableOpacity>
      </View>

      {/* Updated timestamp */}
      {(updatedLabel || metals.error) ? (
        <Text style={[tkStyles.metaText, metals.error && { color: colors.danger }]}>
          {metals.error
            ? 'Metal prices unavailable'
            : `${metals.apiDate ? `LME · ${metals.apiDate}  ·  ` : ''}Updated ${updatedLabel}${metals.error ? '  · ⚠ stale' : ''}`
          }
        </Text>
      ) : null}

      {/* Base currency selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={tkStyles.baseScroll}
        contentContainerStyle={tkStyles.baseRow}
      >
        {ALL_CURRENCIES.map(c => (
          <TouchableOpacity
            key={c}
            style={[tkStyles.baseBtn, base === c && tkStyles.baseBtnActive]}
            onPress={() => setBase(c)}
          >
            <Text style={[tkStyles.baseBtnText, base === c && tkStyles.baseBtnTextActive]}>
              {CURRENCY_SYMBOLS[c]} {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const tkStyles = StyleSheet.create({
  wrap: { gap: 6 },
  bar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg2,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border2,
    paddingLeft: 10, paddingRight: 8, paddingVertical: 8,
    overflow: 'hidden',
  },
  livePill: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginRight: 10, flexShrink: 0,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { fontSize: 8, fontWeight: '800', color: colors.success, letterSpacing: 1 },
  overflow: { flex: 1, overflow: 'hidden' },
  track: { flexDirection: 'row', alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4 },
  itemLabel: { fontSize: 10, color: colors.text3, fontWeight: '500' },
  itemValue: { fontSize: 10, fontWeight: '700', color: colors.text1 },
  itemChange: { fontSize: 9, fontWeight: '600' },
  sep: { color: colors.text4, fontSize: 10, marginLeft: 2 },
  loadingText: { fontSize: 10, color: colors.text3, fontStyle: 'italic' },
  refreshBtn: { marginLeft: 6, padding: 2 },
  metaText: { fontSize: 9, color: colors.text3, fontWeight: '500', paddingHorizontal: 2 },
  baseScroll: { marginTop: 2 },
  baseRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 2, paddingVertical: 2 },
  baseBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bg3,
    borderWidth: 1, borderColor: colors.border1,
  },
  baseBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  baseBtnText: { fontSize: 10, fontWeight: '600', color: colors.text2 },
  baseBtnTextActive: { color: C.text1 },
});

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function DashSkeleton({ insets }) {
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerPad} />
      <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={false}>
        <SkeletonCard />
        <SkeletonCard />
        <View style={styles.grid}>
          {Array(6).fill(0).map((_, i) => (
            <View key={i} style={{ width: '47%' }}>
              <SkeletonStat />
            </View>
          ))}
        </View>
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { uidCollection, compData, settings } = UserAuth();
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [year, setYear]             = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null);

  const [stats, setStats] = useState({
    contracts: 0, invoices: 0, expenses: 0,
    totalIncome: 0, totalContracts: 0, totalExpenses: 0, pnl: 0,
    totalMT: 0,
  });
  const [prevStats, setPrevStats] = useState({ totalIncome: 0 });
  const [monthlyIncome, setMonthlyIncome]       = useState(Array(12).fill(0));
  const [monthlyContracts, setMonthlyContracts] = useState(Array(12).fill(0));
  const [monthlyExp, setMonthlyExp]             = useState(Array(12).fill(0));
  const [supplierBreakdown, setSupplierBreakdown] = useState({});
  const [clientBreakdown, setClientBreakdown]   = useState({});

  const dateSelect     = { start: `${year}-01-01`,     end: `${year}-12-31` };
  const prevDateSelect = { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };

  const loadStats = useCallback(async () => {
    if (!uidCollection) return;
    try {
      const [contracts, invoices, prevInvoices] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
        loadData(uidCollection, COLLECTIONS.INVOICES, prevDateSelect),
      ]);

      const mlt = (c) => (c.cur === 'us' || c.cur === 'USD') ? 1 : (parseFloat(c.euroToUSD) || 1);

      const _monthlyContracts = Array(12).fill(0);
      const suppMap = {};
      let totalMT = 0;

      contracts.forEach(c => {
        const date = c.dateRange?.startDate || c.date || '';
        const m    = parseInt(date.substring(5, 7), 10) - 1;
        const rate = mlt(c);
        let cVal = 0;
        (c.poInvoices || []).forEach(z => {
          const v = (parseFloat(z.pmnt) || 0) * rate;
          cVal += v;
          if (m >= 0 && m < 12) _monthlyContracts[m] += v;
        });
        const name = getName(settings, 'Supplier', c.supplier) || c.supplier || 'Unknown';
        suppMap[name] = (suppMap[name] || 0) + cVal;

        if (Array.isArray(c.productsData)) {
          c.productsData.forEach(p => { totalMT += parseFloat(p.qnty) || 0; });
        }
      });

      const _monthlyExp = Array(12).fill(0);
      contracts.forEach(c => {
        const date = c.dateRange?.startDate || c.date || '';
        const m    = parseInt(date.substring(5, 7), 10) - 1;
        const rate = mlt(c);
        (c.expenses || []).forEach(e => {
          const v = (parseFloat(e.amount) || 0) * rate;
          if (m >= 0 && m < 12) _monthlyExp[m] += v;
        });
      });

      const contractMap = {};
      contracts.forEach(c => { if (c.id) contractMap[c.id] = c; });

      const invByContract = {};
      invoices.forEach(inv => {
        const cid = inv.poSupplier?.id || String(inv.poSupplier || '__none__');
        if (!invByContract[cid]) invByContract[cid] = [];
        invByContract[cid].push(inv);
      });

      const _monthlyIncome = Array(12).fill(0);
      const clntMap = {};
      let totalIncome = 0;
      Object.values(invByContract).forEach(group => {
        group.forEach(inv => {
          if (inv.canceled) return;
          const amount = parseFloat(inv.totalAmount) || 0;
          const isSingleStandard = group.length === 1 && (inv.invType === '1111' || inv.invType === 'Invoice');
          if (isSingleStandard) return;
          const con = contractMap[inv.poSupplier?.id] || contractMap[inv.poSupplier];
          const v   = amount * (con ? mlt(con) : 1);
          totalIncome += v;
          const m = parseInt((inv.date || '').substring(5, 7), 10) - 1;
          if (m >= 0 && m < 12) _monthlyIncome[m] += v;
          const name = getName(settings, 'Client', inv.client) || inv.client || 'Unknown';
          clntMap[name] = (clntMap[name] || 0) + v;
        });
      });

      const prevIncome      = prevInvoices.reduce((s, x) => s + (Number(x.totalAmount) || 0), 0);
      const totalContracts  = _monthlyContracts.reduce((s, v) => s + v, 0);
      const totalExpenses   = _monthlyExp.reduce((s, v) => s + v, 0);
      const expCount        = contracts.reduce((s, c) => s + (c.expenses || []).length, 0);

      setStats({
        contracts: contracts.length,
        invoices:  invoices.length,
        expenses:  expCount,
        totalIncome,
        totalContracts,
        totalExpenses,
        pnl: totalIncome - totalContracts - totalExpenses,
        totalMT,
      });
      setPrevStats({ totalIncome: prevIncome });

      setMonthlyIncome(_monthlyIncome);
      setMonthlyContracts(_monthlyContracts);
      setMonthlyExp(_monthlyExp);

      setSupplierBreakdown(
        Object.fromEntries(Object.entries(suppMap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]))
      );
      setClientBreakdown(
        Object.fromEntries(Object.entries(clntMap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]))
      );
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uidCollection, year]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadStats(); }, [loadStats]);

  const onRefresh = () => { setRefreshing(true); loadStats(); };

  const displayStats = selectedMonth !== null ? {
    ...stats,
    totalIncome:    monthlyIncome[selectedMonth],
    totalContracts: monthlyContracts[selectedMonth],
    totalExpenses:  monthlyExp[selectedMonth],
    pnl:            monthlyIncome[selectedMonth] - monthlyContracts[selectedMonth] - monthlyExp[selectedMonth],
    totalMT: stats.totalMT,
  } : stats;


  const monthlyPnl = monthlyIncome.map((inc, i) => inc - monthlyContracts[i] - monthlyExp[i]);

  const { totalMT, totalContracts: tc, totalExpenses: te, pnl } = displayStats;
  const avgCostPerMT    = totalMT > 0 ? tc / totalMT  : 0;
  const avgExpensePerMT = totalMT > 0 ? te / totalMT  : 0;
  const avgProfitPerMT  = totalMT > 0 ? pnl / totalMT : 0;

  const KPI_CARDS = [
    {
      label: 'P&L',             rawValue: displayStats.pnl,
      displayValue: fmtShort(displayStats.pnl),
      featherIcon: 'bar-chart-2', accentColor: colors.purple,
      spark: monthlyPnl,
    },
    {
      label: 'Sales Revenue',   rawValue: displayStats.totalIncome,
      displayValue: fmtShort(displayStats.totalIncome),
      featherIcon: 'trending-up', accentColor: colors.success,
      spark: monthlyIncome,
    },
    {
      label: 'Total Costs',     rawValue: displayStats.totalContracts + displayStats.totalExpenses,
      displayValue: fmtShort(displayStats.totalContracts + displayStats.totalExpenses),
      featherIcon: 'trending-down', accentColor: colors.danger,
      spark: monthlyContracts,
    },
    {
      label: 'MT Purchased',    rawValue: null,
      displayValue: fmtMT(displayStats.totalMT),
      featherIcon: 'layers',    accentColor: colors.accent,
      spark: null,
    },
    {
      label: 'Other Expenses',  rawValue: displayStats.totalExpenses,
      displayValue: fmtShort(displayStats.totalExpenses),
      featherIcon: 'credit-card', accentColor: colors.warning,
      spark: monthlyExp,
    },
    {
      label: 'Avg Profit/MT',   rawValue: null,
      displayValue: fmtShort(avgProfitPerMT),
      featherIcon: 'activity',  accentColor: avgProfitPerMT >= 0 ? colors.success : colors.danger,
      spark: null,
    },
  ];

  if (loading && !refreshing) return <DashSkeleton insets={insets} />;
  if (error) return <ErrorState message={error} onRetry={loadStats} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <DashHeader
        name={compData?.name}
        companyName={compData?.companyName}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: getBottomPad(insets) }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Metals + FX Ticker */}
        <TickerBar />

        {/* Period selector */}
        <View style={styles.periodWrap}>
          <YearPicker year={year} setYear={setYear} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthRow}
          >
            <TouchableOpacity
              style={[styles.monthChip, selectedMonth === null && styles.monthChipActive]}
              onPress={() => setSelectedMonth(null)}
            >
              <Text style={[styles.monthChipTxt, selectedMonth === null && styles.monthChipTxtActive]}>All</Text>
            </TouchableOpacity>
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.monthChip, selectedMonth === i && styles.monthChipActive]}
                onPress={() => setSelectedMonth(selectedMonth === i ? null : i)}
              >
                <Text style={[styles.monthChipTxt, selectedMonth === i && styles.monthChipTxtActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Hero P&L */}
        <HeroPnlCard pnl={displayStats.pnl} prevPnl={prevStats.totalIncome} />

        {/* KPI grid */}
        <View style={styles.grid}>
          {KPI_CARDS.map((k, i) => (
            <Animated.View
              key={k.label}
              entering={FadeInDown.delay(i * 80).duration(300)}
              style={styles.kpiWrap}
            >
              <DashKpiCard
                label={k.label}
                rawValue={k.rawValue}
                displayValue={k.displayValue}
                accentColor={k.accentColor}
                featherIcon={k.featherIcon}
                sparkData={k.spark}
              />
            </Animated.View>
          ))}
        </View>

        {/* Revenue chart */}
        <SectionHeader title="Revenue vs Costs" />
        <RevenueChart income={monthlyIncome} costs={monthlyContracts} />

        {/* Per-MT metrics */}
        <SectionHeader title="Per-MT Efficiency" />
        <PerMtCard
          totalMT={totalMT}
          avgCostPerMT={avgCostPerMT}
          avgExpensePerMT={avgExpensePerMT}
          avgProfitPerMT={avgProfitPerMT}
        />

        {/* Supplier breakdown */}
        {Object.keys(supplierBreakdown).length > 0 && (
          <>
            <SectionHeader title="Contracts by Supplier" />
            <DashBreakdownCard
              title="Contracts by Supplier"
              subtitle={`${Object.keys(supplierBreakdown).length} suppliers`}
              data={supplierBreakdown}
              accentColor={colors.accent}
            />
          </>
        )}

        {/* Client breakdown */}
        {Object.keys(clientBreakdown).length > 0 && (
          <>
            <SectionHeader title="Invoices by Consignee" />
            <DashBreakdownCard
              title="Invoices by Consignee"
              subtitle={`${Object.keys(clientBreakdown).length} clients`}
              data={clientBreakdown}
              accentColor={colors.purple}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.bg0 },
  headerPad:  { height: 70 },
  scroll:     { paddingHorizontal: space.lg, gap: space.md, paddingTop: space.sm },
  periodWrap: { gap: space.sm },
  monthRow:   { flexDirection: 'row', gap: space.sm, paddingVertical: 2 },
  monthChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border1,
  },
  monthChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  monthChipTxt: { fontSize: 11, fontWeight: '600', color: colors.text2 },
  monthChipTxtActive: { color: C.text1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiWrap: { width: '47%' },
});
