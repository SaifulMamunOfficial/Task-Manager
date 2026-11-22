import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { api, downloadAndOpen, post, upload, type PickedFile } from '../api';
import { useI18n } from '../i18n';
import { Avatar, Btn, C, Card, Chip, Empty, ErrorText, Field, Icon, KeyboardView, Label, Progress, ReasonModal, StatusPill, statusColor, type IconName } from '../ui';
import Delegate from './Delegate';
import { ASSIGNEE_TRANSITIONS, GIVER_TRANSITIONS, type Detail, type FileMeta } from '../types';

const STEPS = [0, 25, 50, 75, 100];

function Row({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <View style={s.kv}>
      <View style={s.kvIcon}>
        <Icon name={icon} size={17} color={C.sub} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.kvLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

export default function TaskDetail() {
  const { t, n, err, dueInfo, dateTime, timeAgo, fmtSize, statusLabel } = useI18n();
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

  if (missing) return <Empty title={t('td.nf')} text={t('td.nfText')} icon="document-text-outline" />;
  if (!d) return <View style={{ flex: 1, backgroundColor: C.bg }}>{error ? <ErrorText msg={error} /> : <Empty title={t('c.loading')} icon="hourglass-outline" />}</View>;

  const a = d.assignment;
  const isAssignee = d.role === 'assignee';
  const other = isAssignee ? a.assignedBy?.name : a.assignee?.name;
  const due = dueInfo(a.task.dueDate, a.status);
  const late = due.tone === 'late';
  const actions = (isAssignee ? ASSIGNEE_TRANSITIONS : GIVER_TRANSITIONS)[a.status] ?? [];
  const lastReason = [...d.updates].reverse().find((u) => u.type === 'STATUS_CHANGE' && u.body);
  const canProgress = isAssignee && ['ACCEPTED', 'IN_PROGRESS', 'BLOCKED'].includes(a.status);
  const canPost = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED'].includes(a.status);

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
    <Pressable onPress={() => open(f)} accessibilityRole="button" accessibilityLabel={t('td.download', { name: f.fileName })} style={({ pressed }) => [s.file, pressed && { opacity: 0.85 }]}>
      <View style={s.fileIcon}>
        <Icon name="document-attach-outline" size={20} color={C.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.ink, fontWeight: '700' }} numberOfLines={1}>{f.fileName}</Text>
        <Text style={{ color: C.sub, fontSize: 12.5 }}>{fmtSize(f.sizeBytes)}</Text>
      </View>
      <Icon name="download-outline" size={20} color={C.sub} />
    </Pressable>
  );

  const primary = actions.filter((st) => ['ACCEPTED', 'APPROVED', 'SUBMITTED', 'IN_PROGRESS', 'PENDING_ACCEPTANCE'].includes(st) && !(st === 'IN_PROGRESS' && !isAssignee))[0];
  const rest = actions.filter((st) => st !== primary);
  const label = (st: string) => (st === 'IN_PROGRESS' && !isAssignee ? t('act.sendBack') : t(`act.${st}`));
  const actIcon = (st: string): IconName => ({ ACCEPTED: 'checkmark', APPROVED: 'checkmark-done', SUBMITTED: 'send', IN_PROGRESS: 'play', PENDING_ACCEPTANCE: 'refresh', DECLINED: 'close', CANCELLED: 'trash-outline', BLOCKED: 'hand-left-outline' } as Record<string, IconName>)[st] ?? 'ellipse';

  return (
    <KeyboardView>
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Card style={{ gap: 14, paddingTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StatusPill status={a.status} />
            {a.task.priority === 'URGENT' && (
              <View style={s.urgent}>
                <Icon name="flame" size={13} color={C.red} />
                <Text style={{ color: C.red, fontSize: 12, fontWeight: '800' }}>{t('prio.URGENT')}</Text>
              </View>
            )}
          </View>
          <Text style={s.h1}>{a.task.title}</Text>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Progress value={a.progressPercent} />
              <Text style={{ color: C.ink, fontWeight: '800' }}>{n(a.progressPercent)}%</Text>
            </View>
          </View>
        </Card>

        {a.status === 'DECLINED' && (
          <View style={[s.banner, { backgroundColor: C.redSoft }]}>
            <Icon name="close-circle" size={20} color={C.red} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontWeight: '800', color: C.red }}>{t('td.declinedBy', { name: a.assignee?.name ?? '' })}</Text>
              {!!lastReason?.body && <Text style={{ color: C.ink }}>{lastReason.body}</Text>}
              {!isAssignee && <Text style={{ color: C.sub }}>{t('td.clarify')}</Text>}
            </View>
          </View>
        )}
        {a.status === 'SUBMITTED' && (
          <View style={[s.banner, { backgroundColor: C.amberSoft }]}>
            <Icon name="time" size={20} color={C.amber} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontWeight: '800', color: C.amber }}>{isAssignee ? t('td.waitingFor', { name: other ?? '' }) : t('td.submittedBy', { name: a.assignee?.name ?? '' })}</Text>
              {!isAssignee && <Text style={{ color: C.sub }}>{t('td.reviewIt')}</Text>}
            </View>
          </View>
        )}

        {actions.length > 0 && (
          <View style={{ gap: 10 }}>
            {primary && <Btn label={label(primary)} icon={actIcon(primary)} kind="primary" busy={busy === primary} onPress={() => press(primary)} />}
            {rest.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                {rest.map((st) => (
                  <Btn key={st} label={label(st)} icon={actIcon(st)} kind={st === 'DECLINED' || st === 'CANCELLED' ? 'danger' : 'default'} busy={busy === st} onPress={() => press(st)} style={{ flexGrow: 1, flexBasis: '45%' }} />
                ))}
              </View>
            )}
          </View>
        )}

        <Card style={{ gap: 16 }}>
          <Label>{t('td.details')}</Label>
          {!!other && (
            <Row icon="person-outline" label={t(isAssignee ? 'td.givenBy' : 'td.assignedTo')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <Avatar name={other} size={24} />
                <Text style={s.kvValue}>{other}</Text>
              </View>
              <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>{dateTime(a.createdAt)}</Text>
            </Row>
          )}
          <Row icon="calendar-outline" label={t('td.deadline')}>
            <Text style={[s.kvValue, late && { color: C.red }]}>{a.task.dueDate ? dateTime(a.task.dueDate) : t('due.none')}</Text>
            {!!a.task.dueDate && <Text style={{ color: late ? C.red : C.sub, fontSize: 12.5, marginTop: 2 }}>{due.text}</Text>}
          </Row>
          <Row icon="flag-outline" label={t('td.priority')}>
            <Text style={s.kvValue}>{t(`prio.${a.task.priority}`)}</Text>
          </Row>
          {!!a.task.description && (
            <Row icon="reader-outline" label={t('td.description')}>
              <Text style={{ color: C.ink, lineHeight: 22, marginTop: 2 }}>{a.task.description}</Text>
            </Row>
          )}
        </Card>

        {canProgress && (
          <Card style={{ gap: 10 }}>
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
          <Card style={{ gap: 8 }}>
            <Label>{t('td.chain')}</Label>
            <Text style={{ color: C.ink, fontWeight: '600' }}>
              {t('td.chainSummary', d.chain.summary)}
              {d.chain.summary.overdue ? t('td.chainOverdue', { n: d.chain.summary.overdue }) : ''}
            </Text>
            {d.chain.rows?.map((r) => (
              <View key={r.id} style={{ paddingLeft: (r.depth - 1) * 14, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor(r.status) }} />
                <Text style={{ flex: 1, color: C.ink }} numberOfLines={1}>{r.assignee} · {r.title}</Text>
                <Text style={{ color: C.sub, fontSize: 12.5 }}>{statusLabel(r.status)}</Text>
              </View>
            ))}
          </Card>
        )}

        <Card style={{ gap: 10 }}>
          <Label>{t('td.files')}</Label>
          {d.taskAttachments.length === 0 ? <Text style={{ color: C.sub }}>{t('td.noFiles')}</Text> : d.taskAttachments.map((f) => <FileRow key={f.id} f={f} />)}
        </Card>

        <Card style={{ gap: 4 }}>
          <Label style={{ marginBottom: 8 }}>{t('td.activity')}</Label>
          {d.updates.length === 0 && <Text style={{ color: C.sub, paddingBottom: 8 }}>{t('td.noActivity')}</Text>}
          {d.updates.map((u, i) => (
            <View key={u.id} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center' }}>
                {u.type === 'STATUS_CHANGE' ? (
                  <View style={[s.dot, { backgroundColor: statusColor(u.meta?.to ?? '') + '22' }]}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor(u.meta?.to ?? '') }} />
                  </View>
                ) : (
                  <Avatar name={u.user.name} size={28} />
                )}
                {i < d.updates.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: C.line, marginVertical: 3 }} />}
              </View>
              <View style={{ flex: 1, gap: 6, paddingBottom: 16 }}>
                <Text style={{ color: C.ink, lineHeight: 20 }}>
                  <Text style={{ fontWeight: '800' }}>{u.user.name}</Text>
                  {u.type === 'STATUS_CHANGE' && ` ${t('td.ev.status', { status: statusLabel(u.meta?.to ?? '') })}`}
                  {u.type === 'PROGRESS' && ` ${t('td.ev.progress', { n: u.meta?.progressPercent ?? 0 })}`}
                  <Text style={{ color: C.sub, fontSize: 12.5 }}>{'  '}{timeAgo(u.createdAt)}</Text>
                </Text>
                {!!u.body && (
                  <View style={s.bubble}>
                    <Text style={{ color: C.ink, lineHeight: 21 }}>{u.body}</Text>
                  </View>
                )}
                {u.attachments.map((f) => <FileRow key={f.id} f={f} />)}
              </View>
            </View>
          ))}

          {canPost && (
            <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 }}>
              <Field value={text} onChangeText={setText} multiline placeholder={t('td.writeUpdate')} />
              {files.map((f, i) => (
                <Pressable key={`${f.uri}${i}`} onPress={() => setFiles(files.filter((_, j) => j !== i))} style={s.file} accessibilityRole="button">
                  <View style={s.fileIcon}>
                    <Icon name="document-outline" size={18} color={C.brand} />
                  </View>
                  <Text style={{ flex: 1, color: C.ink }} numberOfLines={1}>{f.name}</Text>
                  <Icon name="close" size={18} color={C.sub} />
                </Pressable>
              ))}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Btn label={t('td.attach')} icon="attach" onPress={pick} style={{ flex: 1 }} />
                <Btn label={posting ? t('td.posting') : t('td.post')} icon="send" kind="primary" busy={posting} disabled={!text.trim() && !files.length} onPress={submitPost} style={{ flex: 1 }} />
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
  h1: { fontSize: 23, fontWeight: '800', color: C.ink, lineHeight: 31 },
  kv: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  kvIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.graySoft, alignItems: 'center', justifyContent: 'center' },
  kvLabel: { color: C.sub, fontSize: 12.5, fontWeight: '700' },
  kvValue: { color: C.ink, fontWeight: '700', fontSize: 15.5, marginTop: 1 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.redSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  banner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderRadius: 16, padding: 14 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.graySoft, borderRadius: 14, padding: 10 },
  fileIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubble: { backgroundColor: C.graySoft, borderRadius: 14, borderTopLeftRadius: 4, padding: 12 },
});
