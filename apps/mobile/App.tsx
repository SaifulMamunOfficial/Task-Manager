import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';

// Use your computer's LAN IP when testing on a real phone, e.g. http://192.168.0.10:4000/api
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000/api';

type Me = { id: string; name: string; positions: { id: string; unit: { name: string }; position: { title: string } }[] };

async function call(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `HTTP ${res.status}`);
  return res.json();
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('at');
        if (token) setMe(await call('/auth/me', {}, token));
      } catch {
        await SecureStore.deleteItemAsync('at');
      }
      setBusy(false);
    })();
  }, []);

  async function login() {
    setError('');
    try {
      const r = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      await SecureStore.setItemAsync('at', r.accessToken);
      await SecureStore.setItemAsync('rt', r.refreshToken);
      setMe(r.user);
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (busy) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="auto" />
      {!me ? (
        <View style={s.card}>
          <Text style={s.h1}>Task Manager</Text>
          <TextInput style={s.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={s.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          <Button title="Sign in" onPress={login} />
          {!!error && <Text style={s.err}>{error}</Text>}
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.card}>
          <Text style={s.h1}>Hello, {me.name}</Text>
          {me.positions.map((p) => (
            <Text key={p.id}>{p.position.title}, {p.unit.name}</Text>
          ))}
          <Text style={{ color: '#666', marginTop: 12 }}>Foundation shell. Task screens come next.</Text>
          <Button title="Sign out" onPress={async () => { await SecureStore.deleteItemAsync('at'); await SecureStore.deleteItemAsync('rt'); setMe(null); }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f7f9', justifyContent: 'center' },
  card: { margin: 16, padding: 20, backgroundColor: '#fff', borderRadius: 12, gap: 12 },
  h1: { fontSize: 22, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  err: { color: '#b00020' },
});
