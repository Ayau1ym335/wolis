import React, { useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import type { SolutionSummary, SolutionType } from "../../types/wolis";
import { Colors, Radius, Shadow, Spacing } from "../../theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
interface SolutionTheme {
  cardBg: string;
  cardBorder: string;
  eyebrowColor: string;
  titleColor: string;
  goalColor: string;
  priceColor: string;
  savingsColor: string;
  dividerColor: string;
  lineKeyColor: string;
  lineValColor: string;
  changesBg: string;
  changesText: string;
  changesIcon: string;
  tagBg: string;
  tagText: string;
}

const THEMES: Record<SolutionType, SolutionTheme> = {
  low_cost: {
    cardBg: Colors.white,
    cardBorder: Colors.border,
    eyebrowColor: Colors.blushDark,
    titleColor: Colors.ink,
    goalColor: Colors.textSecondary,
    priceColor: Colors.ink,
    savingsColor: Colors.maroon,
    dividerColor: Colors.border,
    lineKeyColor: Colors.textSecondary,
    lineValColor: Colors.ink,
    changesBg: Colors.offwhite,
    changesText: Colors.ink,
    changesIcon: Colors.maroon,
    tagBg: Colors.blushLight,
    tagText: Colors.maroonDark,
  },
  optimal: {
    cardBg: Colors.blushLight,
    cardBorder: Colors.blush,
    eyebrowColor: Colors.blushDark,
    titleColor: Colors.ink,
    goalColor: Colors.blushDark,
    priceColor: Colors.ink,
    savingsColor: Colors.maroon,
    dividerColor: "#cdb8c8",
    lineKeyColor: Colors.blushDark,
    lineValColor: Colors.ink,
    changesBg: "rgba(255,255,255,0.55)",
    changesText: Colors.ink,
    changesIcon: Colors.maroon,
    tagBg: Colors.white,
    tagText: Colors.maroon,
  },
  eco: {
    cardBg: Colors.maroon,
    cardBorder: Colors.maroonDark,
    eyebrowColor: "#e3b9b9",
    titleColor: Colors.white,
    goalColor: "#f0d8d8",
    priceColor: Colors.white,
    savingsColor: Colors.blushLight,
    dividerColor: "rgba(255,255,255,0.25)",
    lineKeyColor: "#e3b9b9",
    lineValColor: Colors.white,
    changesBg: "rgba(255,255,255,0.1)",
    changesText: Colors.white,
    changesIcon: Colors.blushLight,
    tagBg: "rgba(255,255,255,0.15)",
    tagText: Colors.blushLight,
  },
};

const TYPE_META: Record<SolutionType, { eyebrow: string; defaultTitle: string; recommended?: boolean }> = {
  low_cost: { eyebrow: "Solution 1", defaultTitle: "Low cost" },
  optimal:  { eyebrow: "Solution 2", defaultTitle: "Optimal",  recommended: true },
  eco:      { eyebrow: "Solution 3", defaultTitle: "Eco" },
};

function formatMoney(amount: number, currency: string): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)} млн ${currency}`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)} тыс. ${currency}`;
  }
  return `${amount.toFixed(0)} ${currency}`;
}
export interface SolutionCardProps {
  solution: SolutionSummary;
  defaultExpanded?: boolean;
}

