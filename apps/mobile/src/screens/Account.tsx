import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api, put } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { registerPush, unregisterPush } from '../push';
import { Avatar, Btn, C, Card, ErrorText, Label } from '../ui';
import type { Prefs } from '../types';
import { LangSwitch } from './LangSwitch';
import * as SecureStore from 'expo-secure-store';

export default function Account() {
  const { me, logout } = useAuth();
  const { t, err, posTitle } = useI18n();
  const nav = useNavigation<any>();
  const [p, setP] = useState<Prefs | null>(null);
  const [error, setError] = useState('');
  const [phoneOn, setPhoneOn] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setP(await api<Prefs>('/notify/preferences'));
      setPhoneOn(!!(await SecureStore.getItemAsync('pushToken')));
    } catch (e: any) {
      setError(err(e.message));
    }
  }, [err]);
  useEffect(() => {
    load();
  }, [load]);

  async function pref(patch: Partial<Pick<Prefs, 'notifyEmail' | 'notifyPush'>>) {
    try {
      setP(await put<Prefs>('/notify/preferences', patch));
    } catch (e: any) {
      setError(err(e.message));
    }
  }

  async function enable() {
    setBusy(true);
    setPhoneMsg('');
    try {
      const r = await registerPush();
      if (r === 'denied') setPhoneMsg(t('mb.phoneDenied'));
      if (r === 'unsupported') setPhoneMsg(t('mb.phoneUnsupported'));
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
      load();
    }
  }
  async function disable() {
    setBusy(true);
    try {
      await unregisterPush();
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
      load();
    }
  }

  const pushAvail = !!p && (p.mobilePushAvailable || p.webPushAvailable);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
      {me && (
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Avatar name={me.name} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink }}>{me.name}</Text>
            <Text style={{ color: C.sub }}>{me.email}</Text>
            <Text style={{ color: C.sub, fontSize: 13 }}>{me.positions.map((x) => `${posTitle(x.position)}, ${x.unit.name}`).join(' · ')}</Text>
          </View>
        </Card>
      )}

      <Card style={{ gap: 10 }}>
        <Label>{t('c.langLabel')}</Label>
        <LangSwitch />
      </Card>

      <ErrorText msg={error} />

      {p && (
        <>
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, fontWeight: '800', color: C.ink, fontSize: 16 }}>{t('ac.email')}</Text>
              <Switch value={p.notifyEmail && p.emailAvailable} disabled={!p.emailAvailable} onValueChange={(v) => pref({ notifyEmail: v })} accessibilityLabel={t('ac.email')} />
            </View>
            <Text style={{ color: C.sub }}>{p.emailAvailable ? t('ac.emailText', { email: p.email }) : t('ac.emailOff')}</Text>
          </Card>

          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, fontWeight: '800', color: C.ink, fontSize: 16 }}>{t('ac.push')}</Text>
              <Switch value={p.notifyPush && pushAvail} disabled={!pushAvail} onValueChange={(v) => pref({ notifyPush: v })} accessibilityLabel={t('ac.master')} />
            </View>
            {!pushAvail ? (
              <Text style={{ color: C.sub }}>{t('ac.pushOff')}</Text>
            ) : (
              <>
                <Text style={{ color: C.sub }}>{t('ac.pushText')}</Text>
                <Label>{t('mb.thisPhone')}</Label>
                <Text style={{ color: C.ink }}>{phoneOn ? t('mb.phoneOn') : t('mb.phoneOff')}</Text>
                {!!phoneMsg && <Text style={{ color: C.amber }}>{phoneMsg}</Text>}
                {phoneOn ? <Btn label={t('mb.phoneDisable')} busy={busy} onPress={disable} /> : <Btn label={t('mb.phoneEnable')} kind="primary" busy={busy} onPress={enable} />}
              </>
            )}
          </Card>
        </>
      )}

      <Btn label={t('nav.changePassword')} onPress={() => nav.navigate('ChangePassword')} />
      <Btn
        label={t('nav.signOut')}
        kind="danger"
        onPress={() =>
          Alert.alert(t('mb.signOutAsk'), '', [
            { text: t('c.cancel'), style: 'cancel' },
            { text: t('nav.signOut'), style: 'destructive', onPress: () => logout() },
          ])
        }
      />
    </ScrollView>
  );
}
