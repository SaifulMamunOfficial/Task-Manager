import { useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Btn, C, Card, ErrorText, Field, Icon, SH } from '../ui';
import { LangSwitch } from './LangSwitch';

export default function Login() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const { t, err } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go() {
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior="padding">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, paddingTop: 20 + insets.top, paddingBottom: 20 + insets.bottom, gap: 22 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Image source={require('../../assets/icon.png')} style={[{ width: 76, height: 76, borderRadius: 22 }, SH]} accessibilityLabel={t('app.name')} />
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>{t('app.name')}</Text>
          <Text style={{ color: C.sub, textAlign: 'center', lineHeight: 22 }}>{t('login.tag')}</Text>
        </View>
        <Card style={{ gap: 14, padding: 20, borderRadius: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>{t('login.title')}</Text>
          <Field label={t('login.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" />
          <View>
            <Field label={t('login.password')} value={password} onChangeText={setPassword} secureTextEntry={!show} textContentType="password" autoComplete="password" onSubmitEditing={go} returnKeyType="go" style={{ paddingRight: 48 }} />
            <Text
              onPress={() => setShow(!show)}
              accessibilityRole="button"
              style={{ position: 'absolute', right: 14, bottom: 14, color: C.brand, fontWeight: '800', fontSize: 13 }}
            >
              {show ? '●●●' : 'Aa'}
            </Text>
          </View>
          <ErrorText msg={error} />
          <Btn label={busy ? t('login.busy') : t('login.btn')} kind="primary" busy={busy} disabled={!email.trim() || !password} onPress={go} />
          <Text style={{ color: C.sub, fontSize: 13, textAlign: 'center' }}>{t('login.forgot')}</Text>
        </Card>
        <View style={{ alignItems: 'center' }}>
          <LangSwitch />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
