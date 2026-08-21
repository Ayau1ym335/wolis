/**
 * components/SolutionCard/index.tsx
 *
 * TASK 34 — Expandable solution card.
 *
 * Three visual themes:
 *   low_cost  → white card  (economical)
 *   optimal   → blush card  (recommended, AI pick)
 *   eco       → maroon card (dark, eco)
 *
 * Collapsed: eyebrow, title, goal text, price row.
 * Expanded:  + material line items table, required changes list.
 *
 * The card is self-contained — animation is driven by Animated.Value
 * so it works without Reanimated.
 */

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

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Theme per solution type ──────────────────────────────────────────────────
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

// ─── Solution meta info ───────────────────────────────────────────────────────
const TYPE_META: Record<SolutionType, { eyebrow: string; defaultTitle: string; recommended?: boolean }> = {
  low_cost: { eyebrow: "Solution 1", defaultTitle: "Low cost" },
  optimal:  { eyebrow: "Solution 2", defaultTitle: "Optimal",  recommended: true },
  eco:      { eyebrow: "Solution 3", defaultTitle: "Eco" },
};

// ─── Format helpers ───────────────────────────────────────────────────────────
function formatMoney(amount: number, currency: string): string {
  return `${(amount / 1_000_000).toFixed(1)} млн ${currency}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export interface SolutionCardProps {
  solution: SolutionSummary;
  /** Whether card starts in expanded state */
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
      {/* Corner fold decoration */}
      <View style={[styles.fold, { backgroundColor: "rgba(0,0,0,0.08)" }]} />

      {/* Recommended badge */}
      {meta.recommended && (
        <View style={[styles.recommendedBadge, { backgroundColor: theme.tagBg }]}>
          <Text style={[styles.recommendedText, { color: theme.tagText }]}>AI Рекомендует</Text>
        </View>
      )}

      {/* Header */}
      <Text style={[styles.eyebrow, { color: theme.eyebrowColor }]}>{meta.eyebrow}</Text>
      <Text style={[styles.title, { color: theme.titleColor }]}>{meta.defaultTitle}</Text>
      <Text style={[styles.goal, { color: theme.goalColor }]} numberOfLines={expanded ? undefined : 2}>
        {solution.required_changes.length > 0
          ? solution.required_changes.slice(0, 2).join(". ")
          : "Оптимальный сценарий реставрации по данным датчиков."}
      </Text>

      {/* Price row */}
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

      {/* Expanded details */}
      {expanded && (
        <View style={[styles.details, { borderTopColor: theme.dividerColor }]}>
          {/* Required changes */}
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

          {/* Resource savings */}
          {solution.estimated_savings_resources_description.trim().length > 0 && (
            <View style={[styles.resourcesBox, { backgroundColor: theme.changesBg }]}>
              <Text style={[styles.resourcesLabel, { color: theme.eyebrowColor }]}>Ресурсы</Text>
              <Text style={[styles.resourcesText, { color: theme.changesText }]}>
                {solution.estimated_savings_resources_description}
              </Text>
            </View>
          )}

          {/* Material line items */}
          {hasLineItems && (
            <>
              <Text style={[styles.detSectionLabel, { color: theme.eyebrowColor, marginTop: Spacing.md }]}>
                Материалы
              </Text>
              {solution.material_line_items.map((item, i) => (
                <View key={i} style={[styles.lineItem, { borderBottomColor: theme.dividerColor }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lineItemName, { color: theme.lineValColor }]} numberOfLines={1}>
                      {item.material_name}
                    </Text>
                    <Text style={[styles.lineItemQty, { color: theme.lineKeyColor }]}>
                      {item.quantity} {item.unit}
                    </Text>
                  </View>
                  <Text style={[styles.lineItemCost, { color: theme.priceColor }]}>
                    {item.line_cost.toLocaleString()} {solution.estimated_cost_currency}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Expand/collapse chevron */}
      <Text style={[styles.chevron, { color: theme.eyebrowColor }]}>
        {expanded ? "▲" : "▼"}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
  chevron: {
    position: "absolute",
    bottom: Spacing.md,
    right: Spacing.lg,
    fontSize: 9,
  },
});
