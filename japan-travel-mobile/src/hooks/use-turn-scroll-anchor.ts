import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, Platform, ScrollView } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { turnScrollOffset } from '@/lib/chat-turns';

export function useTurnScrollAnchor(latestTurnId: string | undefined) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef(new Map<string, number>());
  const currentTurn = useRef<string | undefined>(undefined);
  const pending = useRef<string | undefined>(undefined);
  const keyboardVisible = useRef(false);
  const frame = useRef<number | null>(null);
  const keyboardFallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const viewport = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const contentHeight = useRef(0);
  const scrollOffset = useRef(0);
  const followBottom = useRef(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const reduceMotion = useReducedMotion();

  const cancelAnchor = useCallback(() => {
    pending.current = undefined;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const scheduleAnchor = useCallback(() => {
    if (!pending.current || (Platform.OS !== 'ios' && keyboardVisible.current) || !viewport.current || !positions.current.has(pending.current)) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    // Let the new bubble reach native layout. On iOS the scroll and keyboard
    // transitions can run together.
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const id = pending.current;
        if (!id || (Platform.OS !== 'ios' && keyboardVisible.current)) return;
        const y = positions.current.get(id);
        if (y === undefined) return;
        pending.current = undefined;
        ref.current?.scrollTo({ y: turnScrollOffset(y), animated: !reduceMotion });
      });
    });
  }, [reduceMotion]);

  useEffect(() => {
    currentTurn.current = latestTurnId;
    cancelAnchor();
    followBottom.current = false;
    if (!latestTurnId) {
      positions.current.clear();
      scrollOffset.current = 0;
      ref.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    pending.current = latestTurnId;
    scheduleAnchor();
  }, [latestTurnId, cancelAnchor, scheduleAnchor]);

  useEffect(() => {
    keyboardVisible.current = Keyboard.isVisible();
    const show = Keyboard.addListener('keyboardDidShow', () => { keyboardVisible.current = true; });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisible.current = false;
      clearTimeout(keyboardFallback.current);
      scheduleAnchor();
    });
    return () => {
      show.remove(); hide.remove();
      clearTimeout(keyboardFallback.current);
      cancelAnchor();
    };
  }, [cancelAnchor, scheduleAnchor]);

  function dismissKeyboard() {
    keyboardVisible.current = Keyboard.isVisible();
    Keyboard.dismiss();
    if (Platform.OS !== 'ios' && keyboardVisible.current) {
      clearTimeout(keyboardFallback.current);
      // Some native/hardware keyboard combinations omit keyboardDidHide.
      keyboardFallback.current = setTimeout(() => {
        keyboardVisible.current = false;
        scheduleAnchor();
      }, 500);
    }
  }

  function onLayout(event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height;
    viewport.current = height;
    setViewportHeight(height);
    scheduleAnchor();
    if (followBottom.current) ref.current?.scrollToEnd({ animated: false });
    updateBottomButton();
  }

  function updateBottomButton() {
    setShowJumpToBottom(Boolean(viewport.current) && contentHeight.current - viewport.current - Math.max(0, scrollOffset.current) > 80);
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    updateBottomButton();
  }

  function onContentSizeChange(_width: number, height: number) {
    contentHeight.current = height;
    scheduleAnchor();
    if (followBottom.current) ref.current?.scrollToEnd({ animated: false });
    updateBottomButton();
  }

  function onScrollBeginDrag() {
    followBottom.current = false;
    cancelAnchor();
  }

  function jumpToBottom() {
    cancelAnchor();
    followBottom.current = true;
    ref.current?.scrollToEnd({ animated: !reduceMotion });
  }

  function measureTurn(id: string, y: number) {
    positions.current.set(id, y);
    scheduleAnchor();
  }

  function anchorLatestTurn() {
    followBottom.current = false;
    pending.current = currentTurn.current;
    scheduleAnchor();
  }

  return {
    ref, viewportHeight, onLayout, measureTurn, dismissKeyboard, anchorLatestTurn,
    showJumpToBottom, onScroll, onContentSizeChange, onScrollBeginDrag, jumpToBottom,
  };
}
