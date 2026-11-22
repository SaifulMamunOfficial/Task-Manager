import { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { api, post } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Btn, C, Card, Chip, ErrorText, Field, Label } from '../ui';
import type { Person } from '../types';
import { PeoplePicker } from './NewTask';

type Rule = { fromPositionId: string; toPositionId: string };

function endOfDay(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(17, 0, 0, 0);
  return d;
}

/** "Pass it on": create a sub-task under this assignment for other people. */
export default function Delegate({ assignmentId, onDone }: { assignmentId: string; onDone: () => void }) {
  const { me, canGive } = useAuth();
  const { t, err, date } = useI18n();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [picker, setPicker] = useState(false);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState<Date | null>(null);
  const [iosDate, setIosDate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open || people.length) return;
    api<Person[]>('/users').then(setPeople).catch(() => {});
    api<Rule[]>('/settings/delegation').then(setRules).catch(() => {});
  }, [open, people.length]);

  if (canGive === false) return null;

  const myPositionIds = me?.positions.map((p) => p.position.id) ?? [];
  const allowed = (u: Person) => rules.some((r) => myPositionIds.includes(r.fromPositionId) && u.positions.some((p) => p.position.id === r.toPositionId));

  function setDay(d: Date) {
    const x = new Date(d);
    x.setHours(17, 0, 0, 0);
    setDue(x);
  }
  function pickDate() {
    const value = due ?? endOfDay(1);
    if (Platform.OS === 'android') DateTimePickerAndroid.open({ value, mode: 'date', minimumDate: new Date(), onChange: (_, d) => d && setDay(d) });
    else setIosDate(true);
  }

  async function submit() {
    setError('');
    if (!assignees.length) return setError(t('td.chooseOne'));
    setBusy(true);
    try {
      await post(`/assignments/${assignmentId}/delegate`, { description: desc.trim() || undefined, dueDate: due ? due.toISOString() : undefined, assigneeIds: assignees });
      setAssignees([]);
      setDesc('');
      setDue(null);
      setOpen(false);
      setDone(true);
      onDone();
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 8 }}>
      <Label>{t('td.passOn')}</Label>
      <Text style={{ color: C.sub }}>{t('td.passOnText')}</Text>
      {done && <Text style={{ color: C.green, fontWeight: '700' }}>{t('td.passedOn')}</Text>}
      <Btn label={t('td.delegate')} onPress={() => { setDone(false); setOpen(true); }} />

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>{t('td.delegateTitle')}</Text>

          <View style={{ gap: 8 }}>
            <Label>{t('nw.who')}</Label>
            <Btn label={assignees.length ? t('mb.chosen', { n: assignees.length }) : t('mb.pickPeople')} onPress={() => setPicker(true)} />
            {assignees.length > 0 && <Text style={{ color: C.ink }}>{assignees.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean).join(', ')}</Text>}
          </View>

          <Field label={t('td.instr')} value={desc} onChangeText={setDesc} multiline />

          <View style={{ gap: 8 }}>
            <Label>{t('td.theirDeadline')}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label={t('nw.q.tomorrow')} on={false} onPress={() => setDue(endOfDay(1))} />
              <Chip label={t('nw.q.3d')} on={false} onPress={() => setDue(endOfDay(3))} />
              <Chip label={t('nw.q.week')} on={false} onPress={() => setDue(endOfDay(7))} />
              <Chip label={t('mb.pickDate')} on={false} onPress={pickDate} />
            </View>
            {due && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: C.ink, fontWeight: '700' }}>{date(due, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                <Btn label={t('mb.clearDate')} onPress={() => setDue(null)} style={{ minHeight: 34 }} />
              </View>
            )}
          </View>

          <ErrorText msg={error} />
          <Btn label={busy ? t('td.sending') : t('td.delegateBtn')} kind="primary" busy={busy} onPress={submit} />
          <Btn label={t('c.cancel')} onPress={() => setOpen(false)} />
        </ScrollView>

        {Platform.OS === 'ios' && iosDate && (
          <Modal transparent animationType="slide" onRequestClose={() => setIosDate(false)}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,.4)' }}>
              <View style={{ backgroundColor: '#fff', padding: 16, gap: 8 }}>
                <DateTimePicker value={due ?? endOfDay(1)} mode="date" display="inline" minimumDate={new Date()} onChange={(_, d) => d && setDay(d)} />
                <Btn label={t('c.confirm')} kind="primary" onPress={() => setIosDate(false)} />
              </View>
            </View>
          </Modal>
        )}

        <PeoplePicker visible={picker} people={people.filter((u) => u.id !== me?.id)} allowed={allowed} value={assignees} onChange={setAssignees} onClose={() => setPicker(false)} />
      </Modal>
    </Card>
  );
}
