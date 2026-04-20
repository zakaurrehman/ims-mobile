import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { radius, space } from '../../theme/spacing';

const { width: SCREEN_W } = Dimensions.get('window');

function ShimmerLine({ width = '100%', height = 16, style }) {
  const animX = useRef(new Animated.Value(-SCREEN_W)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animX, {
        toValue: SCREEN_W,
        duration: 1400,
        useNativeDriver: true,
      })
    ).start();
    return () => animX.stopAnimation();
  }, []);

  return (
    <View
      style={[
        styles.shimmerBase,
        { width, height, borderRadius: radius.sm },
        style,
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: animX }] }]}
      >
        <LinearGradient
          colors={[colors.bg2, colors.bg3, colors.bg2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <ShimmerLine height={12} width="55%" />
      <ShimmerLine height={26} width="75%" style={{ marginTop: space.sm }} />
      <ShimmerLine height={10} width="35%" style={{ marginTop: space.sm }} />
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <ShimmerLine width={44} height={44} style={{ borderRadius: radius.md, flexShrink: 0 }} />
      <View style={{ flex: 1, marginLeft: space.md, gap: space.sm }}>
        <ShimmerLine height={14} width="65%" />
        <ShimmerLine height={11} width="45%" />
      </View>
      <ShimmerLine width={60} height={20} style={{ borderRadius: radius.pill }} />
    </View>
  );
}

export function SkeletonStat() {
  return (
    <View style={styles.stat}>
      <ShimmerLine height={10} width="50%" />
      <ShimmerLine height={28} width="70%" style={{ marginTop: space.sm }} />
      <ShimmerLine height={10} width="30%" style={{ marginTop: space.xs }} />
    </View>
  );
}

export function SkeletonChart() {
  return (
    <View style={styles.chart}>
      <ShimmerLine height={160} width="100%" style={{ borderRadius: radius.md }} />
    </View>
  );
}

export default function SkeletonLoader({ type = 'card', count = 3 }) {
  const Component = {
    card:  SkeletonCard,
    row:   SkeletonRow,
    stat:  SkeletonStat,
    chart: SkeletonChart,
  }[type] || SkeletonCard;

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  shimmerBase: {
    backgroundColor: colors.bg2,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: colors.bg1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border1,
    padding: space.lg,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border1,
    padding: space.lg,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
  },
  stat: {
    backgroundColor: colors.bg2,
    borderRadius: radius.lg,
    padding: space.lg,
    flex: 1,
  },
  chart: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
  },
});
