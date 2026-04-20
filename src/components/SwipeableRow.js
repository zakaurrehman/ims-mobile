// Reusable swipe-to-delete row wrapper using react-native-gesture-handler
import { useRef } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

export default function SwipeableRow({ children, onDelete, disabled }) {
  const swipeRef = useRef(null);

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      activeOpacity={0.85}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        swipeRef.current?.close();
        onDelete?.();
      }}
    >
      <Feather name="trash-2" size={18} color="#fff" />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  );

  if (disabled) return children;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    borderRadius: radius.lg,
    marginLeft: 6,
    gap: 4,
  },
  deleteText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
