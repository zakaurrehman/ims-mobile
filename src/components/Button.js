import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

export default function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }) {
  const isSecondary = variant === 'secondary';
  const isDanger    = variant === 'danger';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        isSecondary && styles.secondary,
        isDanger    && styles.danger,
        !isSecondary && !isDanger && styles.primary,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={isSecondary ? colors.text2 : '#fff'} size="small" />
        : <Text style={[styles.text, isSecondary && styles.textSecondary, isDanger && styles.textDanger]}>
            {title}
          </Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    height: 44,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border2,
  },
  danger: {
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  textSecondary: {
    color: colors.text2,
  },
  textDanger: {
    color: colors.danger,
  },
});
