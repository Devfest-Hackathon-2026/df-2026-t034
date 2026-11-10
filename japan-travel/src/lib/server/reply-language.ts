export type ReplyLanguage = 'zh' | 'en' | 'ja';
export function replyLanguage(value: string | null): ReplyLanguage { return value === 'en' || value === 'ja' ? value : 'zh'; }
export function replyLanguageInstruction(language: ReplyLanguage = 'zh', assessment = false): string {
  if (language === 'zh') return '';
  const target = language === 'en' ? 'English' : 'Japanese (polite, natural Japanese)';
  return `\nOUTPUT LANGUAGE: The user selected ${target} in the app. This overrides the default Chinese language and Chinese example prose above. ${assessment ? 'Write every question and assumption in the selected language. Keep action values and JSON property names unchanged.' : 'Write all explanations, follow-up questions, opening, day titles, descriptions, activities, summary and budget labels/scope in the selected language.'}
Keep exact Japanese place names unchanged, and include those same names in activities. Keep city/area identifiers in overview in their official Japanese form so photos and bookings match; do not translate schema property names. For text itineraries only, preserve these internal format markers exactly: 行程规划, 行程详情, 当日安排, 活动｜, 小结, 预算对比, 币种｜, 人数｜, 范围｜, 第1–2天：. The app localizes these markers; never translate or omit them. Do not add a language notice or change the requested itinerary, dates, travelers, currency or budget. Default currency remains JPY unless the user explicitly requests another.`;
}
