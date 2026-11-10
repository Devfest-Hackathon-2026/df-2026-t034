import Constants from 'expo-constants';
import { LanguagePicker, useLanguage } from '@/components/language-provider';
import { languages } from '@/lib/i18n/core';
import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon } from '@/components/app-icon';
import { getPhotoCredits, subscribePhotoCredits } from '@/lib/photo-credits';
import { colors } from '@/lib/theme';
export default function SettingsScreen() {
  const { language } = useLanguage();
  const [languageOpen, setLanguageOpen] = useState(false);
  const credits = useSyncExternalStore(subscribePhotoCredits, getPhotoCredits, getPhotoCredits);
  const [expanded, setExpanded] = useState(false);
  const [linkError, setLinkError] = useState('');
  async function openSource(url: string) {
    setLinkError('');
    try { await Linking.openURL(url); } catch { setLinkError('暂时无法打开来源链接，请检查网络后重试。'); }
  }
  return <><LanguagePicker visible={languageOpen} onClose={() => setLanguageOpen(false)} /><ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.sectionLabel}>偏好</Text>
    <View style={styles.group}>
    <Pressable accessibilityRole="button" accessibilityLabel="界面语言" onPress={() => setLanguageOpen(true)} style={styles.row}>
      <AppIcon name="globe" size={21} />
      <Text style={styles.rowLabel}>界面语言</Text><Text raw style={styles.value}>{languages.find(item => item.code === language)?.name}</Text><AppIcon name="chevron" size={17} />
    </Pressable>
    </View>
    <Text style={[styles.sectionLabel, styles.sectionSpacing]}>使用指南</Text>
    <View style={styles.group}>
      <SettingsDisclosure label="使用帮助" icon="chat">
        <Text style={styles.helpTitle}>怎样开始规划？</Text><Text style={styles.note}>告诉 AI 目的地、天数和预算，也可以说明特别想去的景点。信息不足时，助手会先询问。</Text>
        <Text style={styles.helpTitle}>怎样保存和修改？</Text><Text style={styles.note}>在完整回复下点“保存到行程”。保存后可查看每天安排、修改日期和准备事项，也可从行程菜单回到 AI 继续讨论。</Text>
        <Text style={styles.helpTitle}>在哪里完成预订？</Text><Text style={styles.note}>预订入口会打开对应网站。价格、可用日期和票种以网站为准；完成后手动勾选，助手不会自动同步订单。</Text>
      </SettingsDisclosure>
      <SettingsDisclosure label="数据说明" icon="history">
        <Text style={styles.helpTitle}>记录保存在这台设备</Text><Text style={styles.note}>聊天记录和已保存行程目前保存在当前设备，不会自动跨设备同步。卸载应用或更换设备可能丢失本机记录。</Text>
        <Text style={styles.helpTitle}>发送给 AI 的内容</Text><Text style={styles.note}>发送消息时，会将本次请求所需的对话内容交给团队 AI 服务处理。使用者无需提供自己的 Gemini 密钥。</Text>
        <Text style={styles.helpTitle}>聊天和行程分别管理</Text><Text style={styles.note}>删除聊天不会自动删除已保存的行程；它们可在各自页面单独管理。切换语言不会自动翻译旧记录。</Text>
      </SettingsDisclosure>
    </View>
    <Text style={[styles.sectionLabel, styles.sectionSpacing]}>关于</Text>
    <View style={styles.group}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
      onPress={() => setExpanded(!expanded)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}>
      <AppIcon name="photo" size={21} /><Text style={styles.rowLabel}>图片来源与授权</Text>
      <AppIcon name={expanded ? 'close' : 'chevron'} size={17} color={colors.secondary} />
    </Pressable>
    {expanded && <View style={styles.credits}>
      <Text style={styles.note}>Wikimedia 照片的作者、许可与来源见下方，图片按版面裁切。Google Places 照片的署名与条款会紧邻照片展示。</Text>
      {credits.length === 0 && <Text style={styles.note}>查看资料照片后，来源会显示在这里。</Text>}
      {credits.map((photo) => <View key={photo.source} style={styles.credit}>
        <Text raw selectable style={styles.photoName}>{photo.name}</Text>
        <Text raw selectable style={styles.creditText}>{photo.credit}</Text>
        <Text selectable style={styles.note}>{photo.license} · 已按版面裁切</Text>
        <Pressable accessibilityRole="link" accessibilityLabel={'查看' + photo.name + '的原始图片来源'}
          onPress={() => { void openSource(photo.source); }} style={styles.source}>
          <Text style={styles.sourceText}>查看原始来源</Text><AppIcon name="external" size={16} />
        </Pressable>
      </View>)}
      {linkError ? <Text accessibilityRole="alert" style={styles.error}>{linkError}</Text> : null}
    </View>}
    <SettingsDisclosure label="版本信息" icon="globe">
      <View style={styles.versionRow}><Text style={styles.note}>当前版本</Text><Text raw style={styles.value}>{Constants.expoConfig?.version ?? '—'}</Text></View>
      <Text style={styles.note}>当前支持日本旅行规划。预算是参考估算，价格、营业时间与预约规则请以实际预订网站及官方信息为准。</Text>
    </SettingsDisclosure>
    <View style={styles.row}><Text style={styles.rowLabel}>日本旅行助手</Text><Text style={styles.value}>比赛展示版</Text></View>
    </View>
    <Text style={styles.footer}>DF Hack26 · 一起，出发去日本</Text>
  </ScrollView></>;
}
function SettingsDisclosure({ label, icon, children }: { label: string; icon: ComponentProps<typeof AppIcon>['name']; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.row}>
      <AppIcon name={icon} size={21} /><Text style={styles.rowLabel}>{label}</Text><AppIcon name={open ? 'close' : 'chevron'} size={17} color={colors.secondary} />
    </Pressable>
    {open && <View style={styles.info}>{children}</View>}
  </>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  sectionLabel: { color: colors.secondary, fontSize: 12, lineHeight: 20, marginBottom: 8 }, sectionSpacing: { marginTop: 32 },
  group: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', minHeight: 60, paddingVertical: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  info: { gap: 9, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  helpTitle: { fontSize: 14, lineHeight: 23, color: colors.text, fontWeight: '500', marginTop: 4 },
  versionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 23 }, value: { color: colors.secondary, fontSize: 14, lineHeight: 23, flexShrink: 1 },
  credits: { gap: 16, paddingTop: 16, paddingBottom: 8 }, credit: { gap: 6, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  photoName: { fontSize: 15, lineHeight: 24, fontWeight: '600', color: colors.text }, creditText: { fontSize: 14, lineHeight: 23, color: colors.text },
  note: { fontSize: 13, lineHeight: 22, color: colors.secondary },
  source: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, sourceText: { fontSize: 13, lineHeight: 20, color: colors.text, textDecorationLine: 'underline' },
  footer: { color: colors.secondary, fontSize: 12, lineHeight: 20, marginTop: 36, textAlign: 'center' }, error: { color: colors.error, fontSize: 13, lineHeight: 22 },
});
