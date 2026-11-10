import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLanguagePreference, getLanguage, intlLanguage, languages, publishLanguage, subscribeLanguage, translate, type Language } from '@/lib/i18n/core';
import { colors } from '@/lib/theme';
import { AppIcon } from './app-icon';
const storageKey = 'japan-travel.language.v1';
const preference = createLanguagePreference({ read: () => AsyncStorage.getItem(storageKey), write: value => AsyncStorage.setItem(storageKey, value) });
const Context = createContext({ language: 'zh' as Language, ready: false, hasChoice: false, busy: false, error: '', choose: async (_value: Language) => false });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'zh' as Language);
  const [ready, setReady] = useState(false), [hasChoice, setChoice] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let active = true; void preference.load().then(value => { if (!active) return; if (value) { publishLanguage(value); setChoice(true); } }).catch(() => { if (active) setError('未能读取语言设置，请重新选择。'); }).finally(() => { if (active) setReady(true); }); return () => { active = false; }; }, []);
  async function choose(value: Language) {
    setBusy(true); setError('');
    try { await preference.save(value); setChoice(true); return true; } catch { setError('未能保存语言设置，请重试。'); return false; }
    finally { setBusy(false); }
  }
  return <Context.Provider value={{ language, ready, hasChoice, busy, error, choose }}>
    {!ready ? <View style={s.loading}><ActivityIndicator color={colors.text} /><Text>Loading · 読み込み中</Text></View> : !hasChoice ? <LanguageChoices first /> : children}
  </Context.Provider>;
}
export function useLanguage() {
  const context = useContext(Context);
  return { ...context, intl: intlLanguage(context.language), t: (value: string, params?: readonly (string | number)[]) => translate(value, context.language, params) };
}
function LanguageChoices({ first = false, onDone }: { first?: boolean; onDone?: () => void }) {
  const { language, t, choose, busy, error } = useLanguage();
  return <ScrollView contentContainerStyle={s.content}>
    <View style={s.heading}><AppIcon name="globe" size={30} /><Text style={s.title}>{first ? '选择语言\nChoose your language\n言語を選択' : t('界面语言')}</Text><Text style={s.note}>{first ? '之后可在设置中更改。\nYou can change this in Settings.\n後から設定で変更できます。' : t('界面和新 AI 回复将使用所选语言。已有聊天和行程保留原文。')}</Text></View>
    {languages.map(item => <Pressable key={item.code} accessibilityRole="button" accessibilityLabel={item.name} accessibilityState={{ selected: !first && language === item.code, disabled: busy }} disabled={busy}
      onPress={() => { void choose(item.code).then(saved => { if (saved) onDone?.(); }); }} style={({ pressed }) => [s.choice, pressed && { opacity: 0.6 }]}>
      <Text style={s.name}>{item.name}</Text>{!first && language === item.code && <AppIcon name="check" size={20} />}
    </Pressable>)}
    {busy && <ActivityIndicator color={colors.text} />}{!!error && <Text accessibilityRole="alert" style={s.error}>{t(error)}</Text>}
    {!first && <Pressable accessibilityRole="button" onPress={onDone} disabled={busy} style={s.cancel}><Text style={s.name}>{t('关闭')}</Text></Pressable>}
  </ScrollView>;
}
export function LanguagePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><LanguageChoices onDone={onClose} /></Modal>;
}
const s = StyleSheet.create({ loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: colors.background }, content: { flexGrow: 1, padding: 24, paddingTop: 64, paddingBottom: 40, gap: 14, backgroundColor: colors.background }, heading: { gap: 20, marginBottom: 24 }, title: { color: colors.text, fontSize: 26, fontWeight: '600', lineHeight: 38 }, note: { color: colors.secondary, fontSize: 14, lineHeight: 24 }, choice: { minHeight: 64, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, name: { fontSize: 17, lineHeight: 26, color: colors.text }, cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, error: { color: colors.error, fontSize: 14, lineHeight: 24 } });
