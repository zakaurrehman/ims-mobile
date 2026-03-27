import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { formatCurrency } from '../../shared/utils/helpers';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import { COLLECTIONS } from '../../constants/collections';

export default function SharonAdminScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, userTitle } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);

  const load = async () => {
    if (!uidCollection) return;
    try {
      const data = await loadData(uidCollection, COLLECTIONS.CONTRACTS);
      setItems(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection]);

  if (loading) return <Spinner />;

  if (userTitle !== 'Admin') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AppHeader title="Sharon Admin" navigation={navigation} showBack />
        <View style={styles.noAccess}>
          <Ionicons name="lock-closed-outline" size={48} color="#b8ddf8" />
          <Text style={styles.noAccessText}>Admin access required</Text>
        </View>
      </View>
    );
  }

  const total = items.reduce((s, x) => s + (Number(x.totalUSD) || 0), 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Sharon Admin" navigation={navigation} showBack />
      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>Total Contract Value</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>
      <FlatList
        data={items}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        keyExtractor={(item, i) => item.id || String(i)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0366ae" />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="document-text-outline" size={48} color="#b8ddf8" /><Text style={styles.emptyText}>No data</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.contractNo || '—'}</Text>
              <Text style={styles.sub}>{item.client || ''}</Text>
            </View>
            <Text style={styles.amount}>{formatCurrency(Number(item.totalUSD) || 0)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  noAccess: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  noAccessText: { fontSize: 15, color: '#9fb8d4', fontWeight: '600' },
  totalBar: { backgroundColor: '#103a7a', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#9fb8d4', fontSize: 13, fontWeight: '600' },
  totalValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 14, fontWeight: '600', color: '#103a7a' },
  sub: { fontSize: 11, color: '#9fb8d4', marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '800', color: '#0366ae' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#9fb8d4' },
});
