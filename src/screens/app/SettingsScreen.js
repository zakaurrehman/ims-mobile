// Settings screen — matches web's settings/page.js with 7 tabs
// Company, Setup, Suppliers, Clients, Bank Accounts, Stocks, Users (admin)
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import AppHeader from '../../components/AppHeader';
import { ROUTES } from '../../constants/routes';
import { getBottomPad } from '../../theme/spacing';
import C from '../../theme/colors';

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { settings, userTitle } = UserAuth();

  const supplierCount = (settings?.Supplier?.Supplier || []).filter(x => !x.deleted).length;
  const clientCount = (settings?.Client?.Client || []).filter(x => !x.deleted).length;
  const bankCount = (settings?.['Bank Account']?.['Bank Account'] || []).filter(x => !x.deleted).length;
  const stockCount = (settings?.Stocks?.Stocks || []).filter(x => !x.deleted).length;

  const SECTIONS = [
    {
      title: 'Company',
      items: [
        {
          icon: 'business-outline',
          label: 'Company Details',
          sub: 'Name, address, language',
          screen: ROUTES.COMPANY_DETAILS,
          color: C.accent,
        },
      ],
    },
    {
      title: 'Lookup Tables',
      items: [
        {
          icon: 'list-outline',
          label: 'Setup',
          sub: 'Picklists: POD, POL, payment terms…',
          screen: ROUTES.SETUP,
          color: C.info,
        },
      ],
    },
    {
      title: 'Data Management',
      items: [
        {
          icon: 'people-outline',
          label: 'Suppliers',
          sub: 'Manage supplier list',
          badge: supplierCount || null,
          screen: ROUTES.SUPPLIER_MANAGEMENT,
          color: C.purple,
        },
        {
          icon: 'briefcase-outline',
          label: 'Clients',
          sub: 'Manage client list',
          badge: clientCount || null,
          screen: ROUTES.CLIENT_MANAGEMENT,
          color: C.info,
        },
      ],
    },
    {
      title: 'Finance',
      items: [
        {
          icon: 'card-outline',
          label: 'Bank Accounts',
          sub: 'SWIFT, IBAN, currencies',
          badge: bankCount || null,
          screen: ROUTES.BANK_ACCOUNTS,
          color: C.success,
        },
      ],
    },
    {
      title: 'Inventory',
      items: [
        {
          icon: 'cube-outline',
          label: 'Stocks / Warehouses',
          sub: 'Configure stock locations',
          badge: stockCount || null,
          screen: ROUTES.STOCKS_CONFIG,
          color: C.warning,
        },
      ],
    },
    ...(userTitle === 'Admin' ? [{
      title: 'Administration',
      items: [
        {
          icon: 'people-circle-outline',
          label: 'User Management',
          sub: 'Roles and access control',
          screen: ROUTES.USERS_MANAGEMENT,
          color: C.danger,
          adminOnly: true,
        },
      ],
    }] : []),
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Settings" navigation={navigation} showBack />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: getBottomPad(insets) }]}>
        {SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, ii) => (
                <TouchableOpacity
                  key={ii}
                  style={[styles.item, ii < section.items.length - 1 && styles.itemBorder]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (item.screen) {
                      navigation.navigate(item.screen);
                    } else {
                      Alert.alert(item.label, 'Coming soon.');
                    }
                  }}
                >
                  <View style={[styles.iconWrap, { backgroundColor: (item.color || C.accent) + '18' }]}>
                    <Ionicons name={item.icon} size={20} color={item.color || C.accent} />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    {item.sub ? <Text style={styles.itemSub}>{item.sub}</Text> : null}
                  </View>
                  {item.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={C.text2} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  scroll: { padding: 16, gap: 20 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: C.text2,
    textTransform: 'uppercase', paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: C.bg2, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  itemText: { flex: 1, gap: 1 },
  itemLabel: { fontSize: 14, fontWeight: '600', color: C.text1 },
  itemSub: { fontSize: 11, color: C.text2 },
  badge: {
    backgroundColor: C.accent, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2, marginRight: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.text1 },
});
