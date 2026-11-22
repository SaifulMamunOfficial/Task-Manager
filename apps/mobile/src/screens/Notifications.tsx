import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api, post } from '../api';
import { useI18n } from '../i18n';
import { Btn, C, Empty, ErrorText, Icon, SH, type IconName } from '../ui';
import type { Notif } from '../types';

const ICON: Record<string, [IconName, string, string]> = {
  TASK_ASSIGNED: ['add-circle', C.brand, C.brandSoft],
  STATUS_CHANGED: ['swap-horizontal', C.blue, C.blueSoft],
  UPDATE_POSTED: ['chatbubble-ellipses', C.green, C.greenSoft],
  ATTACHMENT_ADDED: ['attach', C.amber, C.amberSoft],
};
const iconFor = (type: string): [IconName, string, string] => (type.startsWith('REMINDER_') ? ['alarm', C.red, C.redSoft] : ICON[type] ?? ['notifications', C.gray, C.graySoft]);

export default function Notifications() {
  const { t, n, err, notifText, timeAgo } = useI18n();
  const nav = useNavigation<any>();
  const [rows, setRows] = useState<Notif[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api<Notif[]>('/notifications'));
      setError('');
    } catch (e: any) {
      setError(err(e.message));
    }
  }, [err]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unread = (rows ?? []).filter((r) => !r.readAt).length;

  async function markAll() {
    try {
      await post('/notifications/read', {});
      await load();
    } catch (e: any) {
      setError(err(e.message));
    }
  }

  async function open(x: Notif) {
    if (!x.readAt) post('/notifications/read', { ids: [x.id] }).then(load).catch(() => {});
    if (x.payload?.assignmentId) nav.navigate('TaskDetail', { id: x.payload.assignmentId });
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {unread > 0 && (
        <View style={s.bar}>
          <Text style={{ flex: 1, color: C.ink, fontWeight: '800' }}>{t('nt.unread', { n: unread })}</Text>
          <Btn label={t('nt.markAll')} icon="checkmark-done" onPress={markAll} style={{ minHeight: 38, paddingHorizontal: 12 }} />
        </View>
      )}
      <ErrorText msg={error} />
      <FlatList
        data={rows ?? []}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 14, gap: 10, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={rows === null ? <Empty title={t('c.loading')} icon="hourglass-outline" /> : <Empty title={t('nt.empty')} icon="notifications-off-outline" />}
        renderItem={({ item: x }) => {
          const [name, fg, bg] = iconFor(x.type);
          return (
            <Pressable onPress={() => open(x)} accessibilityRole="button" style={({ pressed }) => [s.row, SH, pressed && { opacity: 0.93 }]}>
              <View style={[s.ico, { backgroundColor: bg }]}>
                <Icon name={name} size={20} color={fg} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: C.ink, fontSize: 15, lineHeight: 21, fontWeight: x.readAt ? '500' : '700' }}>{notifText(x)}</Text>
                <Text style={{ color: C.sub, fontSize: 12.5 }}>{timeAgo(x.createdAt)}</Text>
              </View>
              {!x.readAt && <View style={s.dot} accessibilityLabel={t('nt.unread', { n: 1 })} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.line },
  row: { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ico: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.brand },
});
