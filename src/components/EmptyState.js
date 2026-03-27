import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EmptyState({ icon = 'file-tray-outline', title = 'No data', subtitle }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={48} color="#b8ddf8" />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  title: { fontSize: 16, fontWeight: '600', color: '#9fb8d4', marginTop: 14, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#b8ddf8', marginTop: 6, textAlign: 'center' },
});
