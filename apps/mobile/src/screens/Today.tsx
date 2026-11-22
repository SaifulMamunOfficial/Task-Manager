import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Avatar, C, Card, Empty, ErrorText, Icon, SH, StatusPill, statusColor, type IconName } from '../ui';
import { OPEN, type Assignment } from '../types';

function Stat({ label, value, icon, tone, soft, onPress }: { label: string; value: number; icon: IconName; tone: string; soft: string; onPress: () => void }) {
  const { n } = useI18n();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={({ pressed }) => [s.stat, SH, pressed && { opacity: 0.92 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={[s.statIcon, { backgroundColor: soft }]}>
          <Icon name={icon} size={20} color={tone} />
        </View>
        <Text style={s.statNum}>{n(value)}</Text>
      </View>
      <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

export default function Today() {
  const { me } = useAuth();
  const { t, n, err, dueInfo, date } = useI18n();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
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
  const first = me?.name.split(' ')[0] ?? '';
  const greet = t(hour < 12 ? 'dk.morning' : hour < 17 ? 'dk.afternoon' : 'dk.evening', { name: first });
  const nothing = mine !== null && open.length === 0 && toApprove.length === 0;

  const Group = ({ title, items, tone, icon }: { title: string; items: Assignment[]; tone: string; icon: IconName }) =>
    items.length === 0 ? null : (
      <Card style={{ gap: 4, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon name={icon} size={18} color={tone} />
          <Text style={{ fontWeight: '800', color: C.ink, fontSize: 15, flex: 1 }}>{title}</Text>
          <Text style={{ color: tone, fontWeight: '800' }}>{n(items.length)}</Text>
        </View>
        {items.slice(0, 5).map((a, i) => (
          <Pressable
            key={a.id}
            onPress={() => nav.navigate('TaskDetail', { id: a.id })}
            accessibilityRole="button"
            style={({ pressed }) => [s.item, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }, pressed && { backgroundColor: C.graySoft }]}
          >
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: statusColor(a.status) }} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: C.ink, fontWeight: '700', fontSize: 15 }} numberOfLines={2}>{a.task.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <StatusPill status={a.status} />
                <Text style={{ color: C.sub, fontSize: 12.5 }}>{dueInfo(a.task.dueDate, a.status).text}</Text>
              </View>
            </View>
            <Icon name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>
        ))}
      </Card>
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <View style={[s.hero, { paddingTop: 22 + insets.top }]}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.heroDate}>{date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          <Text style={s.heroTitle} numberOfLines={2}>{greet}</Text>
        </View>
        {me && (
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Avatar name={me.name} size={40} />
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 14, gap: 12, marginTop: -34 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label={t('dk.open')} value={open.length} icon="layers-outline" tone={C.brand} soft={C.brandSoft} onPress={() => nav.navigate('Mine')} />
          <Stat label={t('dk.overdue')} value={overdue.length} icon="alarm-outline" tone={overdue.length ? C.red : C.sub} soft={overdue.length ? C.redSoft : C.graySoft} onPress={() => nav.navigate('Mine')} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label={t('dk.toAccept')} value={toAccept.length} icon="hand-left-outline" tone={toAccept.length ? C.amber : C.sub} soft={toAccept.length ? C.amberSoft : C.graySoft} onPress={() => nav.navigate('Mine')} />
          <Stat label={t('dk.toApprove')} value={toApprove.length} icon="checkmark-done-outline" tone={toApprove.length ? C.amber : C.sub} soft={toApprove.length ? C.amberSoft : C.graySoft} onPress={() => nav.navigate('Given')} />
        </View>

        <ErrorText msg={error} />
        {nothing && <Empty title={t('dk.caughtUp', { name: first })} text={t('dk.caughtUpText')} />}
        <Group title={t('dk.gAccept')} items={toAccept} tone={C.amber} icon="hand-left-outline" />
        <Group title={t('dk.gApprove')} items={toApprove} tone={C.amber} icon="checkmark-done-outline" />
        <Group title={t('dk.gOverdue')} items={overdue} tone={C.red} icon="alarm-outline" />
        <Group title={t('dk.gToday')} items={dueToday} tone={C.brand} icon="today-outline" />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: C.brandSoft, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroDate: { color: C.brand, fontWeight: '700', fontSize: 13 },
  heroTitle: { color: C.ink, fontWeight: '800', fontSize: 24, lineHeight: 32 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 8 },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 30, fontWeight: '800', color: C.ink },
  statLabel: { color: C.sub, fontSize: 13, fontWeight: '600', minHeight: 36 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
