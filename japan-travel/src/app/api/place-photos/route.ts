import { createPlacePhotosHandler } from '@/lib/server/place-photos';
import { sharedAccessFromEnvironment } from '@/lib/server/shared-firestore';

export const POST = createPlacePhotosHandler({
  configuration: () => ({
    enabled: process.env.PLACES_PHOTOS_ENABLED === 'true', apiKey: process.env.GOOGLE_PLACES_API_KEY,
    termsUrl: process.env.PLACES_TERMS_URL, privacyUrl: process.env.PLACES_PRIVACY_URL,
    accessMode: process.env.CHAT_ACCESS_MODE, publicOrigin: process.env.CHAT_PUBLIC_ORIGIN,
    isDevelopment: process.env.NODE_ENV === 'development',
  }),
  access: sharedAccessFromEnvironment,
});
