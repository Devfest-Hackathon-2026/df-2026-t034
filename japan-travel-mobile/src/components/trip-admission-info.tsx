import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { AdmissionEvidence } from '@/lib/trip-admission';
import { colors } from '@/lib/theme';
import { AppIcon } from './app-icon';
import { tripViewStyles as s } from './trip-view-styles';

/** Official admission facts are optional details, not another booking action. */
export function TripAdmissionInfo({ evidence, initiallyExpanded = false }: { evidence: AdmissionEvidence; initiallyExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function open(url: string) {
    if (busy || !evidence.sources.some(source => source.url === url)) return;
    setBusy(true); setError('');
    try { await WebBrowser.openBrowserAsync(url, { toolbarColor: colors.background, controlsColor: colors.text }); }
    catch { setError('官方页面暂时未能打开，请稍后再试。'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${evidence.label}，查看官方依据`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={[s.row, { minHeight: 44, alignSelf: 'flex-start' }]}>
      <Text style={s.note}>{evidence.label}</Text><AppIcon name={expanded ? 'close' : 'chevron'} size={16} color={colors.secondary} />
    </Pressable>
    {expanded && <View style={{ gap: 8 }}>
      <Text selectable style={s.note}>{evidence.scope}。{evidence.note}</Text>
      <Text style={s.note}>官方资料核对：{evidence.checkedAt} · 非实时库存</Text>
      {evidence.sources.map(source => <Pressable key={source.url} accessibilityRole="link" disabled={busy} onPress={() => { void open(source.url); }} style={s.link}><Text style={s.linkText}>{source.label}</Text></Pressable>)}
      {!!error && <Text accessibilityRole="alert" style={s.note}>{error}</Text>}
    </View>}
  </View>;
}