export function SolutionCard({ solution, defaultExpanded = false }: SolutionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const theme = THEMES[solution.type] ?? THEMES.low_cost;
  const meta = TYPE_META[solution.type] ?? TYPE_META.low_cost;

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }

  const hasLineItems = solution.material_line_items.length > 0;
  const hasChanges = solution.required_changes.length > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={toggle}
      style={[
        styles.card,
        { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
        solution.type === "eco" && styles.cardEco,
      ]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${meta.eyebrow}: ${meta.defaultTitle}`}
    >
      <View style={[styles.fold, { backgroundColor: "rgba(0,0,0,0.08)" }]} />

      {meta.recommended && (
        <View style={[styles.recommendedBadge, { backgroundColor: theme.tagBg }]}>
          <Text style={[styles.recommendedText, { color: theme.tagText }]}>AI Рекомендует</Text>
        </View>
      )}

      <Text style={[styles.eyebrow, { color: theme.eyebrowColor }]}>{meta.eyebrow}</Text>
      <Text style={[styles.title, { color: theme.titleColor }]}>{meta.defaultTitle}</Text>
      <Text style={[styles.goal, { color: theme.goalColor }]} numberOfLines={expanded ? undefined : 2}>
        {solution.required_changes.length > 0
          ? solution.required_changes.slice(0, 2).join(". ")
          : "Оптимальный сценарий реставрации по данным датчиков."}
      </Text>

      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: theme.priceColor }]}>
          {formatMoney(solution.estimated_cost_amount, solution.estimated_cost_currency)}
        </Text>
        {solution.estimated_savings_money > 0 && (
          <Text style={[styles.savings, { color: theme.savingsColor }]}>
            {`экономия ${formatMoney(solution.estimated_savings_money, solution.estimated_cost_currency)}`}
          </Text>
        )}
      </View>

      {expanded && (
        <View style={[styles.details, { borderTopColor: theme.dividerColor }]}>
          {hasChanges && (
            <View style={{ marginBottom: Spacing.md }}>
              <Text style={[styles.detSectionLabel, { color: theme.eyebrowColor }]}>Изменения</Text>
              {solution.required_changes.map((change, i) => (
                <View key={i} style={styles.changeRow}>
                  <View style={[styles.changeDot, { backgroundColor: theme.changesIcon }]} />
                  <Text style={[styles.changeText, { color: theme.changesText }]}>{change}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Savings formula — explicit equation */}
          {(solution.baseline_cost_amount ?? 0) > 0 && (() => {
            const baseline = solution.baseline_cost_amount!;
            const scenario = solution.estimated_cost_amount;
            const savings  = baseline - scenario;
            const pct      = baseline > 0 ? Math.round((savings / baseline) * 100) : 0;
            const cur       = solution.estimated_cost_currency;
            return (
              <View style={[styles.savingsFormula, { backgroundColor: theme.changesBg }]}>
                <Text style={[styles.savingsFormulaLabel, { color: theme.eyebrowColor }]}>
                  КАК СЧИТАЛАСЬ ЭКОНОМИЯ
                </Text>
                <Text style={[styles.savingsFormulaText, { color: theme.changesText }]}>
                  Полная замена — {formatMoney(baseline, cur)}
                </Text>
                <Text style={[styles.savingsFormulaText, { color: theme.changesText }]}>
                  − Данный сценарий — {formatMoney(scenario, cur)}
                </Text>
                <Text style={[styles.savingsFormulaResult, { color: theme.priceColor }]}>
                  = Экономия {formatMoney(savings, cur)} ({pct}%)
                </Text>
              </View>
            );
          })()}

          {hasLineItems && (
            <>
              <Text style={[styles.detSectionLabel, { color: theme.eyebrowColor, marginTop: Spacing.md }]}>
                РАБОТЫ И МАТЕРИАЛЫ
              </Text>

              {/* Table header */}
              <View style={[styles.tableHeader, { borderBottomColor: theme.dividerColor }]}>
                <Text style={[styles.tableHeaderCell, { color: theme.eyebrowColor, flex: 3 }]}>Работа / Материал</Text>
                <Text style={[styles.tableHeaderCell, { color: theme.eyebrowColor, flex: 1, textAlign: "right" }]}>Объём</Text>
                <Text style={[styles.tableHeaderCell, { color: theme.eyebrowColor, flex: 1, textAlign: "right" }]}>Итого</Text>
              </View>

              {solution.material_line_items.map((item, i) => (
                <View key={i} style={[styles.tableRow, { borderBottomColor: theme.dividerColor }]}>
                  <View style={{ flex: 3 }}>
                    {item.work_description ? (
                      <Text style={[styles.tableWorkDesc, { color: theme.eyebrowColor }]} numberOfLines={1}>
                        {item.work_description}
                      </Text>
                    ) : null}
                    <Text style={[styles.lineItemName, { color: theme.lineValColor }]} numberOfLines={2}>
                      {item.material_name}
                    </Text>
                    <Text style={[styles.lineItemQty, { color: theme.lineKeyColor }]}>
                      {item.unit_price_at_calculation.toLocaleString()} {item.unit}⁻¹
                    </Text>
                  </View>
                  <Text style={[styles.tableQtyCell, { color: theme.lineKeyColor }]}>
                    {item.quantity} {item.unit}
                  </Text>
                  <Text style={[styles.lineItemCost, { color: theme.priceColor, flex: 1, textAlign: "right" }]}>
                    {item.line_cost.toLocaleString()}
                  </Text>
                </View>
              ))}

              {/* Total row */}
              <View style={[styles.tableTotalRow, { borderTopColor: theme.dividerColor }]}>
                <Text style={[styles.tableTotalLabel, { color: theme.lineKeyColor }]}>ИТОГО</Text>
                <Text style={[styles.tableTotalValue, { color: theme.priceColor }]}>
                  {formatMoney(solution.estimated_cost_amount, solution.estimated_cost_currency)}
                </Text>
              </View>
            </>
          )}

          {solution.estimated_savings_resources_description.trim().length > 0 && (
            <View style={[styles.resourcesBox, { backgroundColor: theme.changesBg, marginTop: Spacing.sm }]}>
              <Text style={[styles.resourcesLabel, { color: theme.eyebrowColor }]}>Ресурсный эффект</Text>
              <Text style={[styles.resourcesText, { color: theme.changesText }]}>
                {solution.estimated_savings_resources_description}
              </Text>
            </View>
          )}
        </View>
      )}


      <Text style={[styles.chevron, { color: theme.eyebrowColor }]}>
        {expanded ? "▲" : "▼"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    ...Shadow.card,
  },
  cardEco: {
    ...Shadow.elevated,
  },
  fold: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 28,
    height: 28,
  },
  recommendedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginBottom: Spacing.xs,
  },
  recommendedText: {
    fontFamily: "System",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  eyebrow: {
    fontFamily: "System",
    fontSize: 9.5,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 22,
    marginBottom: Spacing.xs,
    letterSpacing: -0.3,
  },
  goal: {
    fontFamily: "System",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: Spacing.md,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  price: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: -0.3,
  },
  savings: {
    fontFamily: "System",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  details: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  detSectionLabel: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  changeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    flexShrink: 0,
  },
  changeText: {
    fontFamily: "System",
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
  },
  resourcesBox: {
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: 2,
  },
  resourcesLabel: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  resourcesText: {
    fontFamily: "System",
    fontSize: 12,
    lineHeight: 17,
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineItemName: {
    fontFamily: "System",
    fontWeight: "600",
    fontSize: 12.5,
  },
  lineItemQty: {
    fontFamily: "System",
    fontSize: 10.5,
    marginTop: 1,
  },
  lineItemCost: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 13,
    marginLeft: Spacing.md,
  },
  baselineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  baselineLabel: {
    fontFamily: "System",
    fontSize: 11,
    flex: 1,
    opacity: 0.75,
  },
  baselineValue: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 12,
    marginLeft: Spacing.sm,
  },
  savingsFormula: {
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: 2,
  },
  savingsFormulaLabel: {
    fontFamily: "System",
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  savingsFormulaText: {
    fontFamily: "System",
    fontSize: 11.5,
  },
  savingsFormulaResult: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 3,
  },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontFamily: "System",
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  tableWorkDesc: {
    fontFamily: "System",
    fontSize: 8.5,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  tableQtyCell: {
    flex: 1,
    fontFamily: "System",
    fontSize: 11,
    textAlign: "right",
    paddingTop: 2,
  },
  tableTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tableTotalLabel: {
    fontFamily: "System",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  tableTotalValue: {
    fontFamily: "System",
    fontWeight: "800",
    fontSize: 14,
  },
  chevron: {
    position: "absolute",
    bottom: Spacing.md,
    right: Spacing.lg,
    fontSize: 9,
  },
});
