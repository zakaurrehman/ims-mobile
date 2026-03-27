import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }) {
  const isSecondary = variant === 'secondary';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={isSecondary ? '#0366ae' : '#fff'} size="small" />
        : <Text style={[styles.text, isSecondary && styles.textSecondary]}>{title}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  primary: {
    backgroundColor: '#0366ae',
  },
  secondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#b8ddf8',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  textSecondary: {
    color: '#0366ae',
  },
});
