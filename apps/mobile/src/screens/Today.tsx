import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { C, Card, Empty, ErrorText, StatusPill } from '../ui';
import { OPEN, type Assignment } from '../types';

function Stat({ label, value, tone, onPress }: { label: string; value: number; tone?: string; onPress: () => void }) {
  const { n } = useI18n();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.stat}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: tone ?? C.ink }}>{n(value)}</Text>
      <Text style={{ color: C.sub, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export default function Today() {
  const { me } = useAuth();
  const { t, err, dueInfo } = useI18n();
  const nav = useNavigation<any>();
  const [mine, setMine] = useState<Assignment[] | null>(null);
  const [given, setGiven] = useState<Assignment[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api<Assignment[]>('/tasks/mine'), api<Assignment[]>('/tasks/given')]);
      setMine(a);
      setGiven(b);
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

  const open = (mine ?? []).filter((a) => OPEN.includes(a.status));
  const now = Date.now();
  const overdue = open.filter((a) => a.task.dueDate && new Date(a.task.dueDate).getTime() < now && a.status !== 'SUBMITTED');
  const toAccept = open.filter((a) => a.status === 'PENDING_ACCEPTANCE');
  const toApprove = given.filter((a) => a.status === 'SUBMITTED');
  const dueToday = open.filter((a) => a.task.dueDate && new Date(a.task.dueDate).toDateString() === new Date().toDateString() && !overdue.includes(a));

  const hour = new Date().getHours();
  const greet = t(hour < 12 ? 'dk.morning' : hour < 17 ? 'dk.afternoon' : 'dk.evening', { name: me?.name.split(' ')[0] ?? '' });

  const Group = ({ title, items, tone }: { title: string; items: Assignment[]; tone?: string }) =>
    items.length === 0 ? null : (
      <Card style={{ gap: 8 }}>
        <Text style={{ fontWeight: '800', color: tone ?? C.ink }}>{title}</Text>
        {items.slice(0, 6).map((a) => (
          <Pressable key={a.id} onPress={() => nav.navigate('TaskDetail', { id: a.id })} style={s.item} accessibilityRole="button">
            <Text style={{ color: C.ink, fontWeight: '600', flex: 1 }} numberOfLines={2}>{a.task.title}</Text>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <StatusPill status={a.status} />
              <Text style={{ color: C.sub, fontSize: 12 }}>{dueInfo(a.task.dueDate, a.status).text}</Text>
            </View>
          </Pressable>
        ))}
      </Card>
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink }}>{greet}</Text>
      <ErrorText msg={error} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label={t('dk.open')} value={open.length} onPress={() => nav.navigate('Mine')} />
        <Stat label={t('dk.overdue')} value={overdue.length} tone={overdue.length ? C.red : undefined} onPress={() => nav.navigate('Mine')} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label={t('dk.toAccept')} value={toAccept.length} tone={toAccept.length ? C.amber : undefined} onPress={() => nav.navigate('Mine')} />
        <Stat label={t('dk.toApprove')} value={toApprove.length} tone={toApprove.length ? C.amber : undefined} onPress={() => nav.navigate('Given')} />
      </View>
      {mine !== null && open.length === 0 && toApprove.length === 0 && <Empty title={t('dk.caughtUp', { name: me?.name.split(' ')[0] ?? '' })} text={t('dk.caughtUpText')} />}
      <Group title={t('dk.gAccept')} items={toAccept} tone={C.amber} />
      <Group title={t('dk.gApprove')} items={toApprove} tone={C.amber} />
      <Group title={t('dk.gOverdue')} items={overdue} tone={C.red} />
      <Group title={t('dk.gToday')} items={dueToday} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, gap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
});
