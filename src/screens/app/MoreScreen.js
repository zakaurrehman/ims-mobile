import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants/routes';
import C from '../../theme/colors';
import { R, S, shadows, getBottomPad } from '../../theme/spacing';

const MENU_SECTIONS = [
  {
    title: 'Main Menu',
    items: [
      { icon: 'sparkles-outline', label: 'Assistant', screen: ROUTES.ASSISTANT, color: C.purple },
    ],
  },
  {
    title: 'Shipments',
    items: [
      { icon: 'boat-outline',          label: 'Shipments Tracking',  screen: ROUTES.SHIPMENT,            color: C.accentBlue },
      { icon: 'document-text-outline', label: 'Contracts Review',    screen: ROUTES.CONTRACTS_REVIEW,    color: C.accentBlue },
      { icon: 'receipt-outline',       label: 'Invoices Review',     screen: ROUTES.INVOICES_REVIEW,     color: C.warning    },
      { icon: 'calculator-outline',    label: 'Accounting',          screen: ROUTES.ACCOUNTING,          color: C.success    },
      { icon: 'document-outline',      label: 'Contracts Statement', screen: ROUTES.CONTRACTS_STATEMENT, color: C.accentBlue },
      { icon: 'newspaper-outline',     label: 'Invoices Statement',  screen: ROUTES.INVOICES_STATEMENT,  color: C.warning    },
    ],
  },
  {
    title: 'Statements',
    items: [
      { icon: 'stats-chart-outline', label: 'Account Statement', screen: ROUTES.ACCOUNT_STATEMENT, color: C.purple     },
      { icon: 'cube-outline',        label: 'Stocks',            screen: ROUTES.STOCKS,            color: C.accentBlue },
      { icon: 'layers-outline',      label: 'Inventory Review',  screen: ROUTES.INVENTORY_REVIEW,  color: C.warning    },
    ],
  },
  {
    title: 'Miscellaneous',
    items: [
      { icon: 'document-attach-outline', label: 'Misc Invoices',    screen: ROUTES.SPECIAL_INVOICES, color: C.warning    },
      { icon: 'briefcase-outline',       label: 'Company Expenses', screen: ROUTES.COMPANY_EXPENSES, color: C.danger     },
      { icon: 'grid-outline',            label: 'Material Tables',  screen: ROUTES.MATERIAL_TABLES,  color: C.accentBlue },
    ],
  },
  {
    title: 'IMS Summary',
    items: [
      { icon: 'people-outline',      label: 'Sharon Admin',  screen: ROUTES.SHARON_ADMIN, color: C.purple     },
      { icon: 'trending-up-outline', label: 'Cashflow',      screen: ROUTES.CASHFLOW,     color: C.success     },
      { icon: 'calculator-outline',  label: 'Formulas Calc', screen: ROUTES.FORMULAS,     color: C.accentBlue  },
    ],
  },
  {
    title: 'Other',
    items: [
      { icon: 'bar-chart-outline',   label: 'Analysis', screen: ROUTES.ANALYSIS, color: C.purple     },
      { icon: 'stats-chart-outline', label: 'Margins',  screen: ROUTES.MARGINS,  color: C.success     },
      { icon: 'settings-outline',    label: 'Settings', screen: ROUTES.SETTINGS, color: C.accentBlue  },
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

  const initials = (user?.displayName || user?.email || 'U')[0].toUpperCase();
  const displayName = user?.displayName || user?.email?.split('@')[0];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: getBottomPad(insets) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <View style={styles.roleDot} />
              <Text style={styles.roleText}>{userTitle || 'User'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate(ROUTES.SETTINGS)} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={18} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        {compData?.name && (
          <View style={styles.companyRow}>
            <Ionicons name="business-outline" size={14} color={C.accentBlue} />
            <Text style={styles.companyName}>{compData.name}</Text>
          </View>
        )}

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
                  <View style={[styles.menuIconWrap, { backgroundColor: m.color + '18' }]}>
                    <Ionicons name={m.icon} size={16} color={m.color} />
                  </View>
                  <Text style={styles.menuLabel}>{m.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={C.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>IMS Mobile v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  header: {
    paddingHorizontal: 20,
    paddingVertical: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bgPrimary,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: C.textPrimary },
  scroll: { padding: S.lg, gap: S.md },
  profileCard: {
    backgroundColor: C.bgSecondary,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    ...shadows.card,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.accentBlue,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: C.text1, fontSize: 20, fontWeight: '800' },
  userName: { fontSize: 15, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
  userEmail: { fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.accentBlueSoft,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: R.pill, alignSelf: 'flex-start',
  },
  roleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accentBlue },
  roleText: { fontSize: 10, fontWeight: '700', color: C.accentBlue, textTransform: 'uppercase', letterSpacing: 0.5 },
  settingsBtn: { padding: S.sm },
  companyRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.bgSecondary,
    padding: S.md, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
  },
  companyName: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  section: { gap: 6 },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: C.textTertiary,
    textTransform: 'uppercase', letterSpacing: 1.2, paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: C.bgSecondary,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', ...shadows.card,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingHorizontal: S.md, paddingVertical: 13,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  menuIconWrap: {
    width: 32, height: 32, borderRadius: R.sm,
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: C.textPrimary },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    backgroundColor: C.dangerSoft,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.danger + '40',
    padding: S.lg, marginTop: S.sm,
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: C.danger },
  version: { fontSize: 11, color: C.textTertiary, textAlign: 'center', paddingVertical: S.sm },
});
