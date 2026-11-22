import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { post } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Btn, C, Card, ErrorText, Field, KeyboardView } from '../ui';

/** Shown on its own (before anything else) when the password is temporary, and reachable from the account screen. */
export default function ChangePassword({ forced }: { forced?: boolean }) {
  const { reload, logout } = useAuth();
  const { t, err } = useI18n();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function go() {
    setError('');
    if (next.length < 8) return setError(t('mb.minChars'));
    setBusy(true);
    try {
      await post('/auth/change-password', { currentPassword: cur, newPassword: next });
      setDone(true);
      setCur('');
      setNext('');
      await reload();
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardView>
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12, flexGrow: forced ? 1 : undefined, justifyContent: forced ? 'center' : undefined }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: 14 }}>
        {forced && <Text style={{ color: C.amber, fontWeight: '700' }}>{t('mb.mustChange')}</Text>}
        <Field label={t('mb.curPass')} value={cur} onChangeText={setCur} secureTextEntry textContentType="password" />
        <Field label={t('mb.newPass')} value={next} onChangeText={setNext} secureTextEntry textContentType="newPassword" />
        <ErrorText msg={error} />
        {done && <Text style={{ color: C.green, fontWeight: '700' }}>{t('mb.passChanged')}</Text>}
        <Btn label={t('c.save')} kind="primary" busy={busy} disabled={!cur || !next} onPress={go} />
      </Card>
      {forced && <Btn label={t('nav.signOut')} onPress={() => logout()} />}
    </ScrollView>
    </KeyboardView>
  );
}
