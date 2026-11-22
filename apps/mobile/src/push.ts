import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { post } from './api';

// Expo Go (SDK 53+) no longer supports remote push and prints a red warning as soon as expo-notifications loads.
// So the module is only loaded in a real (development or store) build.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const N = () => (inExpoGo ? null : (require('expo-notifications') as typeof import('expo-notifications')));

let ready = false;
function setup() {
  const n = N();
  if (!n || ready) return n;
  ready = true;
  // Show a banner while the app is open too.
  n.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  return n;
}

/**
 * Ask permission, get this phone's Expo push token and tell the server, so notifications reach this phone.
 * Returns 'ok', 'denied' (the person said no) or 'unsupported' (emulator, Expo Go, or no project id).
 */
export async function registerPush(): Promise<'ok' | 'denied' | 'unsupported'> {
  const n = setup();
  if (!n || !Device.isDevice) return 'unsupported';
  if (Platform.OS === 'android') {
    await n.setNotificationChannelAsync('default', { name: 'Tasks', importance: n.AndroidImportance.HIGH });
  }
  let { status } = await n.getPermissionsAsync();
  if (status !== 'granted') status = (await n.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';

  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId || (Constants as any).easConfig?.projectId;
  if (!projectId) return 'unsupported';
  const token = (await n.getExpoPushTokenAsync({ projectId })).data;
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
  const n = setup();
  if (!n) return () => {};
  const sub = n.addNotificationResponseReceivedListener((r) => {
    // The server sends data.url like "/tasks/<assignmentId>".
    const url = String((r.notification.request.content.data as any)?.url ?? '');
    const m = url.match(/^\/tasks\/([\w-]+)/);
    if (m) open(m[1]);
  });
  return () => sub.remove();
}
