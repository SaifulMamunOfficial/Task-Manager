import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { api, downloadAndOpen, post, upload, type PickedFile } from '../api';
import { useI18n } from '../i18n';
import { Avatar, Btn, C, Card, Chip, Empty, ErrorText, Field, KeyboardView, Label, Progress, ReasonModal, StatusPill } from '../ui';
import Delegate from './Delegate';
import { ASSIGNEE_TRANSITIONS, GIVER_TRANSITIONS, type Detail, type FileMeta } from '../types';

const STEPS = [0, 25, 50, 75, 100];

export default function TaskDetail() {
  const { t, n, err, dueInfo, dateTime, timeAgo, fmtSize, statusLabel } = useI18n();
  const nav = useNavigation<any>();
  const { id } = useRoute<any>().params as { id: string };
  const [d, setD] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState<null | { status: string; title: string; hint: string; label: string; danger?: boolean }>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      setD(await api<Detail>(`/assignments/${id}`));
      setError('');
    } catch (e: any) {
      if (/not found/i.test(e.message)) setMissing(true);
      else setError(err(e.message));
    }
  }, [id, err]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (missing) return <Empty title={t('td.nf')} text={t('td.nfText')} />;
  if (!d) return <View style={{ flex: 1, backgroundColor: C.bg }}>{error ? <ErrorText msg={error} /> : <Empty title={t('c.loading')} />}</View>;

  const a = d.assignment;
  const isAssignee = d.role === 'assignee';
  const other = isAssignee ? a.assignedBy?.name : a.assignee?.name;
  const due = dueInfo(a.task.dueDate, a.status);
  const actions = (isAssignee ? ASSIGNEE_TRANSITIONS : GIVER_TRANSITIONS)[a.status] ?? [];
  const lastReason = [...d.updates].reverse().find((u) => u.type === 'STATUS_CHANGE' && u.body);
  const canProgress = isAssignee && ['ACCEPTED', 'IN_PROGRESS', 'BLOCKED'].includes(a.status);

  async function move(status: string, comment?: string) {
    await post(`/assignments/${id}/transition`, { status, comment });
    await load();
  }

  function press(status: string) {
    // Declining, sending back and blocking need a reason; cancelling asks "are you sure".
    if (status === 'DECLINED') return setReason({ status, title: t('tl.declineTitle'), hint: t('td.declineHint'), label: t('tl.declineBtn'), danger: true });
    if (status === 'IN_PROGRESS' && !isAssignee) return setReason({ status, title: t('tl.sendBackTitle'), hint: t('td.sendBackHint', { name: other ?? '' }), label: t('act.sendBack') });
    if (status === 'BLOCKED') return setReason({ status, title: t('act.BLOCKED'), hint: '', label: t('c.confirm') });
    if (status === 'CANCELLED') {
      return Alert.alert(t('td.confirmCancel'), '', [
        { text: t('c.cancel'), style: 'cancel' },
        { text: t('act.CANCELLED'), style: 'destructive', onPress: () => run(status) },
      ]);
    }
    run(status);
  }
  async function run(status: string) {
    setBusy(status);
    setError('');
    try {
      await move(status);
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy('');
    }
  }

  async function setProgress(p: number) {
    setBusy(`p${p}`);
    try {
      await post(`/assignments/${id}/updates`, { progressPercent: p });
      await load();
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy('');
    }
  }

  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    setFiles((cur) => [...cur, ...r.assets.map((x) => ({ uri: x.uri, name: x.name, mimeType: x.mimeType }))].slice(0, 10));
  }

  async function submitPost() {
    if (!text.trim() && !files.length) return;
    setPosting(true);
    setError('');
    try {
      if (files.length) await upload(`/assignments/${id}/attachments`, files, { body: text.trim() });
      else await post(`/assignments/${id}/updates`, { body: text.trim() });
      setText('');
      setFiles([]);
      await load();
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setPosting(false);
    }
  }

  async function open(f: FileMeta) {
    try {
      await downloadAndOpen(f.id, f.fileName);
    } catch (e: any) {
      setError(err(e.message));
    }
  }

  const FileRow = ({ f }: { f: FileMeta }) => (
    <Btn label={`${f.fileName}  ·  ${fmtSize(f.sizeBytes)}`} onPress={() => open(f)} style={{ alignItems: 'flex-start' }} />
  );

  return (
    <KeyboardView>
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Card style={{ gap: 10 }}>
        <Text style={s.h1}>{a.task.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StatusPill status={a.status} />
          {a.task.priority === 'URGENT' && <Text style={s.urgent}>{t('prio.URGENT')}</Text>}
        </View>
        {!!other && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Avatar name={other} />
            <Text style={{ color: C.sub, flexShrink: 1 }}>{t(isAssignee ? 'td.givenToYou' : 'td.givenTo', { name: other, date: dateTime(a.createdAt) })}</Text>
          </View>
        )}
        <View style={s.kv}><Label>{t('td.deadline')}</Label><Text style={{ color: due.tone === 'late' ? C.red : C.ink, fontWeight: '600' }}>{a.task.dueDate ? dateTime(a.task.dueDate) : t('due.none')}{a.task.dueDate ? ` (${due.text})` : ''}</Text></View>
        <View style={s.kv}><Label>{t('td.priority')}</Label><Text style={{ color: C.ink, fontWeight: '600' }}>{t(`prio.${a.task.priority}`)}</Text></View>
        <View style={{ gap: 6 }}>
          <Label>{t('td.progress')}</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Progress value={a.progressPercent} />
            <Text style={{ color: C.sub, width: 44, textAlign: 'right' }}>{n(a.progressPercent)}%</Text>
          </View>
        </View>
        {!!a.task.description && (
          <View style={{ gap: 4 }}>
            <Label>{t('td.description')}</Label>
            <Text style={{ color: C.ink, lineHeight: 22 }}>{a.task.description}</Text>
          </View>
        )}
      </Card>

      {a.status === 'DECLINED' && (
        <Card style={s.note}>
          <Text style={{ fontWeight: '700', color: C.red }}>{t('td.declinedBy', { name: a.assignee?.name ?? '' })}</Text>
          {!!lastReason?.body && <Text style={{ color: C.ink }}>{lastReason.body}</Text>}
          {!isAssignee && <Text style={{ color: C.sub }}>{t('td.clarify')}</Text>}
        </Card>
      )}
      {a.status === 'SUBMITTED' && (
        <Card style={s.note}>
          <Text style={{ fontWeight: '700', color: C.amber }}>{isAssignee ? t('td.waitingFor', { name: other ?? '' }) : t('td.submittedBy', { name: a.assignee?.name ?? '' })}</Text>
          {!isAssignee && <Text style={{ color: C.sub }}>{t('td.reviewIt')}</Text>}
        </Card>
      )}

      {actions.length > 0 && (
        <Card style={{ gap: 8 }}>
          {actions.map((st) => (
            <Btn
              key={st}
              label={st === 'IN_PROGRESS' && !isAssignee ? t('act.sendBack') : t(`act.${st}`)}
              kind={['ACCEPTED', 'APPROVED', 'SUBMITTED'].includes(st) ? 'primary' : st === 'DECLINED' || st === 'CANCELLED' ? 'danger' : 'default'}
              busy={busy === st}
              onPress={() => press(st)}
            />
          ))}
        </Card>
      )}

      {canProgress && (
        <Card style={{ gap: 8 }}>
          <Label>{t('mb.setProgress')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STEPS.map((p) => (
              <Chip key={p} label={`${n(p)}%`} on={a.progressPercent === p} onPress={() => setProgress(p)} />
            ))}
          </View>
        </Card>
      )}

      {isAssignee && ['ACCEPTED', 'IN_PROGRESS', 'BLOCKED'].includes(a.status) && <Delegate assignmentId={id} onDone={load} />}

      {d.chain?.summary && (
        <Card style={{ gap: 6 }}>
          <Label>{t('td.chain')}</Label>
          <Text style={{ color: C.ink }}>
            {t('td.chainSummary', d.chain.summary)}
            {d.chain.summary.overdue ? t('td.chainOverdue', { n: d.chain.summary.overdue }) : ''}
          </Text>
          {d.chain.rows?.map((r) => (
            <View key={r.id} style={{ paddingLeft: (r.depth - 1) * 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text style={{ flex: 1, color: C.ink }} numberOfLines={1}>{r.assignee} · {r.title}</Text>
              <Text style={{ color: C.sub, fontSize: 12.5 }}>{statusLabel(r.status)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card style={{ gap: 8 }}>
        <Label>{t('td.files')}</Label>
        {d.taskAttachments.length === 0 ? <Text style={{ color: C.sub }}>{t('td.noFiles')}</Text> : d.taskAttachments.map((f) => <FileRow key={f.id} f={f} />)}
      </Card>

      <Card style={{ gap: 10 }}>
        <Label>{t('td.activity')}</Label>
        {d.updates.length === 0 && <Text style={{ color: C.sub }}>{t('td.noActivity')}</Text>}
        {d.updates.map((u) => (
          <View key={u.id} style={{ gap: 4, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Avatar name={u.user.name} size={24} />
              <Text style={{ flex: 1, color: C.ink }}>
                <Text style={{ fontWeight: '700' }}>{u.user.name}</Text>
                {u.type === 'STATUS_CHANGE' && ` ${t('td.ev.status', { status: statusLabel(u.meta?.to ?? '') })}`}
                {u.type === 'PROGRESS' && ` ${t('td.ev.progress', { n: u.meta?.progressPercent ?? 0 })}`}
              </Text>
              <Text style={{ color: C.sub, fontSize: 12 }}>{timeAgo(u.createdAt)}</Text>
            </View>
            {!!u.body && <Text style={{ color: C.ink, lineHeight: 21 }}>{u.body}</Text>}
            {u.attachments.map((f) => <FileRow key={f.id} f={f} />)}
          </View>
        ))}
        {(isAssignee || d.role === 'giver') && ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED'].includes(a.status) && (
          <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 }}>
            <Field value={text} onChangeText={setText} multiline placeholder={t('td.writeUpdate')} />
            {files.map((f, i) => (
              <Btn key={`${f.uri}${i}`} label={`✕  ${f.name}`} onPress={() => setFiles(files.filter((_, j) => j !== i))} style={{ alignItems: 'flex-start' }} />
            ))}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn label={t('td.attach')} onPress={pick} style={{ flex: 1 }} />
              <Btn label={posting ? t('td.posting') : t('td.post')} kind="primary" busy={posting} disabled={!text.trim() && !files.length} onPress={submitPost} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </Card>

      <ErrorText msg={error} />

      <ReasonModal
        visible={!!reason}
        title={reason?.title ?? ''}
        hint={reason?.hint}
        confirmLabel={reason?.label ?? ''}
        danger={reason?.danger}
        onConfirm={(r) => move(reason!.status, r)}
        onClose={() => setReason(null)}
      />
    </ScrollView>
    </KeyboardView>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 20, fontWeight: '800', color: C.ink },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  urgent: { color: C.red, backgroundColor: C.redSoft, fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  note: { gap: 4, backgroundColor: C.amberSoft },
});
