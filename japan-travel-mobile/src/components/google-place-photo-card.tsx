import { UiPressable as Pressable, UiText as Text, UiImage as Image } from '@/components/ui';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { GooglePlacePhoto } from '@/lib/google-place-photos';
import { colors } from '@/lib/theme';

export function GooglePlacePhotoCard({ photo, onReady, onError }: {
  photo: GooglePlacePhoto; onReady: () => void; onError: () => void;
}) {
  const [loaded, setLoaded] = useState(false); const [displayed, setDisplayed] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const ready = loaded && displayed;
  useEffect(() => { if (ready) onReady(); }, [ready, onReady]);
  async function open(url: string) {
    setLinkError(false);
    try { await Linking.openURL(url); } catch { setLinkError(true); }
  }
  return <View style={!ready && styles.pending}>
    <Image source={{ uri: photo.url }} style={styles.image} contentFit="contain" cachePolicy="none"
      accessibilityLabel={photo.name + '实景照片，来自 Google Maps'}
      onDisplay={() => setDisplayed(true)} onError={onError}
      onLoad={({ source }) => { if (source.width < 800 || source.height < 500) onError(); else setLoaded(true); }} />
    {ready && <View style={styles.credits}>
      <Pressable accessibilityRole="link" accessibilityLabel="在 Google Maps 查看地点"
        onPress={() => { void open(photo.mapsUri); }} style={styles.link}>
        <Text style={styles.google}>Google Maps</Text>
      </Pressable>
      {photo.authors.map((author, index) => author.uri ?
        <Pressable key={index} accessibilityRole="link" accessibilityLabel={'照片作者：' + author.displayName}
          onPress={() => { void open(author.uri!); }} style={styles.link}><Text style={styles.author}>{author.displayName}</Text></Pressable> :
        <Text key={index} style={styles.author}>{author.displayName}</Text>)}
      <View style={styles.policyLinks}>
        <Pressable accessibilityRole="link" onPress={() => { void open(photo.termsUrl); }} style={styles.link}><Text style={styles.policy}>使用条款</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => { void open(photo.privacyUrl); }} style={styles.link}><Text style={styles.policy}>隐私政策</Text></Pressable>
      </View>
      {linkError && <Text style={styles.policy} accessibilityRole="alert">暂时无法打开链接，请检查网络后重试。</Text>}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 1.55, borderRadius: 16 }, pending: { opacity: 0 },
  credits: { paddingTop: 6, gap: 2 },
  link: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, maxWidth: '100%' },
  google: { color: '#1F1F1F', fontSize: 13, lineHeight: 20, fontWeight: '400' },
  author: { color: colors.secondary, fontSize: 13, lineHeight: 21 },
  policyLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, policy: { color: colors.secondary, fontSize: 12, lineHeight: 20 },
});
