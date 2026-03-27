// Shows a sliding banner when the device has no internet connection
import { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

const BANNER_HEIGHT = 40;

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-BANNER_HEIGHT)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      Animated.timing(slideAnim, {
        toValue: offline ? 0 : -BANNER_HEIGHT,
        duration: 280,
        useNativeDriver: true,
      }).start();
    });
    return unsub;
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents="none"
    >
      <Ionicons name="cloud-offline-outline" size={15} color="#fff" />
      <Text style={styles.text}>No internet — showing cached data</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    height: BANNER_HEIGHT,
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: { fontSize: 12, fontWeight: '600', color: '#fff' },
});
