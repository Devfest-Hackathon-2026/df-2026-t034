import type { Ref } from 'react';

export type PlannerInputRef = { focus(): void; blur(): void };

export type PlannerInputProps = {
  ref?: Ref<PlannerInputRef>;
  value: string;
  // Changes only for intentional resets (send, new conversation, edit failed turn).
  reset: { value: string; revision: number };
  editable: boolean;
  onChangeText(text: string): void;
  onFocus(): void;
};
