import { UiText as Text, UiImage as Image } from '@/components/ui';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { bundledPhotos } from '@/lib/bundled-photo-assets';
import type { DiscoveryCover } from '@/lib/discovery-covers';
import { recordPhotoCredit } from '@/lib/photo-credits';
import { colors } from '@/lib/theme';
import { AppIcon } from './app-icon';
const sources: Record<string, number> = {
  ...bundledPhotos,
  discoveryOdori: require('../../assets/images/discovery/odori-park.jpg'),
  discoveryOtaru: require('../../assets/images/discovery/otaru-canal.jpg'),
  discoverySensoji: require('../../assets/images/discovery/sensoji.jpg'),
};
export function DiscoveryCoverPhoto({ cover, name, large = false, wide = false, rounded = true, tall = false }: { cover: DiscoveryCover | null; name: string; large?: boolean; wide?: boolean; rounded?: boolean; tall?: boolean }) {
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const failed = failedAsset === cover?.asset;
  useEffect(() => { if (cover) recordPhotoCredit(cover.photo); }, [cover]);
  return cover && sources[cover.asset] && !failed ?
    <Image source={sources[cover.asset]} contentFit={large ? 'contain' : 'cover'} cachePolicy="memory-disk"
      accessibilityLabel={`${name}资料照片，作者及许可见详情`} onError={() => setFailedAsset(cover.asset)} style={[styles.image, tall && styles.tall, large && styles.large, wide && styles.wide, !rounded && styles.flush]} /> :
    <View style={[styles.image, styles.placeholder, tall && styles.tall, large && styles.large, wide && styles.wide, !rounded && styles.flush]}><AppIcon name="photo" size={30} color={colors.secondary} /><Text style={styles.note}>资料图待补充</Text></View>;
}
const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: 14, backgroundColor: colors.surface },
  flush: { borderRadius: 0 },
  tall: { aspectRatio: 2 / 3 },
  wide: { aspectRatio: 2.2 },
  large: { aspectRatio: 1.4, borderRadius: 0 }, placeholder: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  note: { fontSize: 12, color: colors.secondary, lineHeight: 20 },
});
