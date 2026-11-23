import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, put } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { registerPush, unregisterPush } from '../push';
import { Avatar, Btn, C, ErrorText, Icon, SH, type IconName } from '../ui';
import { OPEN, type Assignment, type Prefs } from '../types';
import { LangSwitch } from './LangSwitch';

/** One line in a settings group: icon, title (and a small description), something on the right. */
function Row({ icon, tone, soft, title, sub, right, onPress, last }: { icon: IconName; tone: string; soft: string; title: string; sub?: string; right?: ReactNode; onPress?: () => void; last?: boolean }) {
  const body = (
    <View style={[s.row, !last && s.rowLine]}>
      <View style={[s.ico, { backgroundColor: soft }]}>
        <Icon name={icon} size={19} color={tone} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {!!sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { backgroundColor: C.graySoft }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.groupTitle}>{title}</Text>
      <View style={[s.group, SH]}>{children}</View>
    </View>
  );
}

export default function Account() {
  const { me, logout } = useAuth();
  const { t, n, err, posTitle, unitName } = useI18n();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [p, setP] = useState<Prefs | null>(null);
  const [error, setError] = useState('');
  const [phoneOn, setPhoneOn] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{ open: number; given: number; done: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [prefs, mine, given] = await Promise.all([api<Prefs>('/notify/preferences'), api<Assignment[]>('/tasks/mine'), api<Assignment[]>('/tasks/given')]);
      setP(prefs);
      setStats({ open: mine.filter((a) => OPEN.includes(a.status)).length, given: given.filter((a) => OPEN.includes(a.status)).length, done: mine.filter((a) => a.status === 'APPROVED').length });
      setPhoneOn(!!(await SecureStore.getItemAsync('pushToken')));
      setError('');
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

  async function togglePhone() {
    setBusy(true);
    setPhoneMsg('');
    try {
      if (phoneOn) await unregisterPush();
      else {
        const r = await registerPush();
        if (r === 'denied') setPhoneMsg(t('mb.phoneDenied'));
        if (r === 'unsupported') setPhoneMsg(t('mb.phoneUnsupported'));
      }
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
      load();
    }
  }

  const pushAvail = !!p && (p.mobilePushAvailable || p.webPushAvailable);
  const first = me?.positions[0];
  const track = { true: C.brand, false: '#cbd5e1' };

  const Stat = ({ value, label, tone }: { value: number | null; label: string; tone: string }) => (
    <View style={s.stat}>
      <Text style={[s.statNum, { color: tone }]}>{value === null ? '–' : n(value)}</Text>
      <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[s.hero, { paddingTop: 16 + insets.top }]}>
        {me && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={s.avatarRing}>
              <Avatar name={me.name} size={58} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name} numberOfLines={1}>{me.name}</Text>
              <Text style={{ color: C.sub }} numberOfLines={1}>{me.email}</Text>
              {first && (
                <View style={s.rolePill}>
                  <Icon name="briefcase-outline" size={13} color={C.brand} />
                  <Text style={{ color: C.brand, fontWeight: '700', fontSize: 12.5 }} numberOfLines={1}>
                    {posTitle(first.position)} · {unitName(first.unit)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 14, gap: 18, marginTop: -26 }}>
        <View style={[s.statsCard, SH]}>
          <Stat value={stats?.open ?? null} label={t('dk.open')} tone={C.brand} />
          <View style={s.sep} />
          <Stat value={stats?.given ?? null} label={t('mb.stat.given')} tone={C.amber} />
          <View style={s.sep} />
          <Stat value={stats?.done ?? null} label={t('mb.stat.done')} tone={C.green} />
        </View>

        <ErrorText msg={error} />

        <Group title={t('mb.pref')}>
          <Row icon="language" tone={C.blue} soft={C.blueSoft} title={t('c.langLabel')} right={<LangSwitch />} last={!p} />
          {p && (
            <>
              <Row
                icon="mail-outline"
                tone={C.green}
                soft={C.greenSoft}
                title={t('ac.email')}
                sub={p.emailAvailable ? p.email : t('ac.emailOff')}
                right={<Switch value={p.notifyEmail && p.emailAvailable} disabled={!p.emailAvailable} onValueChange={(v) => pref({ notifyEmail: v })} trackColor={track} thumbColor="#fff" accessibilityLabel={t('ac.email')} />}
              />
              <Row
                icon="notifications-outline"
                tone={C.amber}
                soft={C.amberSoft}
                title={t('ac.push')}
                sub={pushAvail ? undefined : t('ac.pushOff')}
                right={<Switch value={p.notifyPush && pushAvail} disabled={!pushAvail} onValueChange={(v) => pref({ notifyPush: v })} trackColor={track} thumbColor="#fff" accessibilityLabel={t('ac.master')} />}
                last={!pushAvail}
              />
              {pushAvail && (
                <Row
                  icon="phone-portrait-outline"
                  tone={phoneOn ? C.green : C.gray}
                  soft={phoneOn ? C.greenSoft : C.graySoft}
                  title={t('mb.thisPhone')}
                  sub={phoneMsg || (phoneOn ? t('mb.phoneOn') : t('mb.phoneOff'))}
                  right={<Btn label={t(phoneOn ? 'mb.phoneDisableShort' : 'mb.phoneEnableShort')} kind={phoneOn ? 'default' : 'primary'} compact busy={busy} onPress={togglePhone} />}
                  last
                />
              )}
            </>
          )}
        </Group>

        <Group title={t('mb.accountSec')}>
          <Row icon="key-outline" tone={C.gray} soft={C.graySoft} title={t('nav.changePassword')} right={<Icon name="chevron-forward" size={18} color="#94a3b8" />} onPress={() => nav.navigate('ChangePassword')} />
          <Row
            icon="log-out-outline"
            tone={C.red}
            soft={C.redSoft}
            title={t('nav.signOut')}
            onPress={() =>
              Alert.alert(t('mb.signOutAsk'), '', [
                { text: t('c.cancel'), style: 'cancel' },
                { text: t('nav.signOut'), style: 'destructive', onPress: () => logout() },
              ])
            }
            last
          />
        </Group>

        <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 12.5 }}>
          {t('app.name')} · {t('mb.version', { v: Constants.expoConfig?.version ?? '' })}
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: C.brandSoft, paddingHorizontal: 18, paddingBottom: 46, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  avatarRing: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 21, fontWeight: '800', color: C.ink },
  rolePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 5, maxWidth: '100%' },
  statsCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  statNum: { fontSize: 24, fontWeight: '800' },
  statLabel: { color: C.sub, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  sep: { width: 1, backgroundColor: C.line, marginVertical: 6 },
  groupTitle: { color: C.sub, fontSize: 12.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 6 },
  group: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  ico: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: C.ink, fontWeight: '700', fontSize: 15.5 },
  rowSub: { color: C.sub, fontSize: 12.5, lineHeight: 17 },
});
