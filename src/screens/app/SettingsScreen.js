// Settings screen — matches web's settings/page.js with 7 tabs
// Company, Setup, Suppliers, Clients, Bank Accounts, Stocks, Users (admin)
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import AppHeader from '../../components/AppHeader';
import { ROUTES } from '../../constants/routes';

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
          color: '#0366ae',
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
          color: '#7c3aed',
        },
        {
          icon: 'briefcase-outline',
          label: 'Clients',
          sub: 'Manage client list',
          badge: clientCount || null,
          screen: ROUTES.CLIENT_MANAGEMENT,
          color: '#0891b2',
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
          color: '#16a34a',
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
          color: '#d97706',
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
          color: '#dc2626',
          adminOnly: true,
        },
      ],
    }] : []),
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Settings" navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
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
                  <View style={[styles.iconWrap, { backgroundColor: (item.color || '#0366ae') + '18' }]}>
                    <Ionicons name={item.icon} size={20} color={item.color || '#0366ae'} />
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
                  <Ionicons name="chevron-forward" size={16} color="#9fb8d4" />
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
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  scroll: { padding: 16, gap: 20, paddingBottom: 32 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#9fb8d4',
    textTransform: 'uppercase', paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#b8ddf8', overflow: 'hidden',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f8ff' },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  itemText: { flex: 1, gap: 1 },
  itemLabel: { fontSize: 14, fontWeight: '600', color: '#103a7a' },
  itemSub: { fontSize: 11, color: '#9fb8d4' },
  badge: {
    backgroundColor: '#0366ae', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2, marginRight: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});
