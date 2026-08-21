/**
 * components/RiskBadge/index.tsx
 *
 * TASK 34 — Pill badge that colour-codes a Status value.
 *
 *   normal   → green (successBg / success)
 *   attention → amber (warningBg / warning)
 *   critical  → maroon (errorBg / maroon)
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Status } from "../../types/wolis";
import { Colors, Radius } from "../../theme";

const META: Record<Status, { bg: string; fg: string; label: string; dot: string }> = {
  normal:    { bg: Colors.successBg,  fg: Colors.success,  dot: Colors.success,  label: "Норма" },
  attention: { bg: Colors.warningBg,  fg: Colors.warning,  dot: Colors.warning,  label: "Внимание" },
  critical:  { bg: Colors.errorBg,    fg: Colors.maroon,   dot: Colors.maroon,   label: "Критично" },
};

export interface RiskBadgeProps {
  status: Status;
  /** Override display label */
  label?: string;
  size?: "sm" | "md";
}

export function RiskBadge({ status, label, size = "md" }: RiskBadgeProps) {
  const m = META[status] ?? META.normal;
  const isSm = size === "sm";

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: m.bg },
        isSm && styles.pillSm,
      ]}
      accessibilityLabel={`Риск: ${label ?? m.label}`}
    >
      <View style={[styles.dot, { backgroundColor: m.dot }, isSm && styles.dotSm]} />
      <Text style={[styles.label, { color: m.fg }, isSm && styles.labelSm]}>
        {label ?? m.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    alignSelf: "flex-start",
  },
  pillSm: { paddingHorizontal: 7, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotSm: { width: 5, height: 5 },
  label: {
    fontFamily: "System",
    fontWeight: "600",
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  labelSm: { fontSize: 10 },
});
