import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, post } from '../api';
import { useI18n } from '../i18n';
import { Avatar, Btn, C, Chip, Empty, ErrorText, Progress, ReasonModal, StatusPill } from '../ui';
import { OPEN, type Assignment } from '../types';

type Who = 'mine' | 'given';
type Filter = 'open' | 'overdue' | 'today' | 'week' | 'closed' | 'approve';

const isOpen = (a: Assignment) => OPEN.includes(a.status);
const isLate = (a: Assignment) => !!a.task.dueDate && new Date(a.task.dueDate) < new Date() && ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED'].includes(a.status);
const sameDay = (d: Date, e: Date) => d.toDateString() === e.toDateString();

function matches(a: Assignment, f: Filter) {
  const due = a.task.dueDate ? new Date(a.task.dueDate) : null;
  switch (f) {
    case 'open':
      return isOpen(a);
    case 'overdue':
      return isLate(a);
    case 'today':
      return isOpen(a) && !!due && sameDay(due, new Date());
    case 'week':
      return isOpen(a) && !!due && due.getTime() - Date.now() < 7 * 86400_000 && due.getTime() > Date.now() - 86400_000;
    case 'closed':
      return !isOpen(a);
    case 'approve':
      return a.status === 'SUBMITTED';
  }
}

export default function TaskList({ who }: { who: Who }) {
  const { t, n, err, dueInfo } = useI18n();
  const nav = useNavigation<NativeStackNavigationProp<any>>();
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [q, setQ] = useState('');
  const [decline, setDecline] = useState<Assignment | null>(null);
  const [sendBack, setSendBack] = useState<Assignment | null>(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api<Assignment[]>(who === 'mine' ? '/tasks/mine' : '/tasks/given'));
      setError('');
    } catch (e: any) {
      setError(err(e.message));
    }
  }, [who, err]);

  // Reload whenever the screen comes into view (after accepting, creating a task, etc.)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function move(a: Assignment, status: string, comment?: string) {
    setBusyId(a.id);
    try {
      await post(`/assignments/${a.id}/transition`, { status, comment });
      await load();
    } finally {
      setBusyId('');
    }
  }

  const filters: Filter[] = who === 'mine' ? ['open', 'overdue', 'today', 'week', 'closed'] : ['open', 'approve', 'overdue', 'closed'];
  const counts = useMemo(() => Object.fromEntries(filters.map((f) => [f, (rows ?? []).filter((a) => matches(a, f)).length])) as Record<Filter, number>, [rows, who]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? [])
      .filter((a) => matches(a, filter))
      .filter((a) => !needle || (a.task.title + ' ' + ((who === 'mine' ? a.assignedBy?.name : a.assignee?.name) ?? '')).toLowerCase().includes(needle));
  }, [rows, filter, q, who]);

  const prefix = who === 'mine' ? 'mt' : 'gv';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.head}>
        <TextInput value={q} onChangeText={setQ} placeholder={t('mt.search')} placeholderTextColor="#94a3b8" style={s.search} accessibilityLabel={t('mt.searchLabel')} returnKeyType="search" />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          keyExtractor={(f) => f}
          contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
          renderItem={({ item }) => <Chip on={filter === item} onPress={() => setFilter(item)} label={`${t(`f.${item}`)}${counts[item] ? ` ${n(counts[item])}` : ''}`} />}
        />
      </View>
      <ErrorText msg={error} />
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={rows === null ? <Empty title={t('c.loading')} /> : q ? <Empty title={t('mt.noMatch')} text={t('mt.tryOther')} /> : <Empty title={t(`${prefix}.e.${filter === 'approve' ? 'approve' : filter}`)} text={t(`${prefix}.e.${filter === 'approve' ? 'approve' : filter}.t`)} />}
        renderItem={({ item: a }) => {
          const person = who === 'mine' ? a.assignedBy?.name : a.assignee?.name;
          const due = dueInfo(a.task.dueDate, a.status);
          return (
            <Pressable onPress={() => nav.navigate('TaskDetail', { id: a.id })} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { opacity: 0.9 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Text style={s.title} numberOfLines={2}>{a.task.title}</Text>
                {a.task.priority === 'URGENT' && <Text style={s.urgent}>{t('prio.URGENT')}</Text>}
              </View>
              {!!person && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Avatar name={person} size={22} />
                  <Text style={{ color: C.sub, fontSize: 13.5, flexShrink: 1 }} numberOfLines={1}>{t(who === 'mine' ? 'tl.from' : 'tl.to', { name: person })}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <StatusPill status={a.status} />
                <Text style={{ color: due.tone === 'late' ? C.red : due.tone === 'soon' ? C.amber : C.sub, fontSize: 13.5, fontWeight: due.tone === 'late' ? '700' : '500' }}>{due.text}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Progress value={a.progressPercent} />
                <Text style={{ color: C.sub, fontSize: 12.5, width: 40, textAlign: 'right' }}>{n(a.progressPercent)}%</Text>
              </View>
              {who === 'mine' && a.status === 'PENDING_ACCEPTANCE' && (
                <View style={s.acts}>
                  <Btn label={t('act.ACCEPTED')} kind="primary" busy={busyId === a.id} onPress={() => move(a, 'ACCEPTED').catch((e) => setError(err(e.message)))} style={{ flex: 1 }} />
                  <Btn label={t('act.DECLINED')} onPress={() => setDecline(a)} style={{ flex: 1 }} />
                </View>
              )}
              {who === 'given' && a.status === 'SUBMITTED' && (
                <View style={s.acts}>
                  <Btn label={t('act.APPROVED')} kind="primary" busy={busyId === a.id} onPress={() => move(a, 'APPROVED').catch((e) => setError(err(e.message)))} style={{ flex: 1 }} />
                  <Btn label={t('act.sendBack')} onPress={() => setSendBack(a)} style={{ flex: 1 }} />
                </View>
              )}
            </Pressable>
          );
        }}
      />
      <ReasonModal
        visible={!!decline}
        title={t('tl.declineTitle')}
        hint={decline ? t('tl.declineHint', { title: decline.task.title }) : ''}
        confirmLabel={t('tl.declineBtn')}
        danger
        onConfirm={(r) => move(decline!, 'DECLINED', r)}
        onClose={() => setDecline(null)}
      />
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
  head: { backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  search: { minHeight: 42, borderRadius: 10, backgroundColor: C.graySoft, paddingHorizontal: 12, fontSize: 15, color: C.ink },
  row: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  urgent: { color: C.red, backgroundColor: C.redSoft, fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  acts: { flexDirection: 'row', gap: 8 },
});
