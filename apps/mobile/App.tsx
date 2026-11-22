import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from './src/api';
import { AuthProvider, useAuth } from './src/auth';
import { I18nProvider, useI18n } from './src/i18n';
import { onNotificationTap } from './src/push';
import { C, Icon, type IconName } from './src/ui';
import Login from './src/screens/Login';
import ChangePassword from './src/screens/ChangePassword';
import Today from './src/screens/Today';
import * as Linking from 'expo-linking';
import TaskList from './src/screens/TaskList';
import GivenList from './src/screens/GivenList';
import TaskDetail from './src/screens/TaskDetail';
import NewTask from './src/screens/NewTask';
import Notifications from './src/screens/Notifications';
import Account from './src/screens/Account';

const navRef = createNavigationContainerRef<any>();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MineScreen = () => <TaskList who="mine" />;
const GivenScreen = () => <GivenList />;

// Deep links (also handy for testing): <app url>/--/given, /--/task/<id>, /--/new ...
const linking = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      Tabs: { screens: { Today: 'today', Mine: 'mine', Given: 'given', Notifications: 'alerts', Account: 'me' } },
      TaskDetail: 'task/:id',
      NewTask: 'new',
      ChangePassword: 'password',
    },
  },
};
const ForcedPassword = () => <ChangePassword forced />;

function Tabs() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
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

  const icon = (on: IconName, off: IconName) => ({ focused, color }: { focused: boolean; color: string }) => <Icon name={focused ? on : off} size={24} color={color} />;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: '#94a3b8',
        headerTitleStyle: { fontWeight: '800', fontSize: 20, color: C.ink },
        headerStyle: { backgroundColor: '#fff', elevation: 0, shadowOpacity: 0 },
        headerTitleAlign: 'left',
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '700' },
        tabBarStyle: { height: 62 + insets.bottom, paddingTop: 6, paddingBottom: 6 + insets.bottom, borderTopColor: C.line, backgroundColor: '#fff' },
        tabBarBadgeStyle: { backgroundColor: C.red, color: '#fff', fontWeight: '800', fontSize: 10, minWidth: 18, height: 18, lineHeight: 17, borderRadius: 9, top: -2 },
      }}
    >
      <Tab.Screen name="Today" component={Today} options={{ title: t('mb.tab.today'), headerShown: false, tabBarIcon: icon('home', 'home-outline') }} />
      <Tab.Screen name="Mine" component={MineScreen} options={{ title: t('nav.myTasks'), tabBarLabel: t('mb.tab.mine'), tabBarIcon: icon('checkbox', 'checkbox-outline') }} />
      <Tab.Screen name="Given" component={GivenScreen} options={{ title: t('nav.given'), tabBarLabel: t('mb.tab.given'), tabBarIcon: icon('paper-plane', 'paper-plane-outline') }} />
      <Tab.Screen name="Notifications" component={Notifications} options={{ title: t('nav.notifications'), tabBarLabel: t('mb.tab.alerts'), tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined, tabBarIcon: icon('notifications', 'notifications-outline') }} />
      <Tab.Screen name="Account" component={Account} options={{ title: t('mb.me'), tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
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
      linking={linking}
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
