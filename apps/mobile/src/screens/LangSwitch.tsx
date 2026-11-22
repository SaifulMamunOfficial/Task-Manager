import { View } from 'react-native';
import { useI18n } from '../i18n';
import { Chip } from '../ui';

/** English / বাংলা switch. */
export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
      <Chip label="বাংলা" on={lang === 'bn'} onPress={() => lang !== 'bn' && setLang('bn')} />
      <Chip label="English" on={lang === 'en'} onPress={() => lang !== 'en' && setLang('en')} />
    </View>
  );
}
