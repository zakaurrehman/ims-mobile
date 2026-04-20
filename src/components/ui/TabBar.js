import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue, withSpring, withSequence, useAnimatedStyle,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';

const TABS = [
  { name: 'Dashboard', icon: 'grid'        },
  { name: 'Contracts', icon: 'file-text'   },
  { name: 'Invoices',  icon: 'layers'      },
  { name: 'Expenses',  icon: 'credit-card' },
  { name: 'More',      icon: 'menu'        },
];

function TabItem({ tab, isFocused, onPress }) {
  const scale     = useSharedValue(1);
  const bgOpacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    if (isFocused) {
      scale.value = withSequence(
        withSpring(1.12, { damping: 6,  stiffness: 300 }),
        withSpring(1.0,  { damping: 10, stiffness: 200 })
      );
      bgOpacity.value = withSpring(1, { damping: 15, stiffness: 300 });
    } else {
      bgOpacity.value = withSpring(0, { damping: 15, stiffness: 300 });
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    }
  }, [isFocused]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pillAnimStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.85}
    >
      {/* Active pill background — fades in/out */}
      <Animated.View style={[styles.activePill, pillAnimStyle]} />

      {/* Icon + label */}
      <Animated.View style={[styles.tabInner, iconAnimStyle]}>
        <Feather
          name={tab.icon}
          size={22}
          color={isFocused ? colors.accent : colors.text3}
        />
        <Text
          style={[styles.label, { color: isFocused ? colors.accent : colors.text3 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {tab.name}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function TabItems({ state, navigation }) {
  return (
    <>
      {state.routes.map((route, index) => {
        const tab = TABS.find(t => t.name === route.name) || TABS[4];
        const isFocused = state.index === index;
        return (
          <TabItem
            key={route.key}
            tab={tab}
            isFocused={isFocused}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          />
        );
      })}
    </>
  );
}

export default function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  const pillStyle = [
    styles.pill,
    { bottom: insets.bottom + 12 },
  ];

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={70}
        tint="systemThickMaterialDark"
        style={pillStyle}
      >
        <TabItems state={state} navigation={navigation} />
      </BlurView>
    );
  }

  return (
    <View style={[pillStyle, styles.pillAndroid]}>
      <TabItems state={state} navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border2,
    paddingHorizontal: 8,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  pillAndroid: {
    backgroundColor: 'rgba(14,20,32,0.96)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.accentGlow,
    borderRadius: radius.xl,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 3,
    zIndex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
