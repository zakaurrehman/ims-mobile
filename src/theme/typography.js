import { Platform } from 'react-native';
import { colors } from './colors';

const mono = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
});

// New design system typography — use `type` in new code
export const type = {
  // Hero numbers — KPI values, totals
  hero: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: colors.text1,
    fontVariant: ['tabular-nums'],
  },
  // Large number — card values
  bigNum: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.text1,
    fontVariant: ['tabular-nums'],
  },
  // Screen title
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.text1,
  },
  // Section / modal title
  heading: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.text1,
  },
  // Section label (uppercase tracked)
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text3,
  },
  // Body text
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: colors.text1,
  },
  // Secondary body
  bodyMuted: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text2,
  },
  // Caption / meta
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text2,
  },
  // Monospace — amounts, IDs, dates
  mono: {
    fontFamily: mono,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
    color: colors.text1,
    fontVariant: ['tabular-nums'],
  },
  monoLarge: {
    fontFamily: mono,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text1,
    fontVariant: ['tabular-nums'],
  },
  // Status badge text
  badge: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
};

// Backward-compat alias for screens that import T from typography
export const T = {
  ...type,
  // Old names that screens may reference
  bodyBold:  { ...type.body,  fontWeight: '600' },
  label:     { fontSize: 13,  fontWeight: '500', color: colors.text2 },
  monoSmall: { ...type.mono,  fontSize: 11,      color: colors.text2 },
};

export default T;
