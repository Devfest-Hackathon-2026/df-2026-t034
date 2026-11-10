import { colors } from '@/lib/theme';
import { useEffect, useRef, useState } from 'react';
import { UiImage as Image } from '@/components/ui';
import { StyleSheet } from 'react-native';
import { hasPhotoResolution, placePhotoUrls, rejectPlacePhoto, rememberPlacePhoto, type PlacePhoto } from '@/lib/place-photos';
import { recordPhotoCredit } from '@/lib/photo-credits';
import { bundledPhotos } from '@/lib/bundled-photo-assets';



export function PlacePhotoCard({ photo, onReady, onError }: { photo: PlacePhoto; onReady: () => void; onError: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [verifiedAttempt, setVerifiedAttempt] = useState<number | null>(null);
  const [displayedAttempt, setDisplayedAttempt] = useState<number | null>(null);
  const reportedAttempt = useRef<number | null>(null);
  const candidates = [photo, ...(photo.alternates ?? [])].flatMap((candidate) => [
    ...(candidate.bundled ? [{ photo: candidate, source: bundledPhotos[candidate.bundled] }] : []),
    ...placePhotoUrls(candidate).map((uri) => ({ photo: candidate, source: { uri } })),
  ]);
  const current = candidates[attempt];
  const ready = verifiedAttempt === attempt && displayedAttempt === attempt;
  useEffect(() => {
    if (ready && reportedAttempt.current !== attempt) {
      reportedAttempt.current = attempt;
      onReady();
    }
  }, [attempt, onReady, ready]);
  if (!current) return null;
  return (
    <Image key={attempt} source={current.source} style={[styles.image, !ready && styles.pending]} contentFit="cover" cachePolicy="memory-disk"
      allowDownscaling={false} accessibilityLabel={`${photo.name}，图片来源见设置中的图片来源`}
      onDisplay={() => setDisplayedAttempt(attempt)}
      onLoad={({ source }) => {
        if (!hasPhotoResolution(source.width, source.height)) {
          rejectPlacePhoto(current.photo);
          const next = candidates.findIndex((candidate, index) => index > attempt && candidate.photo.source !== current.photo.source);
          if (next >= 0) setAttempt(next);
          else onError();
          return;
        }
        setVerifiedAttempt(attempt);
        rememberPlacePhoto(current.photo);
        recordPhotoCredit(current.photo);
      }}
      onError={() => {
        if (attempt + 1 < candidates.length) setAttempt(attempt + 1);
        else onError();
      }} />
  );
}
const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 1.55, borderRadius: 16, backgroundColor: colors.surface },
  pending: { opacity: 0 },
});
