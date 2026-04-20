import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import C from '../../theme/colors';

export default function ContactScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Us</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Get in Touch</Text>
        <Text style={styles.subtitle}>We're here to help with any questions about IMS.</Text>
        {[
          { icon: 'mail-outline', label: 'Email', value: 'support@ims.com', onPress: () => Linking.openURL('mailto:support@ims.com') },
          { icon: 'call-outline', label: 'Phone', value: '+1 (800) IMS-HELP', onPress: () => Linking.openURL('tel:+18004674357') },
          { icon: 'location-outline', label: 'Address', value: '123 Business Ave, Suite 100' },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={styles.card} onPress={item.onPress} activeOpacity={item.onPress ? 0.7 : 1}>
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={22} color={C.accent} />
            </View>
            <View>
              <Text style={styles.cardLabel}>{item.label}</Text>
              <Text style={styles.cardValue}>{item.value}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgPrimary },
  header: { backgroundColor: C.bgTertiary, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text1 },
  scroll: { padding: 20, gap: 16 },
  title: { fontSize: 22, fontWeight: '800', color: C.text1, marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.text2, marginBottom: 8 },
  card: { backgroundColor: C.bg2, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.bgTertiary, justifyContent: 'center', alignItems: 'center' },
  cardLabel: { fontSize: 11, color: C.text2, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  cardValue: { fontSize: 14, fontWeight: '600', color: C.text1 },
});
