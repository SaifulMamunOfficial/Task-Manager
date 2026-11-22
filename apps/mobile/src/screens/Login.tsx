import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Btn, C, Card, ErrorText, Field } from '../ui';
import { LangSwitch } from './LangSwitch';

export default function Login() {
  const { login } = useAuth();
  const { t, err } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>{t('app.name')}</Text>
          <Text style={{ color: C.sub, textAlign: 'center' }}>{t('login.tag')}</Text>
        </View>
        <Card style={{ gap: 14 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>{t('login.title')}</Text>
          <Text style={{ color: C.sub }}>{t('login.sub')}</Text>
          <Field label={t('login.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" />
          <Field label={t('login.password')} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="password" onSubmitEditing={go} returnKeyType="go" />
          <ErrorText msg={error} />
          <Btn label={busy ? t('login.busy') : t('login.btn')} kind="primary" busy={busy} disabled={!email.trim() || !password} onPress={go} />
          <Text style={{ color: C.sub, fontSize: 13 }}>{t('login.forgot')}</Text>
        </Card>
        <View style={{ alignItems: 'center' }}>
          <LangSwitch />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
