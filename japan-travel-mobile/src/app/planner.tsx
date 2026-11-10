import { useLanguage } from '@/components/language-provider';
import { UiActivityIndicator as ActivityIndicator, UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/app-icon';
import { colors } from '@/lib/theme';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { usePlannerChat } from '@/hooks/use-planner-chat';
import { MAX_MESSAGE_LENGTH } from '@/lib/chat';
import { CHAT_VERTICAL_PADDING, groupChatTurns, minimumTurnHeight } from '@/lib/chat-turns';
import { useTurnScrollAnchor } from '@/hooks/use-turn-scroll-anchor';
import { useChatAccess } from '@/hooks/use-chat-access';
import { AssistantMessage } from '@/components/assistant-message';
import { PlannerInput } from '@/components/planner-input';
import { PlannerKeyboardView } from '@/components/planner-keyboard-view';
import type { PlannerInputRef } from '@/components/planner-input.types';
import { PlannerHistoryPanel } from '@/components/planner-history-panel';
import { SaveTripButton } from '@/components/save-trip-button';
import { savedTrips } from '@/lib/saved-trips-storage';
import { tripContext } from '@/lib/saved-trips';

const suggestions = ['东京三天，动漫与美食', '两个人的京都，慢慢逛'];
const sentMessage = FadeInDown.duration(300).easing(Easing.out(Easing.cubic));
const firstMessage = FadeInDown.duration(300).easing(Easing.out(Easing.cubic))
  .withInitialValues({ opacity: 0, transform: [{ translateY: 96 }] });

export default function PlannerScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const access = useChatAccess();
  const chat = usePlannerChat({ authorization: access.authorization, onAuthError: access.onAuthError });
  const [historyOpen, setHistoryOpen] = useState(false);
  const turns = groupChatTurns(chat.messages);
  const latestTurnId = turns.at(-1)?.id;
  const {
    ref: scrollRef, viewportHeight, onLayout: onChatLayout, measureTurn,
    dismissKeyboard, anchorLatestTurn, onContentSizeChange, onScroll, onScrollBeginDrag, showJumpToBottom, jumpToBottom,
  } = useTurnScrollAnchor(latestTurnId);
  const inputRef = useRef<PlannerInputRef>(null);
  const busy = chat.isSending || Boolean(chat.revealingId) || chat.historyUpdating;
  const { historyId, discoverySearch, continueTripId } = useLocalSearchParams<{ historyId?: string; discoverySearch?: string; continueTripId?: string }>();
  const [tripIntentError, setTripIntentError] = useState('');
  const missingHistory = typeof historyId === 'string' && chat.historyReady && !chat.savedConversations.some(item => item.id === historyId);
  const handledIntent = useRef('');
  useEffect(() => {
    const id = typeof historyId === 'string' ? historyId : '';
    const search = typeof discoverySearch === 'string' ? discoverySearch.slice(0, 200).trim() : '';
    const intent = id || search;
    if (!intent) { handledIntent.current = ''; return; }
    if (!chat.historyReady || busy || handledIntent.current === intent) return;
    handledIntent.current = intent;
    if (id) {
      const saved = chat.savedConversations.find(item => item.id === id);
      if (saved) chat.selectConversation(saved);
      else return;
    } else chat.startNewConversation(search);
    router.setParams({ historyId: undefined, discoverySearch: undefined });
  }, [historyId, discoverySearch, chat, busy]);
  useEffect(() => {
    if (typeof continueTripId !== 'string' || !chat.historyReady || busy) return;
    let cancelled = false;
    void savedTrips.load().then(items => {
      if (cancelled) return;
      const trip = items.find(item => item.id === continueTripId);
      if (trip) { chat.startNewConversation(tripContext(trip)); setTripIntentError(''); }
      else setTripIntentError('这份行程已不在本机，请从行程页重新选择。');
      router.setParams({ continueTripId: undefined });
    }).catch(() => {
      if (cancelled) return;
      setTripIntentError('未能读取保存的方案，请回到行程页重试。'); router.setParams({ continueTripId: undefined });
    });
    return () => { cancelled = true; };
  }, [continueTripId, chat, busy]);
  const canSend = access.ready && chat.historyReady && Boolean(chat.input.trim()) && !busy && !chat.hasFailedMessage;
  function dismissComposer() { inputRef.current?.blur(); dismissKeyboard(); }
  function sendMessage() {
    if (!canSend) return;
    dismissComposer();
    chat.send();
  }

  return (
    <View style={styles.screen}>
      <PlannerKeyboardView composer={
        <View style={styles.composer}>
          <View style={styles.inputRow}>
            <PlannerInput
              ref={inputRef} value={chat.input} reset={chat.inputReset} onChangeText={chat.setInput}
              onFocus={() => undefined} editable={access.ready && chat.historyReady && !chat.historyUpdating && !chat.hasFailedMessage}
            />
            <Pressable
              accessibilityRole="button" accessibilityLabel="发送消息"
              accessibilityState={{ disabled: !canSend, busy }}
              disabled={!canSend} onPress={sendMessage}
              style={({ pressed }) => [styles.sendButton, !canSend && styles.sendDisabled, pressed && styles.pressed]}>
              <AppIcon name="arrow" size={23} color={colors.onAction} />
            </Pressable>
          </View>
          <Text style={styles.composerNote}>{chat.input.length > 3500 ? `${chat.input.length} / ${MAX_MESSAGE_LENGTH} 字` : '票价、营业时间等信息，请在出行前确认。'}</Text>
        </View>
      }>
        <View style={[styles.toolbar, { paddingTop: insets.top + 10 }]}>
          <View style={styles.toolbarSide}>
            <Pressable accessibilityRole="button" accessibilityLabel="查看聊天历史" disabled={!chat.historyReady}
              onPress={() => { dismissComposer(); void chat.flushHistory().then(() => setHistoryOpen(true)); }}
              style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}>
              <AppIcon name="history" size={24} />
            </Pressable>
          </View>
          <Text accessibilityRole="header" style={styles.heading}>AI 规划</Text>
          <Pressable
            accessibilityRole="button" accessibilityLabel="开始新对话"
            disabled={busy || !chat.historyReady || (chat.messages.length === 0 && !chat.input.trim())}
            onPress={() => { dismissComposer(); chat.startNewConversation(); }}
            style={({ pressed }) => [styles.newChat, pressed && styles.pressed, (busy || (chat.messages.length === 0 && !chat.input.trim()) || !chat.historyReady) && styles.disabled]}>
            <Text style={[styles.newChatText, (busy || !chat.historyReady || (chat.messages.length === 0 && !chat.input.trim())) && { color: colors.disabledText }]}>新对话</Text>
          </Pressable>
        </View>
        <View style={styles.list}>
          <ScrollView
            ref={scrollRef} style={styles.list}
            contentContainerStyle={[styles.messages, chat.messages.length === 0 && styles.emptyList]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={false} automaticallyAdjustContentInsets={false}
            onContentSizeChange={onContentSizeChange} onLayout={onChatLayout}
            onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag} scrollEventThrottle={32}>
            {chat.messages.length === 0 && (
              <View style={styles.welcome}>
                <Text style={styles.eyebrow}>一起，出发去日本</Text>
                <Text accessibilityRole="header" style={styles.welcomeTitle}>这次，想去哪里？</Text>
                <Text style={styles.welcomeText}>说说目的地、天数和喜好，一起安排适合你的旅行。</Text>
                <View style={styles.suggestions}>
                  {suggestions.map((suggestion) => (
                    <Pressable key={suggestion} accessibilityRole="button"
                      accessibilityLabel={`发送：${suggestion}`}
                      disabled={!access.ready || !chat.historyReady || chat.isSending}
                      onPress={() => { dismissComposer(); chat.sendText(t(suggestion)); }}
                      style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                      <AppIcon name="diagonal" size={19} />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {turns.map((turn) => (
              <View key={turn.id}
                onLayout={(event) => measureTurn(turn.id, event.nativeEvent.layout.y)}
                style={[styles.turn, turn.id === latestTurnId && { minHeight: minimumTurnHeight(viewportHeight) }]}>
                <Animated.View entering={turn.id === latestTurnId && chat.isSending ? (turns.length === 1 ? firstMessage : sentMessage) : undefined} style={[styles.messageRow, styles.userRow]}>
                  <View style={[styles.bubble, styles.userBubble]}>
                    <Text raw selectable style={[styles.messageText, styles.userText]}>{turn.user.content}</Text>
                  </View>
                  {turn.user.id === chat.failedMessageId && <Text style={styles.failedLabel}>未完成，请重试或编辑消息</Text>}
                </Animated.View>
                {turn.assistant && <View style={styles.messageRow}>
                  <View style={[styles.bubble, styles.assistantBubble]}>
                    <AssistantMessage content={turn.assistant.content} userMessage={turn.user.content} revealing={turn.assistant.id === chat.revealingId} onRevealComplete={chat.finishReveal}
                      loadPhotosInitially={!chat.restoredMessageIds.has(turn.assistant.id)} />
                    <SaveTripButton reply={turn.assistant.content} conversationId={chat.activeConversationId} messageId={turn.assistant.id} disabled={busy} />
                  </View>
                </View>}
                {turn.id === latestTurnId && chat.isSending && (
                  <View accessibilityLiveRegion="polite" style={styles.thinking}>
                    <ActivityIndicator size="small" color={colors.secondary} />
                    <Text style={styles.thinkingText}>正在规划您的行程</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          {latestTurnId && showJumpToBottom && (
            <Pressable
              accessibilityRole="button" accessibilityLabel="跳到聊天底部"
              onPress={jumpToBottom} style={({ pressed }) => [styles.jumpButton, pressed && styles.pressed]}>
              <AppIcon name="down" size={22} />
            </Pressable>
          )}
        </View>
        {(access.connecting || access.error) && (
          <View accessibilityLiveRegion="polite" style={styles.accessBox}>
            {access.connecting ? <View style={styles.thinking}><ActivityIndicator size="small" color={colors.secondary} /><Text style={styles.thinkingText}>正在连接旅行助手…</Text></View> : <>
              <Text style={styles.errorText}>{access.error}</Text>
              <Pressable accessibilityRole="button" onPress={access.reconnect} style={styles.errorAction}><Text style={styles.errorActionText}>重新连接</Text></Pressable>
            </>}
          </View>
        )}
        {chat.error && (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorBox}>
            <Text style={styles.errorText}>{chat.error.message}</Text>
            {chat.hasFailedMessage && (
              <View style={styles.errorActions}>
                <Pressable accessibilityRole="button" disabled={!access.ready} onPress={() => { dismissComposer(); anchorLatestTurn(); chat.retry(); }} style={styles.errorAction}>
                  <Text style={styles.errorActionText}>重试</Text>
                </Pressable>
                <Pressable accessibilityRole="button"
                  onPress={() => { chat.editFailedMessage(); inputRef.current?.focus(); }} style={styles.errorAction}>
                  <Text style={styles.errorActionText}>编辑消息</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        {!!tripIntentError && <Text accessibilityRole="alert" style={styles.historyWarning}>{tripIntentError}</Text>}
        {chat.historyError && <Text accessibilityRole="alert" style={styles.historyWarning}>{chat.historyError}</Text>}
        {missingHistory && <View style={styles.accessBox}>
          <Text accessibilityRole="alert" style={styles.errorText}>这段聊天记录已不在本机，可以开始一段新对话。</Text>
          <Pressable accessibilityRole="button" onPress={() => router.setParams({ historyId: undefined })} style={styles.errorAction}><Text style={styles.errorActionText}>关闭提示</Text></Pressable>
        </View>}
      </PlannerKeyboardView>
      <PlannerHistoryPanel visible={historyOpen} items={chat.savedConversations} activeId={chat.activeConversationId}
        busy={busy} error={chat.historyError} onClose={() => setHistoryOpen(false)} onSelect={chat.selectConversation}
        onDelete={id => { void chat.deleteConversation(id); }} onNew={chat.startNewConversation} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10, gap: 12, backgroundColor: colors.background },
  toolbarSide: { width: 80 }, historyButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, textAlign: 'center', fontSize: 24, lineHeight: 34, fontWeight: '600', color: colors.text },
  newChat: { width: 80, minHeight: 44, paddingHorizontal: 4, alignItems: 'flex-end', justifyContent: 'center' },
  historyWarning: { color: colors.error, fontSize: 12, lineHeight: 20, paddingHorizontal: 20, paddingBottom: 8 },
  newChatText: { color: colors.action, fontSize: 14, lineHeight: 22 },
  disabled: { opacity: 0.5 }, pressed: { opacity: 0.65 },
  list: { flex: 1 },
  jumpButton: {
    position: 'absolute', bottom: 12, alignSelf: 'center', width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  messages: { paddingHorizontal: 20, paddingVertical: CHAT_VERTICAL_PADDING, gap: 36 },
  turn: { gap: 28 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  welcome: { paddingVertical: 20, gap: 18, width: '100%', maxWidth: 560, alignSelf: 'center' },
  eyebrow: { color: colors.secondary, fontSize: 12, lineHeight: 20, letterSpacing: 2, marginBottom: 4 },
  welcomeTitle: { color: colors.text, fontSize: 30, lineHeight: 42, fontWeight: '600' },
  welcomeText: { color: colors.secondary, fontSize: 16, lineHeight: 28, maxWidth: 350 },
  suggestions: { gap: 12, marginTop: 16 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16, borderRadius: 14 },
  suggestionText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 24 },
  messageRow: { alignItems: 'flex-start', gap: 6 }, userRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '94%', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 },
  userBubble: { backgroundColor: colors.surface },
  assistantBubble: { width: '100%', maxWidth: '100%', minHeight: 42, paddingHorizontal: 0, paddingVertical: 4, borderRadius: 0 },
  messageText: { color: colors.text, fontSize: 16, lineHeight: 26 }, userText: { color: colors.text },
  failedLabel: { fontSize: 12, lineHeight: 20, color: colors.error },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingVertical: 8 },
  thinkingText: { flexShrink: 1, color: colors.secondary, fontSize: 14, lineHeight: 22 },
  errorBox: { marginHorizontal: 20, marginBottom: 10, backgroundColor: colors.errorSurface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  accessBox: { marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: colors.surface, gap: 8 },
  errorText: { fontSize: 14, lineHeight: 22, color: colors.error },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 }, errorAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  errorActionText: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: colors.text },
  composer: { backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 8, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  sendButton: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.action, borderRadius: 12 },
  sendDisabled: { backgroundColor: colors.disabled },
  composerNote: { fontSize: 11, lineHeight: 18, color: colors.secondary, textAlign: 'center' },
});
