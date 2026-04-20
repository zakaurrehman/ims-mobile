import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import C from '../../theme/colors';

const POSTS = [
  { title: 'How IMS Simplifies International Shipments', date: 'Jan 2026', tag: 'Guide' },
  { title: 'Multi-Currency Invoicing Best Practices', date: 'Dec 2025', tag: 'Finance' },
  { title: 'Cashflow Management for Trading Companies', date: 'Nov 2025', tag: 'Finance' },
  { title: 'Using the Contracts Module Effectively', date: 'Oct 2025', tag: 'Tutorial' },
];

export default function BlogScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={C.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Blog</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {POSTS.map((p, i) => (
          <TouchableOpacity key={i} style={styles.card} activeOpacity={0.8} onPress={() => Alert.alert(p.title, 'Full blog post coming soon.')}>

            <View style={styles.tagWrap}>
              <Text style={styles.tag}>{p.tag}</Text>
              <Text style={styles.date}>{p.date}</Text>
            </View>
            <Text style={styles.postTitle}>{p.title}</Text>
            <Text style={styles.readMore}>Read more →</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg2 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.bgTertiary, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: C.text1 },
  scroll: { padding: 16, gap: 14 },
  card: {
    backgroundColor: C.bgSecondary, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 18,
  },
  tagWrap: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tag: {
    fontSize: 11, fontWeight: '700', color: C.accent,
    backgroundColor: C.bgTertiary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
    textTransform: 'uppercase',
  },
  date: { fontSize: 12, color: C.text2 },
  postTitle: { fontSize: 15, fontWeight: '700', color: C.text1, lineHeight: 22, marginBottom: 10 },
  readMore: { fontSize: 12, color: C.accent, fontWeight: '600' },
});
