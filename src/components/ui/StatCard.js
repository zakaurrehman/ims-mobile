import { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import Badge from './Badge';
import Card from './Card';

// Converts a hex color to rgba for icon circle backgrounds
function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(59,130,246,${alpha})`;
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatCount(n) {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default function StatCard({
  value,
  label,
  trend,
  trendValue,
  accentColor = colors.accent,
  icon,
  onPress,
  style,
}) {
  const isNumeric = typeof value === 'number' && Number.isFinite(value);
  const anim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(isNumeric ? '$0' : (value ?? '—'));

  const fmt = useCallback(formatCount, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(value ?? '—');
      return;
    }
    const id = anim.addListener(({ value: v }) => setDisplay(fmt(v)));
    anim.setValue(0);
    Animated.timing(anim, { toValue: value, duration: 900, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value, isNumeric]);

  const dimBg = hexToRgba(accentColor, 0.15);

  return (
    <Card variant="elevated" onPress={onPress} style={[styles.card, style]}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Icon circle */}
        {icon ? (
          <View style={[styles.iconCircle, { backgroundColor: dimBg }]}>
            <Feather name={icon} size={14} color={accentColor} />
          </View>
        ) : null}

        {/* Animated value */}
        <Text
          style={[styles.value, { color: accentColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {display}
        </Text>

        {/* Footer: label + trend badge */}
        <View style={styles.footer}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          {trend && trendValue ? (
            <Badge
              label={`${trend === 'up' ? '↑' : '↓'} ${trendValue}`}
              variant={trend === 'up' ? 'success' : 'danger'}
            />
          ) : null}
        </View>
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 0,
    overflow: 'hidden',
    minWidth: 140,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text3,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
  },
});
