import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { formatCurrency } from '../../shared/utils/helpers';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import Card from '../../components/Card';
import AppHeader from '../../components/AppHeader';
import YearPicker from '../../components/YearPicker';
import { COLLECTIONS } from '../../constants/collections';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SCREEN_W = Dimensions.get('window').width;

// Build monthly totals from array of records with a date field and value field
const buildMonthly = (arr, dateKey, valueKey) => {
  const totals = Array(12).fill(0);
  arr.forEach(x => {
    const d = x[dateKey] || '';
    if (!d) return;
    const m = parseInt(d.substring(5, 7), 10) - 1;
    if (m >= 0 && m < 12) totals[m] += Number(x[valueKey]) || 0;
  });
  return totals;
};

const QUICK_ACTIONS = [
  { icon: 'document-text-outline', label: 'Contracts', screen: TAB_ROUTES.CONTRACTS, color: '#0366ae' },
  { icon: 'receipt-outline', label: 'Invoices', screen: TAB_ROUTES.INVOICES, color: '#d97706' },
  { icon: 'wallet-outline', label: 'Expenses', screen: TAB_ROUTES.EXPENSES, color: '#dc2626' },
  { icon: 'trending-up-outline', label: 'Cashflow', screen: ROUTES.CASHFLOW, color: '#16a34a' },
  { icon: 'cube-outline', label: 'Stocks', screen: ROUTES.STOCKS, color: '#7c3aed' },
  { icon: 'calculator-outline', label: 'Margins', screen: ROUTES.MARGINS, color: '#0891b2' },
];

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, compData } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null);

  const [stats, setStats] = useState({
    contracts: 0, invoices: 0, expenses: 0,
    totalIncome: 0, totalExpenses: 0, pnl: 0,
  });
  const [prevStats, setPrevStats] = useState({ totalIncome: 0, totalExpenses: 0 });
  const [monthlyIncome, setMonthlyIncome] = useState(Array(12).fill(0));
  const [monthlyExp, setMonthlyExp] = useState(Array(12).fill(0));

  const dateSelect = { start: `${year}-01-01`, end: `${year}-12-31` };
  const prevDateSelect = { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };

  const loadStats = async () => {
    if (!uidCollection) return;
    try {
      const [contracts, invoices, expenses, prevInvoices, prevExpenses] = await Promise.all([
        loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
        loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
        loadData(uidCollection, COLLECTIONS.EXPENSES, dateSelect),
        loadData(uidCollection, COLLECTIONS.INVOICES, prevDateSelect),
        loadData(uidCollection, COLLECTIONS.EXPENSES, prevDateSelect),
      ]);

      const totalIncome = invoices.reduce((s, x) => s + (Number(x.totalAmount) || 0), 0);
      const totalExpenses = expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const prevIncome = prevInvoices.reduce((s, x) => s + (Number(x.totalAmount) || 0), 0);
      const prevExp = prevExpenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);

      setStats({
        contracts: contracts.length,
        invoices: invoices.length,
        expenses: expenses.length,
        totalIncome,
        totalExpenses,
        pnl: totalIncome - totalExpenses,
      });
      setPrevStats({ totalIncome: prevIncome, totalExpenses: prevExp });

      setMonthlyIncome(buildMonthly(invoices, 'date', 'totalAmount'));
      setMonthlyExp(buildMonthly(expenses, 'date', 'amount'));
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadStats(); }, [uidCollection, year]);

  const onRefresh = () => { setRefreshing(true); loadStats(); };

  // When month selected, show that month's stats; otherwise full-year
  const displayStats = selectedMonth !== null ? {
    ...stats,
    totalIncome: monthlyIncome[selectedMonth],
    totalExpenses: monthlyExp[selectedMonth],
    pnl: monthlyIncome[selectedMonth] - monthlyExp[selectedMonth],
  } : stats;

  // % change vs previous year
  const pct = (curr, prev) => {
    if (!prev) return null;
    const val = ((curr - prev) / prev) * 100;
    return (val > 0 ? '+' : '') + val.toFixed(1) + '%';
  };

  const KPI_CARDS = [
    {
      label: 'Total Income', value: formatCurrency(displayStats.totalIncome),
      icon: 'trending-up-outline', color: '#0366ae',
      change: pct(displayStats.totalIncome, prevStats.totalIncome),
    },
    {
      label: 'Total Expenses', value: formatCurrency(displayStats.totalExpenses),
      icon: 'trending-down-outline', color: '#dc2626',
      change: pct(displayStats.totalExpenses, prevStats.totalExpenses),
    },
    {
      label: 'P&L', value: formatCurrency(displayStats.pnl),
      icon: 'bar-chart-outline', color: displayStats.pnl >= 0 ? '#16a34a' : '#dc2626',
      change: null,
    },
    { label: 'Contracts', value: stats.contracts, icon: 'document-text-outline', color: '#7c3aed', change: null },
    { label: 'Invoices', value: stats.invoices, icon: 'receipt-outline', color: '#d97706', change: null },
    { label: 'Expenses', value: stats.expenses, icon: 'wallet-outline', color: '#0891b2', change: null },
  ];

  const chartW = SCREEN_W - 32;
  const chartConfig = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    color: (opacity = 1) => `rgba(3, 102, 174, ${opacity})`,
    labelColor: () => '#9fb8d4',
    strokeWidth: 2,
    barPercentage: 0.55,
    decimalPlaces: 0,
    propsForDots: { r: '3', strokeWidth: '1', stroke: '#0366ae' },
  };

  const monthlyPnl = monthlyIncome.map((inc, i) => inc - monthlyExp[i]);

  // Clamp all-zero arrays so chart renders without errors
  const safeIncome = monthlyIncome.some(v => v !== 0) ? monthlyIncome : monthlyIncome.map(() => 0.01);
  const safePnl = monthlyPnl.some(v => v !== 0) ? monthlyPnl : monthlyPnl.map(() => 0.01);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={loadStats} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Dashboard" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0366ae" />}
      >
        <Text style={styles.welcome}>Welcome, {compData?.name || 'User'}</Text>
        <YearPicker year={year} setYear={setYear} />

        {/* Quick Actions */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.qaScroll} contentContainerStyle={styles.qaRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity key={a.screen} style={styles.qaBtn} onPress={() => navigation.navigate(a.screen)} activeOpacity={0.75}>
              <View style={[styles.qaIcon, { backgroundColor: a.color + '18' }]}>
                <Ionicons name={a.icon} size={20} color={a.color} />
              </View>
              <Text style={styles.qaLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Month filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={styles.monthRow}>
          <TouchableOpacity
            style={[styles.monthChip, selectedMonth === null && styles.monthChipActive]}
            onPress={() => setSelectedMonth(null)}
          >
            <Text style={[styles.monthChipText, selectedMonth === null && styles.monthChipTextActive]}>All</Text>
          </TouchableOpacity>
          {MONTHS.map((m, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.monthChip, selectedMonth === i && styles.monthChipActive]}
              onPress={() => setSelectedMonth(selectedMonth === i ? null : i)}
            >
              <Text style={[styles.monthChipText, selectedMonth === i && styles.monthChipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* KPI Grid */}
        <View style={styles.grid}>
          {KPI_CARDS.map((k, i) => (
            <Card key={i} style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: k.color + '18' }]}>
                <Ionicons name={k.icon} size={20} color={k.color} />
              </View>
              <Text style={styles.kpiValue}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
              {k.change ? (
                <Text style={[styles.kpiChange, { color: k.change.startsWith('+') ? '#16a34a' : '#dc2626' }]}>
                  {k.change} vs {year - 1}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>

        {/* Monthly Income Bar Chart */}
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>Monthly Income</Text>
          <BarChart
            data={{ labels: MONTHS, datasets: [{ data: safeIncome }] }}
            width={chartW - 32}
            height={180}
            chartConfig={chartConfig}
            style={styles.chart}
            withInnerLines={false}
            showBarTops={false}
            fromZero
            yAxisLabel="$"
            yAxisSuffix=""
          />
        </Card>

        {/* Monthly P&L Line Chart */}
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>Monthly P&L</Text>
          <LineChart
            data={{ labels: MONTHS, datasets: [{ data: safePnl, color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})` }] }}
            width={chartW - 32}
            height={180}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})`,
            }}
            style={styles.chart}
            withDots={false}
            withInnerLines={false}
            bezier
            fromZero={false}
            yAxisLabel="$"
            yAxisSuffix=""
          />
        </Card>

        {/* Financial Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            Financial Summary{selectedMonth !== null ? ` — ${MONTHS[selectedMonth]}` : ''}
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, { color: '#16a34a' }]}>{formatCurrency(displayStats.totalIncome)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: '#dc2626' }]}>{formatCurrency(displayStats.totalExpenses)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Net P&L</Text>
            <Text style={[styles.summaryTotalValue, { color: (displayStats.pnl || 0) >= 0 ? '#16a34a' : '#dc2626' }]}>
              {formatCurrency(displayStats.pnl)}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  welcome: { fontSize: 16, fontWeight: '700', color: '#103a7a', marginBottom: 4 },

  monthScroll: { marginBottom: -4 },
  monthRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  monthChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8ddf8',
  },
  monthChipActive: { backgroundColor: '#0366ae', borderColor: '#0366ae' },
  monthChipText: { fontSize: 12, fontWeight: '600', color: '#0366ae' },
  monthChipTextActive: { color: '#fff' },

  qaScroll: { marginBottom: 4 },
  qaRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  qaBtn: { alignItems: 'center', gap: 5, width: 64 },
  qaIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  qaLabel: { fontSize: 10, fontWeight: '600', color: '#103a7a', textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: { width: '47%', alignItems: 'flex-start', padding: 14 },
  kpiIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 16, fontWeight: '800', color: '#103a7a', marginBottom: 2 },
  kpiLabel: { fontSize: 11, color: '#9fb8d4', fontWeight: '500' },
  kpiChange: { fontSize: 10, fontWeight: '600', marginTop: 3 },

  chartCard: { padding: 16 },
  chartTitle: { fontSize: 13, fontWeight: '700', color: '#103a7a', marginBottom: 10 },
  chart: { borderRadius: 10, marginLeft: -8 },

  summaryCard: { padding: 18 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#103a7a', marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  summaryLabel: { fontSize: 13, color: '#9fb8d4' },
  summaryValue: { fontSize: 13, fontWeight: '600' },
  summaryTotal: { borderBottomWidth: 0, marginTop: 4, borderTopWidth: 1, borderTopColor: '#b8ddf8' },
  summaryTotalLabel: { fontSize: 14, fontWeight: '700', color: '#103a7a' },
  summaryTotalValue: { fontSize: 14, fontWeight: '800' },
});
