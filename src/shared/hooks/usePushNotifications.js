// Push notification registration hook
// Requests permission on first load, saves token to Firestore
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(uidCollection, userId) {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (!uidCollection || !userId) return;

    registerForPushNotifications(uidCollection, userId);

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Notification received while app is open — handled by setNotificationHandler above
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      // User tapped the notification — handle navigation here if needed
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [uidCollection, userId]);
}

async function registerForPushNotifications(uidCollection, userId) {
  if (!Device.isDevice) return; // Skip in simulators

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    // Save token to Firestore under the user's document
    const ref = doc(db, uidCollection, 'pushTokens');
    await setDoc(ref, { [userId]: token, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn('Push token registration failed:', e.message);
  }
}
