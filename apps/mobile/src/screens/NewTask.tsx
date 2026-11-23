import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { api, post, upload, type PickedFile } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Avatar, Btn, C, Card, Chip, Empty, ErrorText, Field, Icon, KeyboardView, Label } from '../ui';
import type { Person } from '../types';

type Rule = { fromPositionId: string; toPositionId: string };
const PRIORITIES = ['LOW', 'NORMAL', 'URGENT'] as const;

function endOfDay(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(17, 0, 0, 0);
  return d;
}

export default function NewTask() {
  const { t, n, err, posTitle, date, unitName } = useI18n();
  const { me } = useAuth();
  const nav = useNavigation<any>();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('NORMAL');
  const [due, setDue] = useState<Date | null>(null);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [fromPos, setFromPos] = useState<string>('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [limited, setLimited] = useState<string[]>([]);
  const [picker, setPicker] = useState(false);
  const [iosDate, setIosDate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Person[]>('/users').then(setPeople).catch(() => {});
    api<Rule[]>('/settings/delegation').then(setRules).catch(() => {});
    api<{ id: string; ownTeamOnly: boolean }[]>('/positions').then((ps) => setLimited(ps.filter((p) => p.ownTeamOnly).map((p) => p.id))).catch(() => {});
  }, []);

  const myPositionIds = useMemo(() => (fromPos ? [fromPos] : me?.positions.map((p) => p.position.id) ?? []), [me, fromPos]);
  // Same rule the server applies: a head (secretary, divisional director) may only pick people of their own division.
  const sameTeam = (fromId: string, p: Person['positions'][number]) =>
    !limited.includes(fromId) ||
    (me?.positions ?? []).filter((g) => g.position.id === fromId).some((g) => (g.secretariatId ? p.secretariatId === g.secretariatId : p.unit.id === g.unit.id && !p.secretariatId));
  const allowed = (u: Person) => rules.some((r) => myPositionIds.includes(r.fromPositionId) && u.positions.some((p) => p.position.id === r.toPositionId && sameTeam(r.fromPositionId, p)));

  // If the position used for giving changes, drop people it may not give to.
  useEffect(() => {
    setAssignees((cur) => cur.filter((id) => { const u = people.find((p) => p.id === id); return u ? allowed(u) : true; }));
  }, [fromPos]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickDate() {
    const value = due ?? endOfDay(1);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        minimumDate: new Date(),
        onChange: (_, d) => {
          if (!d) return;
          const x = new Date(d);
          x.setHours(17, 0, 0, 0);
          setDue(x);
        },
      });
    } else setIosDate(true);
  }

  async function pickFiles() {
    const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    setFiles((cur) => [...cur, ...r.assets.map((x) => ({ uri: x.uri, name: x.name, mimeType: x.mimeType }))].slice(0, 10));
  }

  async function submit() {
    setError('');
    if (!title.trim()) return setError(t('nw.titlePh'));
    if (!assignees.length) return setError(t('nw.choose'));
    setBusy(true);
    try {
      const task = await post('/tasks', {
        title: title.trim(),
        description: desc.trim() || undefined,
        priority,
        dueDate: due ? due.toISOString() : undefined,
        assigneeIds: assignees,
        fromPositionId: fromPos || undefined,
      });
      if (files.length && task?.id) {
        try {
          await upload(`/tasks/${task.id}/attachments`, files);
        } catch (e: any) {
          setError(t('nw.fileFail', { msg: err(e.message) }));
        }
      }
      nav.navigate('Given');
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
    }
  }

  const chosen = assignees.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];

  return (
    <KeyboardView>
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: 14 }}>
        <Field label={t('nw.what')} value={title} onChangeText={setTitle} placeholder={t('nw.titlePh')} />
        <Field label={t('nw.details')} value={desc} onChangeText={setDesc} multiline placeholder={t('nw.detailsPh')} />

        <View style={{ gap: 8 }}>
          <Label>{t('nw.who')}</Label>
          <Btn label={chosen.length ? t('mb.chosen', { n: chosen.length }) : t('mb.pickPeople')} icon="people-outline" onPress={() => setPicker(true)} />
          {chosen.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {chosen.map((u) => (
                <Pressable key={u.id} onPress={() => setAssignees(assignees.filter((x) => x !== u.id))} style={s.tag} accessibilityLabel={t('pp.remove', { name: u.name })}>
                  <Text style={{ color: C.brand, fontWeight: '600' }}>{u.name}  ✕</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {(me?.positions.length ?? 0) > 1 && (
          <View style={{ gap: 8 }}>
            <Label>{t('nw.givingAsLabel')}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label={t('nw.anyPos')} on={!fromPos} onPress={() => setFromPos('')} />
              {me!.positions.map((p) => (
                <Chip key={p.id} label={`${posTitle(p.position)} · ${unitName(p.unit)}`} on={fromPos === p.position.id} onPress={() => setFromPos(p.position.id)} />
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: 8 }}>
          <Label>{t('nw.deadline')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([[0, 'nw.q.today'], [1, 'nw.q.tomorrow'], [3, 'nw.q.3d'], [7, 'nw.q.week']] as const).map(([days, key]) => (
              <Chip key={key} label={t(key)} on={!!due && due.toDateString() === endOfDay(days).toDateString()} onPress={() => setDue(endOfDay(days))} />
            ))}
            <Chip label={t('mb.pickDate')} on={false} onPress={pickDate} />
          </View>
          {due && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: C.ink, fontWeight: '700' }}>{date(due, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              <Btn label={t('mb.clearDate')} onPress={() => setDue(null)} style={{ minHeight: 34 }} />
            </View>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <Label>{t('nw.priority')}</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PRIORITIES.map((p) => <Chip key={p} label={t(`prio.${p}`)} on={priority === p} onPress={() => setPriority(p)} />)}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Label>{t('nw.attach')}</Label>
          <Btn label={t('mb.attachFiles')} icon="attach" onPress={pickFiles} />
          {files.map((f, i) => <Btn key={`${f.uri}${i}`} label={`✕  ${f.name}`} onPress={() => setFiles(files.filter((_, j) => j !== i))} style={{ alignItems: 'flex-start' }} />)}
        </View>

        <ErrorText msg={error} />
        <Btn label={busy ? t('nw.giving') : t('nw.btn')} icon="paper-plane" kind="primary" busy={busy} onPress={submit} />
      </Card>

      {Platform.OS === 'ios' && iosDate && (
        <Modal transparent animationType="slide" onRequestClose={() => setIosDate(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,.4)' }}>
            <View style={{ backgroundColor: '#fff', padding: 16, gap: 8 }}>
              <DateTimePicker
                value={due ?? endOfDay(1)}
                mode="date"
                display="inline"
                minimumDate={new Date()}
                onChange={(_, d) => {
                  if (!d) return;
                  const x = new Date(d);
                  x.setHours(17, 0, 0, 0);
                  setDue(x);
                }}
              />
              <Btn label={t('c.confirm')} kind="primary" onPress={() => setIosDate(false)} />
            </View>
          </View>
        </Modal>
      )}

      <PeoplePicker visible={picker} people={people.filter((u) => u.id !== me?.id)} allowed={allowed} value={assignees} onChange={setAssignees} onClose={() => setPicker(false)} />
    </ScrollView>
    </KeyboardView>
  );
}

export function PeoplePicker({ visible, people, allowed, value, onChange, onClose }: { visible: boolean; people: Person[]; allowed: (u: Person) => boolean; value: string[]; onChange: (ids: string[]) => void; onClose: () => void }) {
  const { t, posTitle, unitName } = useI18n();
  const [q, setQ] = useState('');
  const list = people
    .filter((u) => (u.name + ' ' + u.positions.map((p) => p.position.title + (p.position.titleBn ?? '') + p.unit.name + (p.unit.nameBn ?? '')).join(' ')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(allowed(b)) - Number(allowed(a)) || a.name.localeCompare(b.name));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 48 }}>
        <View style={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink }}>{t('mb.pickPeople')}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('c.close')} hitSlop={12}>
              <Icon name="close" size={26} color={C.ink} />
            </Pressable>
          </View>
          <TextInput value={q} onChangeText={setQ} placeholder={t('pp.search')} placeholderTextColor="#94a3b8" style={s.search} accessibilityLabel={t('pp.searchLabel')} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
          {list.length === 0 && <Empty title={t('pp.none')} />}
          {list.map((u) => {
            const ok = allowed(u);
            const on = value.includes(u.id);
            return (
              <Pressable
                key={u.id}
                disabled={!ok}
                onPress={() => onChange(on ? value.filter((x) => x !== u.id) : [...value, u.id])}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: !ok }}
                style={[s.person, on && { borderColor: C.brand, backgroundColor: C.brandSoft }, !ok && { opacity: 0.45 }]}
              >
                <Avatar name={u.name} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: C.ink }}>{u.name}</Text>
                  <Text style={{ color: C.sub, fontSize: 13 }} numberOfLines={1}>{u.positions.map((p) => `${posTitle(p.position)}, ${unitName(p.secretariat ?? p.unit)}`).join(' · ')}</Text>
                  {!ok && <Text style={{ color: C.amber, fontSize: 12 }}>{t('pp.blocked')}</Text>}
                </View>
                <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? C.brand : '#cbd5e1'} />
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ padding: 12 }}>
          <Btn label={`${t('c.confirm')}${value.length ? ` (${value.length})` : ''}`} kind="primary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  tag: { backgroundColor: C.brandSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  search: { minHeight: 44, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, fontSize: 16, color: C.ink },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 12 },
});
