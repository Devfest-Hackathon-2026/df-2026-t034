import { useLanguage } from '@/components/language-provider';
import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { colors, layout } from '@/lib/theme';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BudgetEstimate } from '@/lib/assistant-text';

import { budgetTiers as tiers, type BudgetTier } from '@/lib/trip-budget';

export function BudgetComparison({ budget, selectedTier, onTierChange, disabled = false }: { budget: BudgetEstimate; selectedTier?: BudgetTier; onTierChange?: (tier: BudgetTier) => void; disabled?: boolean }) {
  const { intl } = useLanguage();
  const [localTier, setLocalTier] = useState<BudgetTier>(0);
  const selected = selectedTier ?? localTier;
  function select(tier: BudgetTier) { if (onTierChange) onTierChange(tier); else setLocalTier(tier); }
  const total = budget.items.reduce((sum, item) => sum + item.amounts[selected], 0);
  const format = (amount: number) => `¥${Math.round(amount).toLocaleString(intl)}`;
  return (
    <View style={styles.card}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {tiers.map((tier, index) => (
          <Pressable key={tier} accessibilityRole="tab" disabled={disabled} accessibilityState={{ selected: selected === index, disabled }}
            onPress={() => select(index as BudgetTier)} style={[styles.tab, selected === index && styles.activeTab, disabled && styles.disabledTab]}>
            <Text style={[styles.tabText, selected === index && styles.activeText, disabled && { color: colors.disabledText }]}>{tier}</Text>
          </Pressable>
        ))}
      </View>
      <View accessibilityLiveRegion="polite" style={styles.breakdown}>
        <Text style={styles.note}>{budget.travelers === 1 ? '每人' : `${budget.travelers} 人`}全程估算 · {budget.currency === 'CNY' ? '人民币' : '日元'}</Text>
        <Text selectable style={styles.total}>约 {format(total)}</Text>
        {budget.travelers > 1 && <Text style={styles.note}>平均每人约 {format(total / budget.travelers)}</Text>}
        {budget.items.map(({ label, amounts }) => (
          <View key={label} style={styles.item}>
            <View style={styles.row}>
              <Text raw style={styles.label}>{label}</Text>
              <Text style={styles.amount}>{format(amounts[selected])}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${total > 0 ? Math.max(0, Math.min(100, amounts[selected] / total * 100)) : 0}%` }]} />
            </View>
          </View>
        ))}
        <Text style={styles.note}><Text raw>{budget.scope.replace(/[。.]$/, '')}</Text>。实际费用以预订时为准。</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, padding: 16, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  tabs: { flexDirection: 'row', gap: 4, borderRadius: layout.controlRadius, backgroundColor: colors.background, padding: 3 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 12 },
  activeTab: { backgroundColor: colors.selected },
  disabledTab: { backgroundColor: colors.surface },
  tabText: { textAlign: 'center', lineHeight: 22, color: colors.secondary, fontSize: 14, fontWeight: '600' },
  activeText: { color: colors.selectedText },
  breakdown: { gap: 8 },
  total: { color: colors.text, fontSize: 29, fontWeight: '700' },
  note: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  item: { gap: 5, marginVertical: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 12 },
  label: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  amount: { color: colors.text, fontSize: 14, fontWeight: '600' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.border },
  bar: { height: '100%', borderRadius: 3, backgroundColor: colors.chart },
});
