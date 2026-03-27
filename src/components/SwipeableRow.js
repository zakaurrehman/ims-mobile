// Reusable swipe-to-delete row wrapper using react-native-gesture-handler
import { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

export default function SwipeableRow({ children, onDelete, disabled }) {
  const swipeRef = useRef(null);

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      activeOpacity={0.85}
      onPress={() => {
        swipeRef.current?.close();
        onDelete?.();
      }}
    >
      <Ionicons name="trash-outline" size={20} color="#fff" />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  );

  if (disabled) return children;

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    borderRadius: 14,
    marginLeft: 6,
    gap: 4,
  },
  deleteText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
