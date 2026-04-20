import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

export default function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border1,
    padding: 16,
  },
});
