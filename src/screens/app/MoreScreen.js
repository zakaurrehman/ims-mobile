import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import AppHeader from '../../components/AppHeader';
import { ROUTES, TAB_ROUTES } from '../../constants/routes';

const MENU_SECTIONS = [
  {
    title: 'Main Menu',
    items: [
      { icon: 'sparkles-outline', label: 'Assistant', screen: ROUTES.ASSISTANT },
    ],
  },
  {
    title: 'Shipments',
    items: [
      { icon: 'boat-outline', label: 'Shipments Tracking', screen: ROUTES.SHIPMENT },
      { icon: 'document-text-outline', label: 'Contracts Review', screen: ROUTES.CONTRACTS_REVIEW },
      { icon: 'receipt-outline', label: 'Invoices Review', screen: ROUTES.INVOICES_REVIEW },
      { icon: 'calculator-outline', label: 'Accounting', screen: ROUTES.ACCOUNTING },
      { icon: 'document-outline', label: 'Contracts Statement', screen: ROUTES.CONTRACTS_STATEMENT },
      { icon: 'newspaper-outline', label: 'Invoices Statement', screen: ROUTES.INVOICES_STATEMENT },
    ],
  },
  {
    title: 'Statements',
    items: [
      { icon: 'stats-chart-outline', label: 'Account Statement', screen: ROUTES.ACCOUNT_STATEMENT },
      { icon: 'cube-outline', label: 'Stocks', screen: ROUTES.STOCKS },
      { icon: 'layers-outline', label: 'Inventory Review', screen: ROUTES.INVENTORY_REVIEW },
    ],
  },
  {
    title: 'Miscellaneous',
    items: [
      { icon: 'document-attach-outline', label: 'Misc Invoices', screen: ROUTES.SPECIAL_INVOICES },
      { icon: 'briefcase-outline', label: 'Company Expenses', screen: ROUTES.COMPANY_EXPENSES },
      { icon: 'grid-outline', label: 'Material Tables', screen: ROUTES.MATERIAL_TABLES },
    ],
  },
  {
    title: 'IMS Summary',
    items: [
      { icon: 'people-outline', label: 'Sharon Admin', screen: ROUTES.SHARON_ADMIN },
      { icon: 'trending-up-outline', label: 'Cashflow', screen: ROUTES.CASHFLOW },
      { icon: 'calculator-outline', label: 'Formulas Calc', screen: ROUTES.FORMULAS },
    ],
  },
  {
    title: 'Other',
    items: [
      { icon: 'bar-chart-outline', label: 'Analysis', screen: ROUTES.ANALYSIS },
      { icon: 'stats-chart-outline', label: 'Margins', screen: ROUTES.MARGINS },
      { icon: 'settings-outline', label: 'Settings', screen: ROUTES.SETTINGS },
    ],
  },
];

export default function MoreScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { SignOut, user, userTitle, compData } = UserAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: SignOut },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="More" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.displayName || user?.email?.split('@')[0]}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{userTitle || 'User'}</Text>
            </View>
          </View>
        </View>

        {compData?.name && (
          <View style={styles.companyRow}>
            <Ionicons name="business-outline" size={16} color="#0366ae" />
            <Text style={styles.companyName}>{compData.name}</Text>
          </View>
        )}

        {/* Sectioned menu */}
        {MENU_SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((m, ii) => (
                <TouchableOpacity
                  key={ii}
                  style={[styles.menuItem, ii < section.items.length - 1 && styles.menuItemBorder]}
                  onPress={() => navigation.navigate(m.screen)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconWrap}>
                    <Ionicons name={m.icon} size={18} color="#0366ae" />
                  </View>
                  <Text style={styles.menuLabel}>{m.label}</Text>
                  <Ionicons name="chevron-forward" size={15} color="#9fb8d4" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  scroll: { padding: 16, gap: 14, paddingBottom: 32 },
  profileCard: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#b8ddf8',
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#0366ae', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  userName: { fontSize: 15, fontWeight: '700', color: '#103a7a' },
  userEmail: { fontSize: 12, color: '#9fb8d4', marginBottom: 4 },
  roleBadge: {
    backgroundColor: '#ebf2fc', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999, alignSelf: 'flex-start',
  },
  roleText: { fontSize: 10, fontWeight: '700', color: '#0366ae', textTransform: 'uppercase' },
  companyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ebf2fc', padding: 12, borderRadius: 12,
  },
  companyName: { fontSize: 13, fontWeight: '600', color: '#103a7a' },
  section: { gap: 6 },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: '#9fb8d4', textTransform: 'uppercase', paddingHorizontal: 4 },
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#b8ddf8', overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 13,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  menuIconWrap: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: '#103a7a' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#fecaca', padding: 14,
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#dc2626' },
});
