import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import { formatCurrency } from '../../shared/utils/helpers';
import AppHeader from '../../components/AppHeader';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import { COLLECTIONS } from '../../constants/collections';

export default function SpecialInvoicesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection } = UserAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);

  const load = async () => {
    if (!uidCollection) return;
    try {
      setError(null);
      const data = await loadData(uidCollection, COLLECTIONS.SPECIAL_INVOICES);
      setItems(data);
    } catch (e) { console.error(e); setError(e.message || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [uidCollection]);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="Misc Invoices" navigation={navigation} showBack />
      <FlatList
        data={items}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        keyExtractor={(item, i) => item.id || String(i)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0366ae" />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="document-outline" size={48} color="#b8ddf8" /><Text style={styles.emptyText}>No misc invoices</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.invoiceNo || item.name || '—'}</Text>
              <Text style={styles.sub}>{item.date || ''}</Text>
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
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 14, fontWeight: '700', color: '#103a7a' },
  sub: { fontSize: 12, color: '#9fb8d4', marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '800', color: '#0366ae' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#9fb8d4' },
});
