import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, post } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Avatar, Btn, C, Card, Empty, ErrorText, Fab, Icon, SH, StatusPill, statusColor, type IconName } from '../ui';
import { OPEN, type Assignment } from '../types';

const DAY = 86400_000;
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export default function Today() {
  const { me, canGive } = useAuth();
  const { t, n, err, dueInfo, date } = useI18n();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [mine, setMine] = useState<Assignment[] | null>(null);
  const [given, setGiven] = useState<Assignment[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');

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

  async function move(a: Assignment, status: string) {
    setBusyId(a.id);
    try {
      await post(`/assignments/${a.id}/transition`, { status });
      await load();
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusyId('');
    }
  }

  const v = useMemo(() => {
    const open = (mine ?? []).filter((a) => OPEN.includes(a.status));
    const now = Date.now();
    const today = startOfDay(new Date()).getTime();
    const dueTs = (a: Assignment) => (a.task.dueDate ? new Date(a.task.dueDate).getTime() : null);
    const toAccept = open.filter((a) => a.status === 'PENDING_ACCEPTANCE');
    const toApprove = given.filter((a) => a.status === 'SUBMITTED');
    const overdue = open.filter((a) => a.status !== 'SUBMITTED' && (dueTs(a) ?? Infinity) < now);
    const dueToday = open.filter((a) => {
      const d = dueTs(a);
      return d !== null && d >= now && startOfDay(new Date(d)).getTime() === today;
    });
    const upcoming = open
      .filter((a) => {
        const d = dueTs(a);
        return d !== null && startOfDay(new Date(d)).getTime() > today && d < today + 8 * DAY;
      })
      .sort((a, b) => dueTs(a)! - dueTs(b)!);
    // Tasks due on each of the next 7 days (today first), for the week strip.
    const week = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(today + i * DAY);
      const count = open.filter((a) => {
        const d = dueTs(a);
        return d !== null && startOfDay(new Date(d)).getTime() === day.getTime();
      }).length;
      return { day, count };
    });
    const attention = toAccept.length + toApprove.length + overdue.length;
    return { open, toAccept, toApprove, overdue, dueToday, upcoming, week, attention };
  }, [mine, given]);

  const hour = new Date().getHours();
  const first = me?.name.split(' ')[0] ?? '';
  const greet = t(hour < 12 ? 'dk.morning' : hour < 17 ? 'dk.afternoon' : 'dk.evening', { name: first });
  const loaded = mine !== null;
  const clear = loaded && v.attention === 0 && v.dueToday.length === 0 && v.upcoming.length === 0;

  const TaskLine = ({ a, who, action }: { a: Assignment; who: 'mine' | 'given'; action?: 'accept' | 'approve' }) => {
    const due = dueInfo(a.task.dueDate, a.status);
    const person = who === 'mine' ? a.assignedBy?.name : a.assignee?.name;
    return (
      <View style={s.line}>
        <Pressable onPress={() => nav.navigate('TaskDetail', { id: a.id })} accessibilityRole="button" style={({ pressed }) => [s.lineMain, pressed && { opacity: 0.8 }]}>
          <View style={[s.ring, { borderColor: due.tone === 'late' ? C.red : statusColor(a.status) }]} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.lineTitle} numberOfLines={2}>{a.task.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: due.tone === 'late' ? C.red : due.tone === 'soon' ? C.amber : C.sub, fontSize: 12.5, fontWeight: due.tone === 'late' ? '800' : '600' }}>{due.text}</Text>
              {!!person && <Text style={{ color: C.sub, fontSize: 12.5 }}>· {person}</Text>}
              {a.task.priority === 'URGENT' && <Icon name="flame" size={13} color={C.red} />}
            </View>
          </View>
          {!action && <Icon name="chevron-forward" size={18} color="#94a3b8" />}
        </Pressable>
        {action && (
          <Btn
            label={t(action === 'accept' ? 'act.ACCEPTED' : 'act.APPROVED')}
            kind="primary"
            busy={busyId === a.id}
            onPress={() => move(a, action === 'accept' ? 'ACCEPTED' : 'APPROVED')}
            style={{ minHeight: 40, paddingHorizontal: 14 }}
          />
        )}
      </View>
    );
  };

  const Block = ({ icon, tone, title, count, children }: { icon: IconName; tone: string; title: string; count: number; children: React.ReactNode }) =>
    count === 0 ? null : (
      <Card style={{ gap: 2, paddingVertical: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon name={icon} size={18} color={tone} />
          <Text style={{ flex: 1, fontWeight: '800', color: C.ink, fontSize: 15.5 }}>{title}</Text>
          <View style={[s.badge, { backgroundColor: tone + '1f' }]}>
            <Text style={{ color: tone, fontWeight: '800', fontSize: 12.5 }}>{n(count)}</Text>
          </View>
        </View>
        {children}
      </Card>
    );

  const Stat = ({ label, value, tone, onPress }: { label: string; value: number; tone?: string; onPress: () => void }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={s.stat}>
      <Text style={[s.statNum, value > 0 && tone ? { color: tone } : null]}>{n(value)}</Text>
      <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );

  const approveRest = Math.max(0, v.toApprove.length - 4);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={[s.hero, { paddingTop: 18 + insets.top }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.heroDate}>{date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            <Text style={s.heroTitle} numberOfLines={2}>{greet}</Text>
            {loaded && (
              <View style={s.focus}>
                <Icon name={v.attention > 0 ? 'flash' : 'checkmark-circle'} size={15} color={v.attention > 0 ? C.amber : C.green} />
                <Text style={{ color: v.attention > 0 ? C.amber : C.green, fontWeight: '800', fontSize: 13 }}>
                  {v.attention > 0 ? t('mb.focus', { n: v.attention }) : t('mb.allClear')}
                </Text>
              </View>
            )}
          </View>
          {me && (
            <Pressable onPress={() => nav.navigate('Account')} accessibilityRole="button" accessibilityLabel={t('mb.me')} style={s.avatarRing}>
              <Avatar name={me.name} size={42} />
            </Pressable>
          )}
        </View>

        <View style={{ paddingHorizontal: 14, gap: 12, marginTop: -30 }}>
          <View style={[s.statsCard, SH]}>
            <Stat label={t('dk.open')} value={v.open.length} tone={C.brand} onPress={() => nav.navigate('Mine')} />
            <View style={s.sep} />
            <Stat label={t('dk.overdue')} value={v.overdue.length} tone={C.red} onPress={() => nav.navigate('Mine')} />
            <View style={s.sep} />
            <Stat label={t('dk.toAccept')} value={v.toAccept.length} tone={C.amber} onPress={() => nav.navigate('Mine')} />
            <View style={s.sep} />
            <Stat label={t('dk.toApprove')} value={v.toApprove.length} tone={C.amber} onPress={() => nav.navigate('Given')} />
          </View>

          <ErrorText msg={error} />

          {loaded && (
            <Card style={{ gap: 12 }}>
              <Text style={{ fontWeight: '800', color: C.ink, fontSize: 15.5 }}>{t('mb.week')}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {v.week.map(({ day, count }, i) => (
                  <View key={i} style={[s.day, i === 0 && { backgroundColor: C.brand }]} accessibilityLabel={`${date(day, { weekday: 'long', day: 'numeric' })}: ${count}`}>
                    <Text style={[s.dayName, i === 0 && { color: '#e0e7ff' }]} numberOfLines={1}>{date(day, { weekday: 'short' }).slice(0, 3)}</Text>
                    <Text style={[s.dayNum, i === 0 && { color: '#fff' }]}>{n(day.getDate())}</Text>
                    <View style={[s.dayDot, count > 0 ? { backgroundColor: i === 0 ? '#fff' : C.brand } : { backgroundColor: 'transparent' }]}>
                      {count > 0 && <Text style={{ color: i === 0 ? C.brand : '#fff', fontSize: 10.5, fontWeight: '800' }}>{n(count)}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          )}

          <Block icon="flash" tone={C.amber} title={t('mb.attention')} count={v.toAccept.length + v.toApprove.length}>
            {v.toAccept.map((a) => <TaskLine key={a.id} a={a} who="mine" action="accept" />)}
            {v.toApprove.slice(0, 4).map((a) => <TaskLine key={a.id} a={a} who="given" action="approve" />)}
            {approveRest > 0 && (
              <Pressable onPress={() => nav.navigate('Given')} accessibilityRole="button" style={{ paddingVertical: 10 }}>
                <Text style={{ color: C.brand, fontWeight: '800' }}>{t('mb.more', { n: approveRest })}</Text>
              </Pressable>
            )}
          </Block>
          <Block icon="alarm" tone={C.red} title={t('dk.gOverdue')} count={v.overdue.length}>
            {v.overdue.slice(0, 5).map((a) => <TaskLine key={a.id} a={a} who="mine" />)}
          </Block>
          <Block icon="today" tone={C.brand} title={t('dk.gToday')} count={v.dueToday.length}>
            {v.dueToday.map((a) => <TaskLine key={a.id} a={a} who="mine" />)}
          </Block>
          <Block icon="calendar" tone={C.blue} title={t('mb.upcoming')} count={v.upcoming.length}>
            {v.upcoming.slice(0, 5).map((a) => <TaskLine key={a.id} a={a} who="mine" />)}
          </Block>

          {clear && <Empty title={t('dk.caughtUp', { name: first })} text={t('dk.caughtUpText')} />}
        </View>
      </ScrollView>
      {canGive && <Fab label={t('nav.newTask')} onPress={() => nav.navigate('NewTask')} />}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: C.brandSoft, paddingHorizontal: 18, paddingBottom: 50, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  heroDate: { color: C.brand, fontWeight: '700', fontSize: 13 },
  heroTitle: { color: C.ink, fontWeight: '800', fontSize: 22, lineHeight: 30 },
  focus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  avatarRing: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  statsCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  statNum: { fontSize: 26, fontWeight: '800', color: C.ink },
  statLabel: { color: C.sub, fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
  sep: { width: 1, backgroundColor: C.line, marginVertical: 6 },
  day: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 8, borderRadius: 14, backgroundColor: C.graySoft },
  dayName: { color: C.sub, fontSize: 11, fontWeight: '700' },
  dayNum: { color: C.ink, fontSize: 16, fontWeight: '800' },
  dayDot: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line },
  lineMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineTitle: { color: C.ink, fontWeight: '700', fontSize: 15 },
  ring: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.5 },
  badge: { minWidth: 26, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
