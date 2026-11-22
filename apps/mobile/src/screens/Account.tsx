import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, put } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { registerPush, unregisterPush } from '../push';
import { Avatar, Btn, C, Card, ErrorText, Icon, Label, SH, type IconName } from '../ui';
import type { Prefs } from '../types';
import { LangSwitch } from './LangSwitch';

function Section({ icon, tone, soft, title, right, children }: { icon: IconName; tone: string; soft: string; title: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[s.ico, { backgroundColor: soft }]}>
          <Icon name={icon} size={20} color={tone} />
        </View>
        <Text style={{ flex: 1, fontWeight: '800', color: C.ink, fontSize: 16 }}>{title}</Text>
        {right}
      </View>
      {children}
    </Card>
  );
}

export default function Account() {
  const { me, logout } = useAuth();
  const { t, err, posTitle } = useI18n();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
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
  const first = me?.positions[0];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[s.hero, { paddingTop: 24 + (me?.isAdmin ? insets.top : 0) }]}>
        {me && (
          <>
            <View style={s.avatarRing}>
              <Avatar name={me.name} size={72} />
            </View>
            <Text style={s.name}>{me.name}</Text>
            <Text style={{ color: C.sub }}>{me.email}</Text>
            {first && (
              <View style={s.rolePill}>
                <Icon name="briefcase-outline" size={14} color={C.brand} />
                <Text style={{ color: C.brand, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                  {posTitle(first.position)} · {first.unit.name}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      <View style={{ paddingHorizontal: 14, gap: 12, marginTop: -26 }}>
        <Section icon="language" tone={C.blue} soft={C.blueSoft} title={t('c.langLabel')}>
          <LangSwitch />
        </Section>

        <ErrorText msg={error} />

        {p && (
          <>
            <Section
              icon="mail-outline"
              tone={C.green}
              soft={C.greenSoft}
              title={t('ac.email')}
              right={<Switch value={p.notifyEmail && p.emailAvailable} disabled={!p.emailAvailable} onValueChange={(v) => pref({ notifyEmail: v })} trackColor={{ true: C.brand }} accessibilityLabel={t('ac.email')} />}
            >
              <Text style={{ color: C.sub, lineHeight: 21 }}>{p.emailAvailable ? t('ac.emailText', { email: p.email }) : t('ac.emailOff')}</Text>
            </Section>

            <Section
              icon="notifications-outline"
              tone={C.amber}
              soft={C.amberSoft}
              title={t('ac.push')}
              right={<Switch value={p.notifyPush && pushAvail} disabled={!pushAvail} onValueChange={(v) => pref({ notifyPush: v })} trackColor={{ true: C.brand }} accessibilityLabel={t('ac.master')} />}
            >
              {!pushAvail ? (
                <Text style={{ color: C.sub, lineHeight: 21 }}>{t('ac.pushOff')}</Text>
              ) : (
                <>
                  <Text style={{ color: C.sub, lineHeight: 21 }}>{t('ac.pushText')}</Text>
                  <View style={s.phone}>
                    <Icon name="phone-portrait-outline" size={20} color={phoneOn ? C.green : C.sub} />
                    <View style={{ flex: 1 }}>
                      <Label>{t('mb.thisPhone')}</Label>
                      <Text style={{ color: C.ink, fontWeight: '600' }}>{phoneOn ? t('mb.phoneOn') : t('mb.phoneOff')}</Text>
                    </View>
                  </View>
                  {!!phoneMsg && <Text style={{ color: C.amber, lineHeight: 20 }}>{phoneMsg}</Text>}
                  {phoneOn ? <Btn label={t('mb.phoneDisable')} busy={busy} onPress={disable} /> : <Btn label={t('mb.phoneEnable')} kind="primary" busy={busy} onPress={enable} />}
                </>
              )}
            </Section>
          </>
        )}

        <Pressable onPress={() => nav.navigate('ChangePassword')} accessibilityRole="button" style={({ pressed }) => [s.link, SH, pressed && { opacity: 0.92 }]}>
          <View style={[s.ico, { backgroundColor: C.graySoft }]}>
            <Icon name="key-outline" size={20} color={C.gray} />
          </View>
          <Text style={{ flex: 1, fontWeight: '700', color: C.ink, fontSize: 15.5 }}>{t('nav.changePassword')}</Text>
          <Icon name="chevron-forward" size={18} color="#94a3b8" />
        </Pressable>

        <Btn
          label={t('nav.signOut')}
          icon="log-out-outline"
          kind="danger"
          onPress={() =>
            Alert.alert(t('mb.signOutAsk'), '', [
              { text: t('c.cancel'), style: 'cancel' },
              { text: t('nav.signOut'), style: 'destructive', onPress: () => logout() },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: C.brandSoft, alignItems: 'center', gap: 4, paddingHorizontal: 18, paddingBottom: 44, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  avatarRing: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  name: { fontSize: 22, fontWeight: '800', color: C.ink },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 8, maxWidth: '100%' },
  ico: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.graySoft, borderRadius: 14, padding: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 14 },
});
