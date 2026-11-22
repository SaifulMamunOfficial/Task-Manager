import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api, post } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Avatar, Btn, C, Chip, Empty, ErrorText, Fab, Icon, Progress, ReasonModal, SH, StatusPill, statusColor } from '../ui';
import { OPEN, type Assignment } from '../types';

type Filter = 'open' | 'approve' | 'overdue' | 'closed';
const FILTERS: Filter[] = ['open', 'approve', 'overdue', 'closed'];

const isOpen = (a: Assignment) => OPEN.includes(a.status);
const isLate = (a: Assignment) => !!a.task.dueDate && new Date(a.task.dueDate) < new Date() && ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED'].includes(a.status);
const matches = (a: Assignment, f: Filter) => (f === 'open' ? isOpen(a) : f === 'approve' ? a.status === 'SUBMITTED' : f === 'overdue' ? isLate(a) : !isOpen(a));

type Group = { taskId: string; task: Assignment['task']; rows: Assignment[] };

/** "Assigned by me": one card per task, with one line per person so you see who is where. */
export default function GivenList() {
  const { t, n, err, dueInfo } = useI18n();
  const { canGive } = useAuth();
  const nav = useNavigation<any>();
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [q, setQ] = useState('');
  const [sendBack, setSendBack] = useState<Assignment | null>(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api<Assignment[]>('/tasks/given'));
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

  async function move(a: Assignment, status: string, comment?: string) {
    setBusyId(a.id);
    try {
      await post(`/assignments/${a.id}/transition`, { status, comment });
      await load();
    } finally {
      setBusyId('');
    }
  }

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, (rows ?? []).filter((a) => matches(a, f)).length])) as Record<Filter, number>, [rows]);

  const groups = useMemo<Group[]>(() => {
    const needle = q.trim().toLowerCase();
    const map = new Map<string, Group>();
    (rows ?? [])
      .filter((a) => matches(a, filter) && (!needle || (a.task.title + ' ' + (a.assignee?.name ?? '')).toLowerCase().includes(needle)))
      .forEach((a) => {
        const g = map.get(a.taskId) ?? { taskId: a.taskId, task: a.task, rows: [] };
        g.rows.push(a);
        map.set(a.taskId, g);
      });
    const due = (g: Group) => (g.task.dueDate ? new Date(g.task.dueDate).getTime() : Infinity);
    const wait = (g: Group) => (g.rows.some((a) => a.status === 'SUBMITTED') ? 0 : 1);
    return [...map.values()].sort((x, y) => wait(x) - wait(y) || due(x) - due(y));
  }, [rows, filter, q]);

  const never = rows !== null && rows.length === 0;
  const emptyKey = `gv.e.${filter}`;

  // One slim alert when someone is waiting for you; the chips above already filter everything else.
  const header =
    counts.approve > 0 && filter !== 'approve' ? (
      <Pressable onPress={() => setFilter('approve')} accessibilityRole="button" style={({ pressed }) => [s.alert, pressed && { opacity: 0.9 }]}>
        <Icon name="hourglass" size={20} color={C.amber} />
        <Text style={{ flex: 1, color: C.amber, fontWeight: '800' }}>
          {t('mb.gv.waiting')}: {n(counts.approve)}
        </Text>
        <Icon name="chevron-forward" size={18} color={C.amber} />
      </Pressable>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.head}>
        <View style={s.searchBox}>
          <Icon name="search" size={18} color="#94a3b8" />
          <TextInput value={q} onChangeText={setQ} placeholder={t('mt.search')} placeholderTextColor="#94a3b8" style={s.search} accessibilityLabel={t('mt.searchLabel')} returnKeyType="search" />
          {!!q && (
            <Pressable onPress={() => setQ('')} accessibilityLabel={t('c.clearSearch')} hitSlop={10}>
              <Icon name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          )}
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f}
          contentContainerStyle={{ gap: 8, paddingTop: 10, paddingBottom: 12 }}
          renderItem={({ item }) => <Chip on={filter === item} onPress={() => setFilter(item)} label={`${t(`f.${item}`)}${counts[item] ? `  ${n(counts[item])}` : ''}`} />}
        />
      </View>
      <ErrorText msg={error} />

      <FlatList
        data={groups}
        keyExtractor={(g) => g.taskId}
        contentContainerStyle={{ padding: 14, gap: 12, flexGrow: 1, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={rows !== null && !never ? header : null}
        ListEmptyComponent={
          rows === null ? (
            <Empty title={t('c.loading')} icon="hourglass-outline" />
          ) : never ? (
            <Empty title={t('gv.never')} text={t('gv.never.t')} icon="paper-plane-outline" />
          ) : q ? (
            <Empty title={t('mt.noMatch')} text={t('mt.tryOther')} icon="search-outline" />
          ) : (
            <Empty title={t(emptyKey)} text={t(`${emptyKey}.t`)} />
          )
        }
        renderItem={({ item: g }) => {
          const waiting = g.rows.some((a) => a.status === 'SUBMITTED');
          const due = dueInfo(g.task.dueDate, g.rows[0].status);
          const late = g.rows.some(isLate);
          const avg = Math.round(g.rows.reduce((sum, a) => sum + a.progressPercent, 0) / g.rows.length);
          const accent = late ? C.red : waiting ? C.amber : statusColor(g.rows[0].status);
          const many = g.rows.length > 1;
          return (
            <View style={[s.card, SH]}>
              <View style={{ width: 4, backgroundColor: accent }} />
              <View style={{ flex: 1, padding: 12, gap: 10 }}>
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={s.title} numberOfLines={2}>{g.task.title}</Text>
                    {g.task.priority === 'URGENT' && <Icon name="flame" size={18} color={C.red} />}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Icon name="calendar-outline" size={13} color={late ? C.red : C.sub} />
                    <Text style={{ color: late ? C.red : due.tone === 'soon' ? C.amber : C.sub, fontSize: 12.5, fontWeight: late ? '800' : '600' }}>{due.text}</Text>
                    {many && <Text style={{ color: C.sub, fontSize: 12.5 }}>· {t('mb.gv.people', { n: g.rows.length })} · {t('mb.gv.avg', { n: avg })}</Text>}
                  </View>
                </View>

                <View style={s.people}>
                  {g.rows.map((a, i) => (
                    <View key={a.id} style={i > 0 && { borderTopWidth: 1, borderTopColor: C.line }}>
                      <Pressable onPress={() => nav.navigate('TaskDetail', { id: a.id })} accessibilityRole="button" style={({ pressed }) => [s.person, pressed && { opacity: 0.85 }]}>
                        <Avatar name={a.assignee?.name ?? '?'} size={30} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <Text style={{ color: C.ink, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{a.assignee?.name}</Text>
                            <StatusPill status={a.status} />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Progress value={a.progressPercent} />
                            <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700', minWidth: 34, textAlign: 'right' }}>{n(a.progressPercent)}%</Text>
                          </View>
                        </View>
                      </Pressable>
                      {a.status === 'SUBMITTED' && (
                        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 10 }}>
                          <Btn label={t('mb.approveShort')} kind="primary" compact busy={busyId === a.id} onPress={() => move(a, 'APPROVED').catch((e) => setError(err(e.message)))} style={{ minWidth: 92 }} />
                          <Btn label={t('act.sendBack')} compact onPress={() => setSendBack(a)} style={{ minWidth: 92 }} />
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          );
        }}
      />
      {canGive && <Fab label={t('nav.newTask')} onPress={() => nav.navigate('NewTask')} />}
      <ReasonModal
        visible={!!sendBack}
        title={t('tl.sendBackTitle')}
        hint={sendBack ? t('tl.sendBackHint', { title: sendBack.task.title, name: sendBack.assignee?.name ?? '' }) : ''}
        confirmLabel={t('act.sendBack')}
        onConfirm={(r) => move(sendBack!, 'IN_PROGRESS', r)}
        onClose={() => setSendBack(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  head: { backgroundColor: '#fff', paddingHorizontal: 14, paddingTop: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, borderRadius: 14, backgroundColor: C.graySoft, paddingHorizontal: 14 },
  search: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 8 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.amberSoft, borderRadius: 16, padding: 14 },
  card: { backgroundColor: '#fff', borderRadius: 18, flexDirection: 'row', overflow: 'hidden' },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: C.ink, lineHeight: 22 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.redSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  people: { backgroundColor: C.graySoft, borderRadius: 14, paddingHorizontal: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
});
