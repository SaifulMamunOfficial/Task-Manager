import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { post } from './api';

// Show a banner while the app is open too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/**
 * Ask permission, get this phone's Expo push token and tell the server, so notifications reach this phone.
 * Returns 'ok', 'denied' (the person said no) or 'unsupported' (emulator / no project id).
 */
export async function registerPush(): Promise<'ok' | 'denied' | 'unsupported'> {
  if (!Device.isDevice) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Tasks', importance: Notifications.AndroidImportance.HIGH });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';

  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  if (!projectId) return 'unsupported';
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await post('/devices/register', { token, platform: Platform.OS });
  await SecureStore.setItemAsync('pushToken', token);
  return 'ok';
}

/** Called on sign-out so a shared phone stops receiving the previous person's notifications. */
export async function unregisterPush() {
  const token = await SecureStore.getItemAsync('pushToken');
  if (!token) return;
  await post('/devices/unregister', { token });
  await SecureStore.deleteItemAsync('pushToken');
}

/** Tapping a notification should open the task it is about. */
export function onNotificationTap(open: (assignmentId: string) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    // The server sends data.url like "/tasks/<assignmentId>".
    const url = String((r.notification.request.content.data as any)?.url ?? '');
    const m = url.match(/^\/tasks\/([\w-]+)/);
    if (m) open(m[1]);
  });
  return () => sub.remove();
}
