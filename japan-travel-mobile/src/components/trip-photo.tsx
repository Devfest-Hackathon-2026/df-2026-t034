import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { discoveryCover, type DiscoveryCover } from '@/lib/discovery-covers';
import { DiscoveryCoverPhoto } from './discovery-cover-photo';
import { TripSheet, tripStyles } from './trip-controls';
import { tripViewStyles as s } from './trip-view-styles';

// Local licensed artwork only; this component never connects to the photo API.
export function TripPhoto({ name, city, cover: provided }: { name: string; city?: string; cover?: DiscoveryCover }) {
  const cover = provided ?? discoveryCover({ name, city: city ?? '' });
  if (!cover) return null;
  return <View style={{ gap: 3 }}>
    <DiscoveryCoverPhoto cover={cover} name={name} wide />
    <TripPhotoCredits cover={cover} name={name} />
  </View>;
}
export function TripPhotoCredits({ cover, name, showAuthor = false }: { cover: DiscoveryCover; name: string; showAuthor?: boolean }) {
  const [credits, setCredits] = useState(false), [error, setError] = useState('');
  async function open(url: string) { try { await Linking.openURL(url); } catch { setError('暂时无法打开来源，请稍后重试。'); } }
  return <View style={{ gap: 3 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`查看${name}资料照片的作者与许可`} onPress={() => setCredits(true)} style={[s.row, { minHeight: 44, flexWrap: 'wrap', gap: 6 }]}>
      <Text style={[s.note, s.grow]}>{showAuthor ? <>图：<Text raw>{cover.photo.credit}</Text> · <Text raw>{cover.photo.license}</Text></> : <>资料照片{cover.photo.capturedYear ? ` · ${cover.photo.capturedYear}年` : ''}</>}</Text><Text style={s.note}>署名与许可 ›</Text>
    </Pressable>
    {credits && <TripSheet title="照片来源与许可" onClose={() => setCredits(false)}>
      <DiscoveryCoverPhoto cover={cover} name={name} large />
      <Text style={s.section}>{cover.photo.name}</Text><Text selectable style={s.body}>摄影：{cover.photo.credit}</Text>
      <Text style={s.body}>许可：{cover.photo.license}</Text><Text style={s.note}>资料照片{cover.photo.capturedYear ? `拍摄于${cover.photo.capturedYear}年` : ''}，不代表当前景色。行程卡片按版面裁剪，上方保留完整画面。</Text>
      <Pressable accessibilityRole="link" onPress={() => { void open(cover.photo.source); }} style={s.link}><Text style={s.linkText}>查看原始图片来源 ↗</Text></Pressable>
      <Pressable accessibilityRole="link" onPress={() => { void open(cover.licenseUrl); }} style={s.link}><Text style={s.linkText}>查看完整许可 ↗</Text></Pressable>
      {!!error && <Text accessibilityRole="alert" style={tripStyles.error}>{error}</Text>}
    </TripSheet>}
  </View>;
}
