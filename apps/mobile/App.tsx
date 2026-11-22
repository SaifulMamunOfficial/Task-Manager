import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from './src/api';
import { AuthProvider, useAuth } from './src/auth';
import { I18nProvider, useI18n } from './src/i18n';
import { onNotificationTap } from './src/push';
import { C } from './src/ui';
import Login from './src/screens/Login';
import ChangePassword from './src/screens/ChangePassword';
import Today from './src/screens/Today';
import TaskList from './src/screens/TaskList';
import TaskDetail from './src/screens/TaskDetail';
import NewTask from './src/screens/NewTask';
import Notifications from './src/screens/Notifications';
import Account from './src/screens/Account';

const navRef = createNavigationContainerRef<any>();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MineScreen = () => <TaskList who="mine" />;
const GivenScreen = () => <TaskList who="given" />;
const ForcedPassword = () => <ChangePassword forced />;

function Tabs() {
  const { t } = useI18n();
  const { canGive } = useAuth();
  const [unread, setUnread] = useState(0);

  // A light poll keeps the bell badge current while the app is open.
  useEffect(() => {
    let live = true;
    const tick = () => api<unknown[]>('/notifications?unread=true').then((r) => live && setUnread(r.length)).catch(() => {});
    tick();
    const id = setInterval(tick, 60_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  const newBtn = canGive
    ? () => (
        <Pressable onPress={() => navRef.current?.navigate('NewTask')} accessibilityRole="button" accessibilityLabel={t('nav.newTask')} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ color: C.brand, fontWeight: '800', fontSize: 15 }}>+ {t('nav.newTask')}</Text>
        </Pressable>
      )
    : undefined;

  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: C.brand, headerTitleStyle: { fontWeight: '800' }, tabBarLabelStyle: { fontSize: 11.5, fontWeight: '600' } }}>
      <Tab.Screen name="Today" component={Today} options={{ title: t('nav.today'), tabBarIcon: () => <Text>◉</Text> }} />
      <Tab.Screen name="Mine" component={MineScreen} options={{ title: t('nav.myTasks'), headerRight: newBtn, tabBarIcon: () => <Text>☑</Text> }} />
      <Tab.Screen name="Given" component={GivenScreen} options={{ title: t('nav.given'), headerRight: newBtn, tabBarIcon: () => <Text>➤</Text> }} />
      <Tab.Screen name="Notifications" component={Notifications} options={{ title: t('nav.notifications'), tabBarBadge: unread > 0 ? unread : undefined, tabBarIcon: () => <Text>🔔</Text> }} />
      <Tab.Screen name="Account" component={Account} options={{ title: t('mb.me'), tabBarIcon: () => <Text>●</Text> }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { me, ready } = useAuth();
  const { t } = useI18n();

  // Tapping a push notification opens that task.
  const pending = useRef<string | null>(null);
  useEffect(() => onNotificationTap((id) => (navRef.isReady() ? navRef.navigate('TaskDetail', { id }) : (pending.current = id))), []);

  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={C.brand} /></View>;

  return (
    <NavigationContainer
      ref={navRef}
      onReady={() => {
        if (pending.current) navRef.navigate('TaskDetail', { id: pending.current });
        pending.current = null;
      }}
    >
      <StatusBar style="dark" />
      {!me ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={Login} />
        </Stack.Navigator>
      ) : me.mustChangePassword ? (
        <Stack.Navigator>
          <Stack.Screen name="ForcedPassword" component={ForcedPassword} options={{ title: t('nav.changePassword') }} />
        </Stack.Navigator>
      ) : me.isAdmin ? (
        <Stack.Navigator>
          <Stack.Screen name="Account" component={Account} options={{ title: t('app.name') }} />
          <Stack.Screen name="ChangePassword" component={ChangePassword} options={{ title: t('nav.changePassword') }} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="TaskDetail" component={TaskDetail} options={{ title: t('tl.task') }} />
          <Stack.Screen name="NewTask" component={NewTask} options={{ title: t('nw.title') }} />
          <Stack.Screen name="ChangePassword" component={ChangePassword} options={{ title: t('nav.changePassword') }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <I18nProvider>
          <Root />
        </I18nProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
