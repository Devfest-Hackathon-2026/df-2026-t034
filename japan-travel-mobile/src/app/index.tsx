import { UiActivityIndicator as ActivityIndicator, UiPressable as Pressable, UiText as Text, UiTextInput as TextInput } from '@/components/ui';
import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon } from '@/components/app-icon';
import { PrimaryButton } from '@/components/primary-button';
import { DiscoveryGrid } from '@/components/discovery-grid';
import { DiscoveryPlaceDetail } from '@/components/discovery-place-detail';
import { discoveryFeed, filterDiscoveryPlaces, type DiscoveryPlace } from '@/lib/discovery';
import { plannerHistory } from '@/lib/planner-history-storage';
import { colors, layout } from '@/lib/theme';

export default function HomeScreen() {
  const [places, setPlaces] = useState<DiscoveryPlace[]>([]);
  const [selected, setSelected] = useState<DiscoveryPlace | null>(null); const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const [input, setInput] = useState(''); const [search, setSearch] = useState(''); const [region, setRegion] = useState(''); const [page, setPage] = useState(0);
  useFocusEffect(useCallback(() => {
    let mounted = true;
    void plannerHistory.load().then(history => {
      if (!mounted) return;
      const next = discoveryFeed(history);
      setPlaces(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      setRegion(current => next.some(place => place.region === current) ? current : ''); setError('');
    }).catch(() => { if (mounted) { setPlaces([]); setError('暂时无法读取本机聊天记录，请稍后重新进入发现。'); } })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []));
  const regions = useMemo(() => [...new Set(places.map(place => place.region))], [places]);
  const filtered = useMemo(() => filterDiscoveryPlaces(places, search, region), [places, search, region]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 4) - 1));
  const group = useMemo(() => filtered.slice(safePage * 4, safePage * 4 + 4), [filtered, safePage]);
  const recentRegion = places.find(place => place.origin === 'chat')?.region;
  function submit() { setSearch(input.trim()); setRegion(''); setPage(0); }
  function plan() { router.navigate(input.trim() ? { pathname: '/planner', params: { discoverySearch: input.trim().slice(0, 200) } } : '/planner'); }
  return <View style={styles.screen}><ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <View style={styles.search}>
      <AppIcon name="search" color={colors.secondary} size={20} />
      <TextInput accessibilityLabel="搜索城市或景点" placeholder="搜索城市、景点，比如北海道5天" placeholderTextColor={colors.secondary}
        value={input} onChangeText={setInput} maxLength={200} onSubmitEditing={submit} returnKeyType="search" style={styles.searchInput} />
      <Pressable accessibilityRole="button" accessibilityLabel="搜索推荐景点" onPress={submit} style={styles.searchButton}><Text style={styles.searchLabel}>搜索</Text></Pressable>
    </View>
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={styles.title}>{recentRegion ? `为你的${recentRegion}之旅，继续发现` : '你的下一站，渐渐清晰'}</Text>
    </View>
    {!!regions.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tags}>
      {['', ...regions].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === region }}
        onPress={() => { setRegion(value); setPage(0); }} style={[styles.tag, value === region && styles.tagSelected]}>
        <Text style={[styles.tagText, value === region && styles.tagTextSelected]}>{value || '为你推荐'}</Text>
      </Pressable>)}
    </ScrollView>}
    {search ? <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.heading}>{`“${search}”的相关地点`}</Text></View> : <View style={{ height: 14 }} />}
    {!ready ? <ActivityIndicator style={styles.loading} color={colors.secondary} /> : error ? <Text accessibilityRole="alert" style={styles.body}>{error}</Text> : group.length ? <>
      <DiscoveryGrid places={group} onOpen={setSelected} />
      {filtered.length > 4 && <View style={styles.paging}>
        <Pressable accessibilityRole="button" disabled={safePage === 0} onPress={() => setPage(safePage - 1)} style={[styles.pageButton, safePage === 0 && styles.disabled]}><Text style={styles.pageLabel}>上一组</Text></Pressable>
        <Text style={styles.caption}>{safePage + 1} / {Math.ceil(filtered.length / 4)}</Text>
        <Pressable accessibilityRole="button" disabled={(safePage + 1) * 4 >= filtered.length} onPress={() => setPage(safePage + 1)} style={[styles.pageButton, (safePage + 1) * 4 >= filtered.length && styles.disabled]}><Text style={styles.pageLabel}>下一组</Text></Pressable>
      </View>}
    </> : <View style={styles.empty}>
      <AppIcon name="discover" size={36} color={colors.secondary} />
      <Text style={styles.emptyTitle}>暂时没有匹配的地点</Text>
      <Text style={styles.emptyText}>这里可以搜索聊天推荐与已收录的精选地点，也可以把新想法带给 AI。</Text>
      <PrimaryButton label={input.trim() ? '带着这个想法去聊聊' : '和 AI 聊聊旅行'} onPress={plan} />
      {!!search && <Pressable accessibilityRole="button" onPress={() => { setInput(''); setSearch(''); setRegion(''); setPage(0); }} style={styles.pageButton}><Text style={styles.pageLabel}>查看全部推荐</Text></Pressable>}
    </View>}
    {!!places.length && <Text style={styles.privacy}>推荐参考本机聊天与精选资料。封面为可复用的授权资料照片，作者和许可见详情；删除聊天后会移除对应的聊天推荐。</Text>}
  </ScrollView>{selected && <DiscoveryPlaceDetail key={selected.id} place={selected} onClose={() => setSelected(null)} />}</View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: layout.discoveryPage, paddingTop: 12, paddingBottom: 32 },
  search: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingLeft: 14, paddingRight: 6, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  searchInput: { flex: 1, minWidth: 0, minHeight: 52, color: colors.text, fontSize: 14, lineHeight: 21 }, searchButton: { minHeight: 48, paddingHorizontal: 10, justifyContent: 'center' }, searchLabel: { color: colors.text, fontSize: 13 },
  intro: { gap: 10, marginTop: 20 },
  title: { color: colors.text, fontSize: 24, lineHeight: 34, fontWeight: '600' }, body: { color: colors.secondary, fontSize: 14, lineHeight: 23 },
  tags: { gap: 8, paddingTop: 14, paddingBottom: 2 }, tag: { backgroundColor: colors.card, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', borderRadius: layout.controlRadius, borderWidth: 1, borderColor: colors.border },
  tagSelected: { backgroundColor: colors.selected, borderColor: colors.selected }, tagText: { fontSize: 13, color: colors.secondary }, tagTextSelected: { color: colors.selectedText, fontWeight: '600' },
  sectionHeading: { marginTop: 18, marginBottom: 12 }, heading: { color: colors.secondary, fontSize: 13, lineHeight: 21, fontWeight: '500' }, caption: { fontSize: 12, color: colors.secondary, lineHeight: 20 }, loading: { marginVertical: 48 },
  empty: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 36, gap: 16 }, emptyTitle: { fontSize: 17, lineHeight: 25, fontWeight: '500', color: colors.text }, emptyText: { fontSize: 14, lineHeight: 24, color: colors.secondary, textAlign: 'center', marginBottom: 4 },
  paging: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, gap: 12 }, pageButton: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 12 }, pageLabel: { color: colors.text, fontSize: 13, lineHeight: 21 }, disabled: { opacity: 0.35 },
  privacy: { marginTop: 28, color: colors.secondary, fontSize: 12, lineHeight: 21 },
});
