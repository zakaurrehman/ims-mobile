// Dark-first design system — 4 surface levels, luminance hierarchy
// DO NOT add hardcoded hex values anywhere else in the app

export const dark = {
  // ── Surfaces (4 levels, not one grey) ─────────────────────────────────────
  bg0: '#080C12',    // true background (deepest)
  bg1: '#0E1420',    // primary surface (cards)
  bg2: '#141B2B',    // elevated surface (modals)
  bg3: '#1A2236',    // overlay surface (popups)
  bg4: '#202840',    // highest surface (active states)

  // ── Accent — electric blue ─────────────────────────────────────────────────
  accent:       '#3B82F6',
  accentDim:    '#1D4ED8',
  accentGlow:   'rgba(59,130,246,0.15)',
  accentBorder: 'rgba(59,130,246,0.30)',

  // ── Semantic ───────────────────────────────────────────────────────────────
  success:    '#10B981',
  successDim: 'rgba(16,185,129,0.12)',
  danger:     '#EF4444',
  dangerDim:  'rgba(239,68,68,0.12)',
  warning:    '#F59E0B',
  warningDim: 'rgba(245,158,11,0.12)',
  purple:     '#8B5CF6',
  purpleDim:  'rgba(139,92,246,0.12)',

  // ── Text ───────────────────────────────────────────────────────────────────
  text1: '#F1F5FE',  // primary — headings, values
  text2: '#8896B3',  // secondary — labels, captions
  text3: '#4A5568',  // tertiary — hints, disabled
  text4: '#2D3748',  // ghost — very subtle

  // ── Borders (luminance-based, not shadow-based) ────────────────────────────
  border1:      'rgba(255,255,255,0.08)',
  border2:      'rgba(255,255,255,0.12)',
  border3:      'rgba(255,255,255,0.18)',
  borderAccent: 'rgba(59,130,246,0.4)',

  // ── Special ────────────────────────────────────────────────────────────────
  overlay: 'rgba(0,0,0,0.7)',
};

export const colors = dark;

// Backward-compat aliases — old screens import C.bgPrimary etc.
// These map old names to dark-theme equivalents so existing code
// goes dark automatically as screens are progressively updated.
const C = {
  ...dark,
  bgPrimary:      dark.bg0,
  bgSecondary:    dark.bg1,
  bgTertiary:     dark.bg2,
  textPrimary:    dark.text1,
  textSecondary:  dark.text2,
  textTertiary:   dark.text3,
  accentBlue:     dark.accent,
  accentBlueSoft: dark.accentGlow,
  successSoft:    dark.successDim,
  dangerSoft:     dark.dangerDim,
  warningSoft:    dark.warningDim,
  info:           dark.accent,
  infoSoft:       dark.accentGlow,
  border:         dark.border1,
  borderStrong:   dark.border2,
  tabBarBg:       dark.bg2,
  tabBarBorder:   dark.border2,
  tabActive:      dark.accent,
  tabInactive:    dark.text3,
};

export default C;
