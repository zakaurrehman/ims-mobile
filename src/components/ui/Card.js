import { Pressable, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, withSpring, useAnimatedStyle,
  interpolate, interpolateColor,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';

const VARIANTS = {
  default:  { bg: colors.bg1,        border: colors.border1      },
  elevated: { bg: colors.bg2,        border: colors.border2      },
  ghost:    { bg: 'transparent',     border: colors.border1      },
  accent:   { bg: colors.accentGlow, border: colors.accentBorder },
};

// Pressable variant — uses Reanimated for scale + border animation
function PressableCard({ variant, onPress, style, children, glow }) {
  const pressed = useSharedValue(0);
  const v = VARIANTS[variant] || VARIANTS.default;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.985]) }],
    borderColor: interpolateColor(pressed.value, [0, 1], [v.border, colors.border3]),
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { pressed.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { pressed.value = withSpring(0, { damping: 15, stiffness: 300 }); }}
      style={{ borderRadius: radius.lg }}
    >
      <Animated.View
        style={[
          styles.base,
          { backgroundColor: v.bg },
          glow && styles.glow,
          style,
          animStyle,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Static variant — plain View, no animation overhead
export default function Card({ variant = 'default', onPress, style, children, glow }) {
  if (onPress) {
    return (
      <PressableCard variant={variant} onPress={onPress} style={style} glow={glow}>
        {children}
      </PressableCard>
    );
  }

  const v = VARIANTS[variant] || VARIANTS.default;
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        glow && styles.glow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border1,
    padding: 16,
    overflow: 'hidden',
  },
  glow: {
    borderColor: colors.accentBorder,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'visible',
  },
});
