import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={48} color="#fca5a5" />
      <Text style={styles.title}>Failed to load</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={onRetry}>
          <Ionicons name="refresh-outline" size={16} color="#fff" />
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  title: { fontSize: 16, fontWeight: '700', color: '#dc2626', marginTop: 14, textAlign: 'center' },
  message: { fontSize: 13, color: '#9fb8d4', marginTop: 6, textAlign: 'center' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0366ae', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 20,
  },
  btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
