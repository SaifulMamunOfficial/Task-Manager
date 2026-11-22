import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api, post } from '../api';
import { useI18n } from '../i18n';
import { Btn, C, Empty, ErrorText } from '../ui';
import type { Notif } from '../types';

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
          <Text style={{ flex: 1, color: C.ink, fontWeight: '700' }}>{t('nt.unread', { n: unread })}</Text>
          <Btn label={t('nt.markAll')} onPress={markAll} style={{ minHeight: 36 }} />
        </View>
      )}
      <ErrorText msg={error} />
      <FlatList
        data={rows ?? []}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={rows === null ? <Empty title={t('c.loading')} /> : <Empty title={t('nt.empty')} />}
        renderItem={({ item: x }) => (
          <Pressable onPress={() => open(x)} accessibilityRole="button" style={[s.row, !x.readAt && { borderColor: C.brand, backgroundColor: C.brandSoft }]}>
            <Text style={{ color: C.ink, fontSize: 15, lineHeight: 21 }}>{notifText(x)}</Text>
            <Text style={{ color: C.sub, fontSize: 12.5 }}>{timeAgo(x.createdAt)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.line },
  row: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 14, gap: 4 },
});
