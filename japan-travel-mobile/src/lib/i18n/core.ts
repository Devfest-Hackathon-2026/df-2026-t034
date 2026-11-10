import { messages } from './messages.ts';
export type Language = 'zh' | 'en' | 'ja';
export const languages = [{ code: 'zh', name: '简体中文' }, { code: 'en', name: 'English' }, { code: 'ja', name: '日本語' }] as const;
export const isLanguage = (value: unknown): value is Language => value === 'zh' || value === 'en' || value === 'ja';
export const intlLanguage = (language: Language) => ({ zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' })[language];
let current: Language = 'zh';
const listeners = new Set<() => void>();
export const getLanguage = () => current;
export const subscribeLanguage = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function publishLanguage(language: Language) { if (current !== language) { current = language; listeners.forEach(listener => listener()); } }
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.keys(messages).filter(key => /\{\d+\}/.test(key)).sort((a, b) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length).map(key => {
  const ids: string[] = []; let previous = 0, expression = '^';
  for (const match of key.matchAll(/\{(\d+)\}/g)) {
    const end = match.index! + match[0].length;
    // Counts and years must not swallow the preceding date, title or party label.
    const numeric = /^\s*(?:天|人|项|年|晚)/.test(key.slice(end));
    expression += escape(key.slice(previous, match.index)) + (numeric ? '(\\d+)' : '([\\s\\S]*?)');
    ids.push(match[1]); previous = end;
  }
  return { key, ids, expression: new RegExp(expression + escape(key.slice(previous)) + '$') };
});
export function translate(value: string, language: Language = current, params?: readonly (string | number)[], depth = 0): string {
  const fill = (result: string) => params ? result.replace(/\{(\d+)\}/g, (_, index: string) => String(params[Number(index)] ?? '')) : result;
  if (language === 'zh') return fill(value);
  const key = value.trim();
  const entry = Object.hasOwn(messages, key) ? messages[key] : undefined;
  let result = entry?.[language];
  if (result === undefined && depth < 3) {
    for (const pattern of patterns) {
      const match = pattern.expression.exec(key);
      if (match) {
        const slots = Object.fromEntries(pattern.ids.map((id, index) => [id, translate(match[index + 1], language, undefined, depth + 1)]));
        result = messages[pattern.key][language].replace(/\{(\d+)\}/g, (_, id: string) => slots[id] ?? '');
        break;
      }
    }
  }
  if (result === undefined) return fill(value);
  return fill(value.slice(0, value.indexOf(key)) + result + value.slice(value.indexOf(key) + key.length));
}
export type LanguageStorage = { read: () => Promise<string | null>; write: (value: string) => Promise<void> };
export function createLanguagePreference(storage: LanguageStorage) {
  let busy = false;
  return {
    async load() { const value = await storage.read(); return isLanguage(value) ? value : null; },
    async save(value: Language) {
      if (!isLanguage(value)) throw Error('Unsupported language');
      if (busy) throw Error('Language change in progress');
      busy = true;
      try { await storage.write(value); publishLanguage(value); } finally { busy = false; }
    },
  };
}

export function localizePlanOutline(value: string, language: Language = current) {
  if (language === 'zh') return value;
  return value.replace(/^第\s*(\d+)(?:\s*[–—-]\s*(\d+))?\s*天[：:]\s*(.*)$/gm, (_, first: string, last: string, area: string) => language === 'en' ? `Day ${first}${last ? `–${last}` : ''}: ${translate(area, language)}` : `${first}${last ? `～${last}` : ''}日目：${area}`);
}

// Fixed timing hints from the itinerary format are UI boilerplate, not a translation of user prose.
export function localizeTimingHints(value: string, language: Language = current) {
  if (language === 'zh') return value;
  return value.replace(/建议晚上去，适合看夜景|建议傍晚去，适合看日落与夜景/g, hint => translate(hint, language));
}
