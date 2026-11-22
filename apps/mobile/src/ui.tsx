import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useI18n } from './i18n';

export const C = {
  bg: '#f3f4f8',
  card: '#ffffff',
  ink: '#0f172a',
  sub: '#64748b',
  line: '#e2e8f0',
  brand: '#4f46e5',
  brandSoft: '#eef2ff',
  red: '#dc2626',
  redSoft: '#fef2f2',
  amber: '#b45309',
  amberSoft: '#fffbeb',
  green: '#15803d',
  greenSoft: '#f0fdf4',
  blue: '#1d4ed8',
  blueSoft: '#eff6ff',
  gray: '#475569',
  graySoft: '#f1f5f9',
};

const TONE: Record<string, [string, string]> = {
  amber: [C.amber, C.amberSoft],
  blue: [C.blue, C.blueSoft],
  red: [C.red, C.redSoft],
  green: [C.green, C.greenSoft],
  gray: [C.gray, C.graySoft],
};
const STATUS_TONE: Record<string, string> = {
  PENDING_ACCEPTANCE: 'amber', ACCEPTED: 'blue', IN_PROGRESS: 'blue', BLOCKED: 'red', SUBMITTED: 'amber', APPROVED: 'green', DECLINED: 'red', CANCELLED: 'gray',
};

export function StatusPill({ status }: { status: string }) {
  const { statusLabel } = useI18n();
  const [fg, bg] = TONE[STATUS_TONE[status] ?? 'gray'];
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color: fg }]}>{statusLabel(status)}</Text>
    </View>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.brand, fontSize: size * 0.4, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <View style={s.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: value >= 100 ? C.green : C.brand, borderRadius: 4 }} />
    </View>
  );
}

export function Btn({ label, onPress, kind = 'default', disabled, busy, style }: { label: string; onPress: () => void; kind?: 'primary' | 'default' | 'danger'; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = kind === 'primary' ? C.brand : kind === 'danger' ? C.redSoft : C.card;
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? C.red : C.ink;
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: kind === 'primary' ? C.brand : kind === 'danger' ? '#fecaca' : C.line, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

/** Lifts the content above the on-screen keyboard (Android does not resize the window by itself in newer builds). */
export function KeyboardView({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function Field(props: React.ComponentProps<typeof TextInput> & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {!!label && <Label>{label}</Label>}
      <TextInput placeholderTextColor="#94a3b8" {...rest} style={[s.input, rest.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]} />
    </View>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 6 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink, textAlign: 'center' }}>{title}</Text>
      {!!text && <Text style={{ color: C.sub, textAlign: 'center' }}>{text}</Text>}
    </View>
  );
}

export function ErrorText({ msg }: { msg?: string }) {
  return msg ? <Text style={{ color: C.red, fontSize: 14 }} accessibilityRole="alert">{msg}</Text> : null;
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, on && { backgroundColor: C.brand, borderColor: C.brand }]}>
      <Text style={{ color: on ? '#fff' : C.ink, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Ask for a reason (decline / send back). */
export function ReasonModal({ visible, title, hint, confirmLabel, danger, onConfirm, onClose }: { visible: boolean; title: string; hint?: string; confirmLabel: string; danger?: boolean; onConfirm: (reason: string) => Promise<void>; onClose: () => void }) {
  const { t, err } = useI18n();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    setBusy(true);
    setError('');
    try {
      await onConfirm(text.trim());
      setText('');
      onClose();
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior="padding">
        <View style={[s.card, { gap: 12 }]}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink }}>{title}</Text>
          {!!hint && <Text style={{ color: C.sub }}>{hint}</Text>}
          <Field value={text} onChangeText={setText} multiline autoFocus placeholder={t('rm.ph')} />
          <ErrorText msg={error} />
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <Btn label={t('c.cancel')} onPress={onClose} />
            <Btn label={confirmLabel} kind={danger ? 'danger' : 'primary'} busy={busy} disabled={!text.trim()} onPress={go} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 12.5, fontWeight: '700' },
  bar: { height: 6, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden', flex: 1 },
  btn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 16 },
  label: { fontSize: 13, fontWeight: '700', color: C.sub },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.ink, backgroundColor: '#fff' },
  chip: { paddingHorizontal: 14, minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.5)', justifyContent: 'center', padding: 20 },
});
