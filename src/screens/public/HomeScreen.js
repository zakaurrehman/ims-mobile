import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PUBLIC_ROUTES } from '../../constants/routes';
import C from '../../theme/colors';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const features = [
    { icon: 'document-text-outline', title: 'Contracts', desc: 'Manage all your shipment contracts in one place' },
    { icon: 'receipt-outline', title: 'Invoices', desc: 'Track and manage invoices with real-time updates' },
    { icon: 'bar-chart-outline', title: 'Analytics', desc: 'Powerful dashboards for financial insights' },
    { icon: 'cube-outline', title: 'Stocks', desc: 'Monitor inventory and stock levels effortlessly' },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Navbar */}
      <View style={styles.nav}>
        <Text style={styles.logo}>IMS</Text>
        <View style={styles.navLinks}>
          <TouchableOpacity onPress={() => navigation.navigate(PUBLIC_ROUTES.ABOUT)}>
            <Text style={styles.navLink}>About</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate(PUBLIC_ROUTES.FEATURES)}>
            <Text style={styles.navLink}>Features</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate(PUBLIC_ROUTES.BLOG)}>
            <Text style={styles.navLink}>Blog</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => navigation.navigate(PUBLIC_ROUTES.SIGN_IN)}
          >
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTag}>Inventory Management System</Text>
          <Text style={styles.heroTitle}>Manage Shipments{'\n'}& Finance{'\n'}Effortlessly</Text>
          <Text style={styles.heroSub}>
            IMS gives your team a single platform to track contracts, invoices, expenses, and cashflow — all in real time.
          </Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.heroPrimary}
              onPress={() => navigation.navigate(PUBLIC_ROUTES.SIGN_IN)}
            >
              <Text style={styles.heroPrimaryText}>Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroSecondary}
              onPress={() => navigation.navigate(PUBLIC_ROUTES.FEATURES)}
            >
              <Text style={styles.heroSecondaryText}>Learn More</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Features grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Everything You Need</Text>
          <Text style={styles.sectionSub}>One platform for your entire operations</Text>
          <View style={styles.grid}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureCard}>
                <View style={styles.iconWrap}>
                  <Ionicons name={f.icon} size={24} color={C.accent} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <Text style={styles.ctaTitle}>Ready to get started?</Text>
          <Text style={styles.ctaSub}>Join teams already using IMS to streamline operations.</Text>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => navigation.navigate(PUBLIC_ROUTES.SIGN_IN)}
          >
            <Text style={styles.ctaBtnText}>Sign In Now</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} IMS Inc. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg2 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.bgTertiary,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logo: { fontSize: 22, fontWeight: '800', color: C.text1, letterSpacing: 1 },
  navLinks: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navLink: { color: C.text1, fontSize: 13, fontWeight: '500' },
  signInBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  signInText: { color: C.text1, fontSize: 13, fontWeight: '600' },

  scroll: { paddingBottom: 32 },

  hero: {
    backgroundColor: C.bgPrimary,
    padding: 24,
    paddingTop: 40,
    paddingBottom: 48,
    alignItems: 'flex-start',
  },
  heroTag: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    backgroundColor: C.bgTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  heroTitle: { fontSize: 32, fontWeight: '800', color: C.text1, lineHeight: 40, marginBottom: 12 },
  heroSub: { fontSize: 14, color: C.text2, lineHeight: 22, marginBottom: 24, opacity: 0.8 },
  heroButtons: { flexDirection: 'row', gap: 12 },
  heroPrimary: {
    backgroundColor: C.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  heroPrimaryText: { color: C.text1, fontWeight: '700', fontSize: 14 },
  heroSecondary: {
    backgroundColor: C.bg2,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
  },
  heroSecondaryText: { color: C.accent, fontWeight: '700', fontSize: 14 },

  section: { padding: 24 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: C.text1, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: C.text2, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: {
    width: '47%',
    backgroundColor: C.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.bgTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureTitle: { fontSize: 14, fontWeight: '700', color: C.text1, marginBottom: 4 },
  featureDesc: { fontSize: 12, color: C.text2, lineHeight: 18 },

  cta: {
    backgroundColor: C.accent,
    margin: 16,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  ctaTitle: { fontSize: 20, fontWeight: '800', color: C.text1, marginBottom: 8, textAlign: 'center' },
  ctaSub: { fontSize: 13, color: C.text2, marginBottom: 20, textAlign: 'center' },
  ctaBtn: {
    backgroundColor: C.bg2,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaBtnText: { color: C.accent, fontWeight: '700', fontSize: 14 },

  footer: { alignItems: 'center', padding: 20 },
  footerText: { fontSize: 12, color: C.text2 },
});
