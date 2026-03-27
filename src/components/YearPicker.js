import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function YearPicker({ year, setYear }) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={() => setYear(y => y - 1)} style={styles.btn}>
        <Ionicons name="chevron-back" size={18} color="#0366ae" />
      </TouchableOpacity>
      <Text style={styles.year}>{year}</Text>
      <TouchableOpacity onPress={() => setYear(y => y + 1)} style={styles.btn}>
        <Ionicons name="chevron-forward" size={18} color="#0366ae" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 16,
  },
  btn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#e3f3ff',
    justifyContent: 'center', alignItems: 'center',
  },
  year: {
    fontSize: 16, fontWeight: '700', color: '#103a7a',
    minWidth: 50, textAlign: 'center',
  },
});
