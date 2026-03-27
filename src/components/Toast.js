import { View, Text, StyleSheet } from 'react-native';
import { useToast } from '../contexts/ToastContext';
import { Ionicons } from '@expo/vector-icons';

export default function Toast() {
  const { toast } = useToast();
  if (!toast?.show) return null;

  const isSuccess = toast.clr === 'success';

  return (
    <View style={[styles.container, isSuccess ? styles.success : styles.error]}>
      <Ionicons
        name={isSuccess ? 'checkmark-circle-outline' : 'close-circle-outline'}
        size={20}
        color={isSuccess ? '#fff' : '#dc2626'}
      />
      <Text style={[styles.text, !isSuccess && styles.textError]}>{toast.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  success: {
    backgroundColor: '#0366ae',
    borderWidth: 1,
    borderColor: '#0255a3',
  },
  error: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  textError: {
    color: '#dc2626',
  },
});
