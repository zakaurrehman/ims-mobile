import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

export default function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Feather name="wifi-off" size={28} color={colors.danger} />
      </View>
      <Text style={styles.title}>Failed to load</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={onRetry}>
          <Feather name="refresh-cw" size={15} color="#fff" />
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      )}
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
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: colors.text2,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 19,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
