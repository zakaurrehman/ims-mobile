import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function EmptyState({ icon = 'inbox', title = 'No data', subtitle }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={28} color={colors.text3} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.border1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.text3,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 19,
  },
});
