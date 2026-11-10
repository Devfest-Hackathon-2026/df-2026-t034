import { useLanguage } from '@/components/language-provider';
import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { Alert, FlatList, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { conversationPreview, conversationTitle, type PlannerConversation } from '@/lib/planner-history';
import { colors } from '@/lib/theme';

export function PlannerHistoryPanel({ visible, items, activeId, busy, error, onClose, onSelect, onDelete, onNew }: {
  visible: boolean; items: PlannerConversation[]; activeId: string; busy: boolean; error: string | null;
  onClose: () => void; onSelect: (item: PlannerConversation) => void; onDelete: (id: string) => void; onNew: () => void;
}) {
  const { t, intl } = useLanguage();
  const { width } = useWindowDimensions(); const insets = useSafeAreaInsets();
  function remove(item: PlannerConversation) {
    Alert.alert(t('删除这段对话？'), t('只删除当前设备上的记录，删除后无法恢复。'), [
      { text: t('取消'), style: 'cancel' },
      { text: t('删除'), style: 'destructive', onPress: () => onDelete(item.id) },
    ]);
  }
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭聊天历史" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View accessibilityViewIsModal style={[styles.panel, { width: Math.min(360, width * 0.88), paddingTop: insets.top + 14, paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>聊天历史</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.action}><Text style={styles.secondary}>关闭</Text></Pressable>
        </View>
        <Text style={styles.note}>对话保存在这台设备，照片可按需加载。</Text>
        {busy && <Text style={styles.note}>当前回复完成后可切换对话。</Text>}
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <FlatList data={items} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.secondary}>还没有聊天记录</Text><Text style={styles.note}>开始对话后会自动保存。</Text></View>}
          renderItem={({ item }) => <View style={[styles.item, item.id === activeId && styles.selected]}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: item.id === activeId, disabled: busy }} disabled={busy}
              onPress={() => { onSelect(item); onClose(); }} style={styles.conversation}>
              <Text raw numberOfLines={2} style={[styles.itemTitle, item.id === activeId && styles.activeTitle]}>{conversationTitle(item)}</Text>
              <Text raw numberOfLines={2} style={styles.preview}>{conversationPreview(item)}</Text>
              <Text style={styles.date}>{new Date(item.updatedAt).toLocaleString(intl, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={'删除对话：' + conversationTitle(item)} disabled={busy} onPress={() => remove(item)} style={styles.action}>
              <Text style={styles.deleteLabel}>删除</Text>
            </Pressable>
          </View>} />
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { onNew(); onClose(); }} style={[styles.newButton, busy && styles.disabled]}><Text style={styles.newLabel}>新对话</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }, panel: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { flex: 1, color: colors.text, fontSize: 21, fontWeight: '600' },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  secondary: { color: colors.secondary, fontSize: 15 }, note: { color: colors.secondary, fontSize: 12, lineHeight: 20, marginBottom: 12 },
  list: { paddingVertical: 8, gap: 8 }, empty: { paddingVertical: 44, gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', borderRadius: 12 }, selected: { backgroundColor: colors.surface },
  conversation: { flex: 1, padding: 12, gap: 6, minHeight: 80 }, itemTitle: { color: colors.text, fontSize: 15, lineHeight: 23 }, activeTitle: { fontWeight: '600' },
  preview: { color: colors.secondary, fontSize: 13, lineHeight: 20 }, date: { color: colors.secondary, fontSize: 11, lineHeight: 18 }, deleteLabel: { color: colors.secondary, fontSize: 12 },
  newButton: { backgroundColor: colors.action, padding: 14, minHeight: 48, borderRadius: 12, alignItems: 'center' }, newLabel: { color: colors.onAction, fontSize: 15, fontWeight: '600' }, disabled: { backgroundColor: colors.disabled, opacity: 0.65 },
  error: { color: colors.error, fontSize: 12, lineHeight: 20, marginBottom: 10 },
});
