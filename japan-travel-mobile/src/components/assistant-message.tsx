import { useLanguage } from '@/components/language-provider';
import { localizePlanOutline, localizeTimingHints } from '@/lib/i18n/core';
import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { colors } from '@/lib/theme';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getPhotoReplyBlocks, getAssistantHighlights, getHighlightedSegments, getDayHeading, getBudgetEstimate, getBudgetRows, getScheduleRows, replyRevealProgress, type PhotoReplyBlock, type ReplyPhotoStop } from '@/lib/assistant-text';
import { loadReplyPhotos, photoTitle, type PlacePhoto } from '@/lib/place-photos';
import { reviewedPlacePhoto } from '@/lib/reviewed-place-photos';
import { PlacePhotoCard } from './place-photo-card';
import { googlePhotoQueries, type GooglePlacePhoto } from '@/lib/google-place-photos';
import { requestGooglePhoto } from '@/lib/google-photo-client';
import { GooglePlacePhotoCard } from './google-place-photo-card';
import { BudgetComparison } from './budget-comparison';

type ReplyPhoto = PlacePhoto | GooglePlacePhoto;
const isGooglePhoto = (photo: ReplyPhoto): photo is GooglePlacePhoto => 'provider' in photo && photo.provider === 'google-places';

export const AssistantMessage = memo(function AssistantMessage({ content, userMessage, revealing = false, onRevealComplete, loadPhotosInitially = true }: {
  content: string; userMessage: string; revealing?: boolean; onRevealComplete?: () => void; loadPhotosInitially?: boolean;
}) {
  const parsed = useMemo(() => getPhotoReplyBlocks(content), [content]);
  const highlights = useMemo(() => getAssistantHighlights(content, Infinity), [content]);
  const { total, timeline, stops, names } = useMemo(() => {
    let total = 0;
    const stops: ReplyPhotoStop[] = [];
    const timeline = parsed.map((block, index) => {
      const start = total;
      const day = getDayHeading(block.heading ?? '');
      let heading = block.heading ?? '';
      if (block.scheduleDay) heading = `Day ${block.scheduleDay} 安排`;
      else if (day && day.title !== `第${day.number}天`) heading = `Day ${day.number}｜${day.title}`;
      const length = Array.from(heading).length + Array.from(block.body).length;
      const photoNames = block.attraction ? [block.attraction] : block.dayPhotos ?? [];
      total += length;
      if (photoNames.length) stops.push({ index, end: total });
      return { block, start, length, heading, photoNames };
    });
    return { total, timeline, stops, names: timeline.flatMap((item) => item.photoNames) };
  }, [parsed]);
  const [photos, setPhotos] = useState(() => new Map<string, ReplyPhoto | null>());
  const [photoMode, setPhotoMode] = useState<'unknown' | 'google' | 'legacy' | 'unavailable'>('unknown');
  const [photoLimitReached, setPhotoLimitReached] = useState(false);
  const queries = useMemo(() => googlePhotoQueries(content, parsed), [content, parsed]);
  const [allLookupsFinished, setAllLookupsFinished] = useState(false);
  const [settledPhotos, setSettledPhotos] = useState(() => new Map<number, ReplyPhoto | null>());
  const [visible, setVisible] = useState(0);
  const [instant, setInstant] = useState(false);
  const [photosRequested, setPhotosRequested] = useState(loadPhotosInitially);
  const [copyState, setCopyState] = useState<'ready' | 'copying' | 'copied' | 'failed'>('ready');
  async function copyReply() {
    if (copyState === 'copying') return;
    setCopyState('copying');
    try {
      const copied = await Clipboard.setStringAsync(content);
      setCopyState(copied ? 'copied' : 'failed');
    } catch { setCopyState('failed'); }
  }
  const animeTrip = /动漫|二次元|アニメ|圣地巡礼|聖地巡礼|作品取景|游戏取景|女神异闻录|ペルソナ|Persona|\bP5[RX]?\b/i.test(`${userMessage}\n${content}`);
  const { limit, shown: progressShown, waitingIndex } = replyRevealProgress(photosRequested ? stops : [], settledPhotos, revealing && !instant ? visible : total, total);
  const shown = revealing ? progressShown : total;
  const waitingNames = waitingIndex === undefined ? undefined : timeline[waitingIndex].photoNames;
  const waitingPhoto = waitingNames?.map((name) => {
    if (photos.has(name)) return photos.get(name);
    if (photoMode !== 'legacy') return undefined;
    const reviewed = reviewedPlacePhoto(name, photoTitle(name));
    return reviewed?.verifiedOnly ? undefined : reviewed;
  }).find(Boolean);
  const waitingPhotoSource = waitingPhoto?.source;
  const lookupFinished = allLookupsFinished || waitingNames?.every((name) => photos.has(name));

  const settlePhoto = useCallback((index: number, photo: ReplyPhoto | null) => {
    setSettledPhotos((previous) => previous.has(index) ? previous : new Map(previous).set(index, photo));
  }, []);

  useEffect(() => {
    if (photoMode !== 'legacy') return;
    let active = true;
    const remoteNames = names.filter((name) => {
      const reviewed = reviewedPlacePhoto(name, photoTitle(name));
      return !/^(?:disney|universal|ginza)/.test(reviewed?.bundled ?? '');
    });
    void loadReplyPhotos(remoteNames, (photo) => {
      if (active) setPhotos((previous) => new Map(previous).set(photo.name, photo));
    }, () => active, animeTrip, (name) => {
      if (active) setPhotos((previous) => new Map(previous).set(name, null));
    }).finally(() => { if (active) setAllLookupsFinished(true); });
    return () => { active = false; };
  }, [names, animeTrip, photoMode]);

  useEffect(() => {
    if (photoMode === 'legacy' || waitingIndex === undefined || !waitingNames?.length || waitingNames.every((name) => photos.has(name))) return;
    if (photoMode === 'unavailable' || (photoMode === 'google' && !queries.has(waitingIndex))) {
      setPhotos((previous) => { const next = new Map(previous); waitingNames.forEach((name) => next.set(name, null)); return next; });
      return;
    }
    const controller = new AbortController();
    void requestGooglePhoto(queries.get(waitingIndex), controller.signal).then(({ enabled, photo, stop, limitReached }) => {
      if (controller.signal.aborted) return;
      if (!enabled) { setPhotoMode('legacy'); return; }
      if (limitReached) setPhotoLimitReached(true);
      setPhotoMode(stop ? 'unavailable' : 'google');
      setPhotos((previous) => {
        const next = new Map(previous);
        // The verified query can expand an ambiguous display name (薬王院)
        // into its full official name. Keep the image attached to this block.
        waitingNames.forEach((name, index) => next.set(name, index === 0 ? photo : null));
        return next;
      });
    });
    return () => controller.abort();
  }, [photoMode, waitingIndex, waitingNames, photos, queries]);

  useEffect(() => {
    if (!revealing) return;
    let active = true;
    void Promise.all([AccessibilityInfo.isReduceMotionEnabled(), AccessibilityInfo.isScreenReaderEnabled()]).then(([reduced, reader]) => {
      if (active && (reduced || reader)) setInstant(true);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [revealing]);

  useEffect(() => {
    if (!revealing || instant || shown >= limit) return;
    const step = Math.min(12, Math.max(3, Math.ceil(total / 400)));
    const timer = setTimeout(() => setVisible((previous) => Math.min(limit, previous + step)), 18);
    return () => clearTimeout(timer);
  }, [instant, limit, revealing, shown, total]);

  useEffect(() => {
    if (waitingIndex === undefined || !waitingPhotoSource) return;
    const timer = setTimeout(() => settlePhoto(waitingIndex, null), 7000);
    return () => clearTimeout(timer);
  }, [settlePhoto, waitingIndex, waitingPhotoSource]);

  useEffect(() => {
    if (!lookupFinished || waitingIndex === undefined || waitingPhoto) return;
    const timer = setTimeout(() => settlePhoto(waitingIndex, null), 0);
    return () => clearTimeout(timer);
  }, [lookupFinished, settlePhoto, waitingIndex, waitingPhoto]);

  useEffect(() => {
    if (revealing && shown >= total && waitingIndex === undefined) onRevealComplete?.();
  }, [onRevealComplete, revealing, shown, total, waitingIndex]);

  return (
    <View style={styles.blocks}>
      <View style={styles.replyActions}>
      {!photosRequested && names.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="联网加载这条历史回复的景点照片"
        onPress={() => setPhotosRequested(true)} style={({ pressed }) => [styles.copyButton, pressed && styles.copyPressed]}>
        <Text style={styles.copyLabel}>加载景点照片</Text>
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel="复制这条 AI 回复全文"
        accessibilityState={{ disabled: copyState === 'copying' }} disabled={copyState === 'copying'}
        onPress={() => { void copyReply(); }} style={({ pressed }) => [styles.copyButton, pressed && styles.copyPressed]}>
        <Text style={styles.copyLabel} accessibilityLiveRegion="polite">
          {copyState === 'copied' ? '已复制全文' : copyState === 'failed' ? '复制失败，点此重试' : copyState === 'copying' ? '正在复制…' : '复制全文'}
        </Text>
      </Pressable>
      </View>
      {timeline.map(({ block, start, length, heading }, index) => {
        const available = Math.min(length, shown - start);
        if (available <= 0) return null;
        if (block.photoOnly && settledPhotos.get(index) === null) return null;
        const photo = settledPhotos.get(index) ?? (waitingIndex === index && !settledPhotos.has(index) ? waitingPhoto : undefined);
        return (
          <View key={index} style={styles.block}>
            <ReplyBlock block={block} heading={heading} available={available} complete={available === length} highlights={highlights} />
            {photo && (isGooglePhoto(photo) ?
              <GooglePlacePhotoCard key={photo.source} photo={photo} onReady={() => settlePhoto(index, photo)} onError={() => settlePhoto(index, null)} /> :
              <PlacePhotoCard key={photo.source} photo={photo} onReady={() => settlePhoto(index, photo)} onError={() => settlePhoto(index, null)} />)}
          </View>
        );
      })}
      {photoMode === 'unavailable' && <Text style={styles.photoNotice}>
        {photoLimitReached ? '本次测试的图片额度已用完，文字行程仍可查看。' : '图片暂未能加载，文字行程仍可查看。'}
      </Text>}
    </View>
  );
});

const ReplyBlock = memo(function ReplyBlock({ block, heading, available, complete, highlights }: {
  block: PhotoReplyBlock; heading: string; available: number; complete: boolean; highlights: string[];
}) {
  const { language } = useLanguage();
  const headingChars = Array.from(heading);
  const shownHeading = headingChars.slice(0, available).join('');
  const body = Array.from(block.body).slice(0, Math.max(0, available - headingChars.length)).join('');
  function renderText(text: string) {
    return getHighlightedSegments(text, highlights).map((segment, index) => (
      <Text raw key={index} style={segment.bold ? styles.highlight : undefined}>{segment.text}</Text>
    ));
  }
  if (block.heading === '预算对比') {
    if (!complete) return null;
    const budget = getBudgetEstimate(block.body);
    return (
      <View style={styles.copy}>
        <Text style={styles.heading}>{heading}</Text>
        {budget ? <BudgetComparison budget={budget} /> : <Text style={styles.body}>这次的三档估算暂未生成完整。您可以请旅行助手再估算一次。</Text>}
      </View>
    );
  }
  const day = getDayHeading(block.heading ?? '');
  const rows = getBudgetRows(block.body);
  const schedule = getScheduleRows(block.body);
  const regularHeading = Boolean(day || block.scheduleDay || block.photoOnly || block.heading === '行程草案');
  const shownSchedule = schedule && (complete ? schedule : body.split('\n').flatMap((line) => getScheduleRows(line) ?? []));
  return (
    <View style={[styles.copy, day && styles.day]}>
      {shownHeading ? <Text raw={Boolean(block.attraction || (day && !block.scheduleDay))} selectable style={[styles.heading, regularHeading && styles.regularHeading, block.attraction && styles.placeHeading]}>{shownHeading}</Text> : null}
      {shownSchedule?.length ? <View>
        <View style={styles.budgetRow}>
          <Text style={[styles.scheduleActivity, styles.total]}>行程</Text>
        </View>
        {shownSchedule.map((row, rowIndex) => <View key={rowIndex} style={[styles.budgetRow, rowIndex === shownSchedule.length - 1 && styles.lastScheduleRow]}>
          <Text raw selectable style={styles.scheduleActivity}>{localizeTimingHints(row.value, language)}</Text>
        </View>)}
      </View> : rows && complete ? <View style={styles.budgetTable}>
        {rows.map((row) => <View key={row.label} style={styles.budgetRow}>
          <Text raw selectable style={styles.budgetLabel}>{row.label}</Text>
          <Text raw selectable style={[styles.budgetValue, /合计|总计/.test(row.label) && styles.total]}>{localizeTimingHints(row.value, language)}</Text>
        </View>)}
      </View> : body && !schedule ? <Text raw selectable style={[styles.body, block.attraction && styles.placeBody]}>{renderText(block.heading === '行程规划' ? localizePlanOutline(body, language) : rows ? body.replace(/[｜|]/g, '  ') : body)}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  replyActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  photoNotice: { color: colors.secondary, fontSize: 12, lineHeight: 20 },
  copyButton: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12 },
  copyPressed: { backgroundColor: colors.surface }, copyLabel: { color: colors.secondary, fontSize: 14, lineHeight: 22 },
  blocks: { gap: 28 }, block: { gap: 18 }, copy: { gap: 12 },
  placeHeading: { fontSize: 17, lineHeight: 27, fontWeight: '700' }, placeBody: { fontSize: 16, lineHeight: 27 },
  budgetTable: { gap: 0 }, budgetRow: { flexDirection: 'row', gap: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  budgetLabel: { flex: 0.85, color: colors.text, fontSize: 15, lineHeight: 25 }, budgetValue: { flex: 1.15, textAlign: 'right', color: colors.text, fontSize: 15, lineHeight: 25 }, total: { fontWeight: '700' },
  scheduleActivity: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 25 },
  day: { paddingTop: 20 },
  lastScheduleRow: { borderBottomWidth: 0 },
  heading: { color: colors.text, fontSize: 18, lineHeight: 29, fontWeight: '700' },
  regularHeading: { color: colors.text, fontWeight: '400' },
  body: { color: colors.text, fontSize: 17, lineHeight: 30 },
  highlight: { color: colors.text, fontWeight: '700' },
});
