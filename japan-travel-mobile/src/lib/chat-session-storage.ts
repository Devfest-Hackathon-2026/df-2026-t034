import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createChatSession } from './shared-chat-session';

const storageKey = 'travel-chat-anonymous-session-v1';
let memory: string | null = null;
let client: ReturnType<typeof createChatSession> | undefined;
export function sharedChatSession() {
  if (!client) client = createChatSession({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    storage: {
      read: () => Platform.OS === 'web' ? Promise.resolve(memory) : SecureStore.getItemAsync(storageKey),
      write: async (value) => {
        memory = value;
        if (Platform.OS !== 'web') await SecureStore.setItemAsync(storageKey, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      },
      clear: async () => {
        memory = null;
        if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(storageKey);
      },
    },
  });
  return client;
}
