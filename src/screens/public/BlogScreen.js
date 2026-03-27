import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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
          <Ionicons name="chevron-back" size={22} color="#0366ae" />
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
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#e3f3ff', borderBottomWidth: 1, borderBottomColor: '#b8ddf8',
  },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: '#103a7a' },
  scroll: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#f7fbff', borderRadius: 16,
    borderWidth: 1, borderColor: '#b8ddf8', padding: 18,
  },
  tagWrap: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tag: {
    fontSize: 11, fontWeight: '700', color: '#0366ae',
    backgroundColor: '#ebf2fc', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
    textTransform: 'uppercase',
  },
  date: { fontSize: 12, color: '#9fb8d4' },
  postTitle: { fontSize: 15, fontWeight: '700', color: '#103a7a', lineHeight: 22, marginBottom: 10 },
  readMore: { fontSize: 12, color: '#0366ae', fontWeight: '600' },
});
