import { View, Text, StyleSheet } from 'react-native';
import { useToast } from '../contexts/ToastContext';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

export default function Toast() {
  const { toast } = useToast();
  if (!toast?.show) return null;

  const isSuccess = toast.clr === 'success';

  return (
    <View style={[styles.container, isSuccess ? styles.success : styles.error]}>
      <Feather
        name={isSuccess ? 'check-circle' : 'x-circle'}
        size={18}
        color={isSuccess ? colors.success : colors.danger}
      />
      <Text style={styles.text}>{toast.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 96,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  success: {
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.success,
  },
  error: {
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text1,
    flex: 1,
  },
});
