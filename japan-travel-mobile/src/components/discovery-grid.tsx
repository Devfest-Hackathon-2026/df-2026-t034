import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { DiscoveryPlace } from '@/lib/discovery';
import { discoveryCover } from '@/lib/discovery-covers';
import { colors, layout } from '@/lib/theme';
import { DiscoveryCoverPhoto } from './discovery-cover-photo';

// The feed is entirely local: no session bootstrap, Places or Gemini request.
export function DiscoveryGrid({ places, onOpen }: { places: DiscoveryPlace[]; onOpen: (place: DiscoveryPlace) => void }) {
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 340 || fontScale > 1.25;
  return <View style={styles.grid}>
    {places.map(place => {
      const cover = discoveryCover(place);
      return <View key={place.id} style={[styles.card, { width: singleColumn ? '100%' : '48.5%' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`查看${place.name}详情`} onPress={() => onOpen(place)} style={({ pressed }) => [styles.content, pressed && styles.pressed]}>
          <DiscoveryCoverPhoto cover={cover} name={place.name} rounded={false} tall />
          <View style={styles.info}>
            <View style={styles.destination}><Text style={styles.city}>{place.region}{place.region !== place.city ? ` · ${place.city}` : ''}</Text></View>
            <Text raw numberOfLines={2} style={styles.name}>{place.name}</Text>
          </View>
        </Pressable>
        {cover && <Text style={styles.credit}>图：<Text raw>{cover.photo.credit}</Text> · <Text raw>{cover.photo.license}</Text> · 裁剪展示，来源见详情</Text>}
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 }, card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: layout.cardRadius, overflow: 'hidden' }, content: { gap: 0 }, info: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6, gap: 5 }, pressed: { opacity: 0.7 },
  destination: { alignSelf: 'flex-start', backgroundColor: colors.selected, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  city: { color: colors.selectedText, fontSize: 11, lineHeight: 17 }, name: { color: colors.text, fontSize: 18, lineHeight: 26, fontWeight: '600' },
  credit: { paddingHorizontal: 10, paddingBottom: 12, color: colors.secondary, fontSize: 11, lineHeight: 17 },
});
