import { UiActivityIndicator as ActivityIndicator, UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Linking, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { discoveryMapUrl, type DiscoveryPlace } from '@/lib/discovery';
import { discoveryCover } from '@/lib/discovery-covers';
import { createDiscoveryPhotoLoader, type DiscoveryPhotoResult } from '@/lib/discovery-photo-loader';
import { requestGooglePhoto } from '@/lib/google-photo-client';
import { sharedChatSession } from '@/lib/chat-session-storage';
import { colors } from '@/lib/theme';
import { AppIcon } from './app-icon';
import { DiscoveryCoverPhoto } from './discovery-cover-photo';
import { GooglePlacePhotoCard } from './google-place-photo-card';

export function DiscoveryPlaceDetail({ place, onClose }: { place: DiscoveryPlace; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const cover = useMemo(() => discoveryCover(place), [place]);
  const [loading, setLoading] = useState(false); const [result, setResult] = useState<DiscoveryPhotoResult | null>(null);
  const [linkError, setLinkError] = useState(''); const [imageFailed, setImageFailed] = useState(false);
  const mounted = useRef(false);
  const [loader] = useState(() => createDiscoveryPhotoLoader(place, {
    connect: async () => { if (process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE === 'shared') await sharedChatSession().connect(); },
    load: requestGooglePhoto,
  }));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loader.cancel(); }; }, [loader]);
  async function open(url: string) {
    setLinkError('');
    try { await Linking.openURL(url); } catch { setLinkError('暂时无法打开链接，请检查网络后重试。'); }
  }
  async function morePhotos() {
    if (loading) return;
    setLoading(true);
    const next = await loader.request();
    if (!mounted.current) return;
    if (next) { setResult(next); setImageFailed(false); }
    setLoading(false);
  }
  function discuss() {
    onClose();
    router.navigate(place.conversationId ? { pathname: '/planner', params: { historyId: place.conversationId } } :
      { pathname: '/planner', params: { discoverySearch: `${place.city}的${place.name}，我想了解这里，帮我看看适合怎样安排。` } });
  }
  const photoNotice = result?.limitReached ? '今天的图片测试额度已用完，资料照片与介绍仍可查看。'
    : result && !result.enabled ? '实景查询服务暂未开启。'
    : result?.stop ? '这次未能连接照片服务，可以稍后手动重试。'
    : imageFailed ? '这张实景照片未能显示，资料图与介绍仍可查看。'
    : result && !result.photo ? '暂未找到匹配且适合展示的实景照片。' : '';
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <View accessibilityViewIsModal style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回发现" onPress={onClose} style={styles.back}><Text style={styles.backLabel}>返回发现</Text></Pressable>
        <Text accessibilityRole="header" style={styles.toolbarTitle}>景点详情</Text><View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <DiscoveryCoverPhoto cover={cover} name={place.name} large />
        <View style={styles.content}>
          {cover && <View style={styles.credits}>
            <Text style={styles.credit}>{cover.photo.name} · 资料照片{cover.photo.capturedYear ? ` · 拍摄于${cover.photo.capturedYear}年` : ''}</Text>
            <Text style={styles.credit}>摄影：<Text raw>{cover.photo.credit}</Text> · 卡片按版面裁剪，详情保留完整画面</Text>
            <View style={styles.links}>
              <Pressable accessibilityRole="link" onPress={() => { void open(cover.photo.source); }} style={styles.link}><Text style={styles.linkText}>原始图片来源</Text></Pressable>
              <Pressable accessibilityRole="link" accessibilityLabel={`查看图片许可${cover.photo.license}`} onPress={() => { void open(cover.licenseUrl); }} style={styles.link}><Text style={styles.linkText}>{cover.photo.license}</Text></Pressable>
            </View>
          </View>}
          <Text style={styles.location}>{place.region}{place.region !== place.city ? ` · ${place.city}` : ''}</Text>
          <Text raw accessibilityRole="header" style={styles.title}>{place.name}</Text>
          <View style={styles.reason}><Text style={styles.reasonText}>{place.reason || `来自你最近关于${place.region}的 AI 对话`}</Text></View>
          <Text style={styles.sectionTitle}>{place.origin === 'collection' ? '认识这个地方' : 'AI 对话中的介绍'}</Text>
          <Text raw={Boolean(place.description) && place.origin !== 'collection'} selectable style={styles.body}>{place.description || '原对话没有单独的景点介绍，你可以查看下方安排，或继续向 AI 了解这个地方。'}</Text>
          {place.schedule && <View style={styles.schedule}>
            <Text style={styles.sectionTitle}>原方案 · Day {place.schedule.day}</Text>
            <Text raw style={styles.body}>{place.schedule.title}</Text>
            {place.schedule.items.map((item, index) => <View key={`${index}-${item}`} style={styles.scheduleRow}><Text style={styles.order}>{index + 1}</Text><Text raw selectable style={[styles.body, styles.rowText]}>{item}</Text></View>)}
          </View>}
          <View style={styles.actions}>
            <Pressable accessibilityRole="link" onPress={() => { void open(discoveryMapUrl(place)); }} style={styles.mapButton}><AppIcon name="map" size={19} /><Text style={styles.mapLabel}>在地图查看</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={discuss} style={styles.discussButton}><Text style={styles.discussLabel}>{place.conversationId ? '继续和 AI 讨论' : '和 AI 聊聊这里'}</Text></Pressable>
          </View>
          <View style={styles.more}>
            <Text style={styles.sectionTitle}>更多景点实景</Text>
            <Text style={styles.note}>仅点击下方按钮时查询 Google Places，使用现有图片测试额度。普通浏览上方资料图和介绍无需查图。</Text>
            {!result?.photo && <Pressable accessibilityRole="button" accessibilityLabel="查看更多实景，使用图片测试额度" disabled={loading || result?.limitReached || result?.enabled === false}
              onPress={() => { void morePhotos(); }} style={[styles.moreButton, (loading || result?.limitReached || result?.enabled === false) && styles.disabled]}>
              {loading && <ActivityIndicator color={colors.secondary} size="small" />}<Text style={styles.mapLabel}>{loading ? '正在查找实景…' : result ? '手动重试实景查询' : '查看更多实景'}</Text>
            </Pressable>}
            {!!photoNotice && <Text accessibilityRole="alert" style={styles.note}>{photoNotice}</Text>}
            {result?.photo && !imageFailed && <GooglePlacePhotoCard photo={result.photo} onReady={() => undefined} onError={() => setImageFailed(true)} />}
          </View>
          {!!linkError && <Text accessibilityRole="alert" style={styles.error}>{linkError}</Text>}
          <Text style={styles.note}>地点介绍和原方案不代表实时票价、营业时间或班次，出行前请核对。</Text>
        </View>
      </ScrollView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  back: { width: 86, minHeight: 44, justifyContent: 'center' }, backLabel: { color: colors.text, fontSize: 14 }, toolbarTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 18 }, credits: { gap: 4, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }, credit: { color: colors.secondary, fontSize: 12, lineHeight: 20 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 }, link: { minHeight: 44, justifyContent: 'center' }, linkText: { color: colors.secondary, textDecorationLine: 'underline', fontSize: 12, lineHeight: 20 },
  location: { color: colors.secondary, fontSize: 13, lineHeight: 21 }, title: { color: colors.text, fontSize: 28, lineHeight: 39, fontWeight: '600' },
  reason: { padding: 12, backgroundColor: colors.surface, borderRadius: 12 }, reasonText: { color: colors.secondary, fontSize: 13, lineHeight: 22 },
  sectionTitle: { color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: '600' }, body: { color: colors.text, fontSize: 15, lineHeight: 28 },
  schedule: { gap: 12 }, scheduleRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, order: { color: colors.secondary, fontSize: 13, paddingTop: 4, minWidth: 18 }, rowText: { flex: 1 },
  actions: { gap: 12 }, mapButton: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' }, mapLabel: { color: colors.text, fontSize: 14, lineHeight: 22 },
  discussButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.action, borderRadius: 12, padding: 12 }, discussLabel: { color: colors.onAction, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  more: { marginVertical: 10, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 }, note: { color: colors.secondary, fontSize: 12, lineHeight: 21 },
  moreButton: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }, disabled: { opacity: 0.5 }, error: { color: colors.error, fontSize: 13, lineHeight: 22 },
});
