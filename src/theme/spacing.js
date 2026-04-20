// Spacing scale — use these everywhere, never hardcode numbers
export const space = {
  xs:   4,
  sm:   8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  xxxl:48,
};

export const radius = {
  sm:   6,
  md:  10,
  lg:  16,
  xl:  20,
  xxl: 28,
  pill: 999,
};

export const TAB_BAR_HEIGHT = 72;

export const getBottomPad = (insets) =>
  TAB_BAR_HEIGHT + (insets?.bottom || 0) + 20;

// Backward-compat aliases
export const S = space;
export const R = radius;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  tabBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  fab: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};

export default S;
