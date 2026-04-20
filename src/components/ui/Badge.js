import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';

const VARIANTS = {
  success: { bg: colors.successDim, text: colors.success },
  danger:  { bg: colors.dangerDim,  text: colors.danger  },
  warning: { bg: colors.warningDim, text: colors.warning  },
  info:    { bg: colors.accentGlow, text: colors.accent   },
  purple:  { bg: colors.purpleDim,  text: colors.purple   },
  neutral: { bg: colors.bg3,        text: colors.text2    },
  // Backward compat
  default: { bg: colors.bg3,        text: colors.text2    },
};

export default function Badge({ label, variant = 'neutral', dot = false, style }) {
  const v = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: v.text }]} />}
      <Text style={[styles.label, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    gap: 4,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
