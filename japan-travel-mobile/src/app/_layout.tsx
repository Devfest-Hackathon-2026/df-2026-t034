import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppIcon } from '@/components/app-icon';
import { colors } from '@/lib/theme';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageProvider, useLanguage } from '@/components/language-provider';
export default function RootLayout() { return <LanguageProvider><AppNavigator /></LanguageProvider>; }
function AppNavigator() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return <>
    <StatusBar style="dark" />
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text,
      headerTitleAlign: 'left', headerTitleStyle: { fontSize: 24, fontWeight: '600' }, headerShadowVisible: false,
      sceneStyle: { backgroundColor: colors.background },
      tabBarActiveTintColor: colors.action, tabBarInactiveTintColor: colors.secondary,
      tabBarStyle: { height: Math.max(62, 48 + Math.ceil(12 * fontScale)) + insets.bottom, backgroundColor: colors.card, borderTopColor: colors.border, elevation: 0, boxShadow: 'none' },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '500' }, tabBarItemStyle: { paddingVertical: 4, minHeight: 54 },
    }}>
      <Tabs.Screen name="index" options={{ title: t('发现'), tabBarIcon: ({ color }) => <AppIcon name="discover" color={color} /> }} />
      <Tabs.Screen name="planner" options={{ title: t('AI 规划'), headerShown: false, tabBarIcon: ({ color }) => <AppIcon name="chat" color={color} /> }} />
      <Tabs.Screen name="trips" options={{ title: t('行程'), tabBarIcon: ({ color }) => <AppIcon name="map" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: t('设置'), tabBarIcon: ({ color }) => <AppIcon name="settings" color={color} /> }} />
    </Tabs>
  </>;
}
