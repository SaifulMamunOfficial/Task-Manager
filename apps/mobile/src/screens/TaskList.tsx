import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, post } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Avatar, Btn, C, Chip, Empty, ErrorText, Fab, Icon, Progress, ReasonModal, SH, StatusPill, statusColor } from '../ui';
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
  const { t, n, err, dueInfo, personName } = useI18n();
  const { canGive } = useAuth();
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
      .filter((a) => !needle || (a.task.title + ' ' + ((who === 'mine' ? personName(a.assignedBy) : personName(a.assignee)) ?? '')).toLowerCase().includes(needle));
  }, [rows, filter, q, who]);

  const prefix = who === 'mine' ? 'mt' : 'gv';
  const emptyKey = `${prefix}.e.${filter === 'approve' ? 'approve' : filter}`;

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
          data={filters}
          keyExtractor={(f) => f}
          contentContainerStyle={{ gap: 8, paddingTop: 10, paddingBottom: 12 }}
          renderItem={({ item }) => <Chip on={filter === item} onPress={() => setFilter(item)} label={`${t(`f.${item}`)}${counts[item] ? `  ${n(counts[item])}` : ''}`} />}
        />
      </View>
      <ErrorText msg={error} />
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 14, gap: 12, flexGrow: 1, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          rows === null ? <Empty title={t('c.loading')} icon="hourglass-outline" /> : q ? <Empty title={t('mt.noMatch')} text={t('mt.tryOther')} icon="search-outline" /> : <Empty title={t(emptyKey)} text={t(`${emptyKey}.t`)} />
        }
        renderItem={({ item: a }) => {
          const person = who === 'mine' ? personName(a.assignedBy) : personName(a.assignee);
          const due = dueInfo(a.task.dueDate, a.status);
          const late = due.tone === 'late';
          return (
            <Pressable onPress={() => nav.navigate('TaskDetail', { id: a.id })} accessibilityRole="button" style={({ pressed }) => [s.row, SH, pressed && { opacity: 0.93 }]}>
              <View style={{ width: 5, backgroundColor: late ? C.red : statusColor(a.status) }} />
              <View style={{ flex: 1, padding: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Text style={s.title} numberOfLines={2}>{a.task.title}</Text>
                  {a.task.priority === 'URGENT' && (
                    <View style={s.urgent}>
                      <Icon name="flame" size={12} color={C.red} />
                      <Text style={{ color: C.red, fontSize: 12, fontWeight: '800' }}>{t('prio.URGENT')}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <StatusPill status={a.status} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="calendar-outline" size={14} color={late ? C.red : C.sub} />
                    <Text style={{ color: late ? C.red : due.tone === 'soon' ? C.amber : C.sub, fontSize: 13, fontWeight: late ? '800' : '600' }}>{due.text}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {!!person && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                      <Avatar name={person} size={22} />
                      <Text style={{ color: C.sub, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>{t(who === 'mine' ? 'tl.from' : 'tl.to', { name: person })}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 90 }}>
                    <Progress value={a.progressPercent} />
                    <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>{n(a.progressPercent)}%</Text>
                  </View>
                </View>
                {who === 'mine' && a.status === 'PENDING_ACCEPTANCE' && (
                  <View style={s.acts}>
                    <Btn label={t('mb.acceptShort')} kind="primary" compact busy={busyId === a.id} onPress={() => move(a, 'ACCEPTED').catch((e) => setError(err(e.message)))} style={{ minWidth: 92 }} />
                    <Btn label={t('mb.declineShort')} compact onPress={() => setDecline(a)} style={{ minWidth: 92 }} />
                  </View>
                )}
                {who === 'given' && a.status === 'SUBMITTED' && (
                  <View style={s.acts}>
                    <Btn label={t('mb.approveShort')} kind="primary" compact busy={busyId === a.id} onPress={() => move(a, 'APPROVED').catch((e) => setError(err(e.message)))} style={{ minWidth: 92 }} />
                    <Btn label={t('act.sendBack')} compact onPress={() => setSendBack(a)} style={{ minWidth: 92 }} />
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />
      {canGive && <Fab label={t('nav.newTask')} onPress={() => nav.navigate('NewTask')} />}
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
        hint={sendBack ? t('tl.sendBackHint', { title: sendBack.task.title, name: personName(sendBack.assignee) ?? '' }) : ''}
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
  row: { backgroundColor: '#fff', borderRadius: 18, flexDirection: 'row', overflow: 'hidden' },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: C.ink, lineHeight: 22 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.redSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  acts: { flexDirection: 'row', gap: 8 },
});
