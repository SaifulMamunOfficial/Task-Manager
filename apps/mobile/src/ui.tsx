import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from './i18n';

export const C = {
  bg: '#f4f5fa',
  card: '#ffffff',
  ink: '#0f172a',
  sub: '#64748b',
  line: '#e8ebf2',
  brand: '#4f46e5',
  brandDark: '#3730a3',
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

/** Soft card shadow used across the app. */
export const SH = { shadowColor: '#0f172a', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 } as const;

export type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 18, color = C.sub }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

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
/** Colour for a status (used for the accent strip on task cards). */
export const statusColor = (status: string) => TONE[STATUS_TONE[status] ?? 'gray'][0];

export function StatusPill({ status }: { status: string }) {
  const { statusLabel } = useI18n();
  const [fg, bg] = TONE[STATUS_TONE[status] ?? 'gray'];
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
      <Text style={[s.pillText, { color: fg }]}>{statusLabel(status)}</Text>
    </View>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.brand, fontSize: size * 0.4, fontWeight: '800' }}>{initials}</Text>
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

export function Btn({ label, onPress, kind = 'default', disabled, busy, style, icon, compact }: { label: string; onPress: () => void; kind?: 'primary' | 'default' | 'danger'; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle>; icon?: IconName; compact?: boolean }) {
  const bg = kind === 'primary' ? C.brand : kind === 'danger' ? C.redSoft : C.card;
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? C.red : C.ink;
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [s.btn, compact && { minHeight: 34, paddingHorizontal: 14, borderRadius: 10 }, { backgroundColor: bg, borderColor: kind === 'primary' ? C.brand : kind === 'danger' ? '#fecaca' : C.line, opacity: off ? 0.5 : pressed ? 0.88 : 1 }, kind === 'primary' && SH, style]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!!icon && <Icon name={icon} size={18} color={fg} />}
          <Text style={[s.btnText, compact && { fontSize: 13.5 }, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Round floating action button (bottom right). */
export function Fab({ label, onPress, icon = 'add' }: { label: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.fab, SH, { opacity: pressed ? 0.9 : 1 }]}>
      <Icon name={icon} size={24} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{label}</Text>
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
  return <View style={[s.card, SH, style]}>{children}</View>;
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function Field(props: ComponentProps<typeof TextInput> & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {!!label && <Label>{label}</Label>}
      <TextInput placeholderTextColor="#94a3b8" {...rest} style={[s.input, rest.multiline && { minHeight: 100, textAlignVertical: 'top' }, style]} />
    </View>
  );
}

export function Empty({ title, text, icon = 'checkmark-done-circle-outline' }: { title: string; text?: string; icon?: IconName }) {
  return (
    <View style={{ padding: 36, alignItems: 'center', gap: 10 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={34} color={C.brand} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink, textAlign: 'center' }}>{title}</Text>
      {!!text && <Text style={{ color: C.sub, textAlign: 'center', lineHeight: 21 }}>{text}</Text>}
    </View>
  );
}

export function ErrorText({ msg }: { msg?: string }) {
  return msg ? (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.redSoft, borderRadius: 12, padding: 12 }} accessibilityRole="alert">
      <Icon name="alert-circle" size={18} color={C.red} />
      <Text style={{ color: C.red, fontSize: 14, flex: 1 }}>{msg}</Text>
    </View>
  ) : null;
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, on && { backgroundColor: C.brand, borderColor: C.brand }]}>
      <Text style={{ color: on ? '#fff' : C.ink, fontWeight: '700', fontSize: 14 }}>{label}</Text>
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
        <View style={[s.card, { gap: 12, borderRadius: 20 }]}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{title}</Text>
          {!!hint && <Text style={{ color: C.sub, lineHeight: 21 }}>{hint}</Text>}
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
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 12.5, fontWeight: '700' },
  bar: { height: 7, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden', flex: 1 },
  btn: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '800' },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16 },
  label: { fontSize: 12.5, fontWeight: '800', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#dbe0ea', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.ink, backgroundColor: '#f8fafc' },
  chip: { paddingHorizontal: 15, minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.5)', justifyContent: 'center', padding: 20 },
  fab: { position: 'absolute', right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.brand, paddingHorizontal: 20, height: 54, borderRadius: 27 },
});
