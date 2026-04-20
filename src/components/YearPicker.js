import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

export default function YearPicker({ year, setYear }) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={() => setYear(y => y - 1)}
        style={styles.btn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="chevron-left" size={18} color={colors.accent} />
      </TouchableOpacity>
      <Text style={styles.year}>{year}</Text>
      <TouchableOpacity
        onPress={() => setYear(y => y + 1)}
        style={styles.btn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="chevron-right" size={18} color={colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 16,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.bg3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border1,
  },
  year: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
    minWidth: 50,
    textAlign: 'center',
  },
});
