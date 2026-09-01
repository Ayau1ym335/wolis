

import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { WolisResult } from "../../types/wolis";
import { Colors, Radius, Shadow, Spacing } from "../../theme";
import { RiskBadge } from "../../components/RiskBadge";
import { SolutionCard } from "../../components/SolutionCard";


function RiskScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct < 35 ? Colors.success :
    pct < 65 ? Colors.warning :
               Colors.maroon;

  return (
    <View style={barStyles.wrapper}>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[barStyles.label, { color }]}>{pct.toFixed(0)}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrapper: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.lg },
  track: {
    flex: 1, height: 8, backgroundColor: Colors.border,
    borderRadius: Radius.pill, overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: Radius.pill },
  label: { fontFamily: "System", fontWeight: "700", fontSize: 17, minWidth: 36, textAlign: "right" },
});


const CONFIDENCE_LABEL: Record<string, string> = {
  low: "Низкая точность",
  medium: "Средняя точность",
  high: "Высокая точность",
};


export interface ResultsScreenProps {
  result: WolisResult;
  onNewMeasurement?: () => void;
  onBack?: () => void;
  
  onExportPdf?: (sessionId: string) => void;
}

export default function ResultsScreen({ result, onNewMeasurement, onBack, onExportPdf }: ResultsScreenProps) {
  const { assessment, solutions, measurement } = result;
  const sessionId = measurement.session_id;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Назад"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.pageTag}>03 / 03</Text>
            <Text style={styles.pageTitle}>AI‑анализ</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>РЕЗЮМЕ</Text>
          <Text style={styles.summaryText}>
            {assessment.key_concerns.length > 0
              ? assessment.key_concerns.join(". ") + "."
              : "Объект в целом устойчив. Конкретные параметры — ниже."}
          </Text>
          {assessment.ml_model_used && (
            <View style={styles.mlChip}>
              <Text style={styles.mlChipText}>
                ML{assessment.model_version ? ` · v${assessment.model_version}` : ""}
              </Text>
            </View>
          )}
        </View>

        {}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>ОБЩИЙ РИСК</Text>
          <RiskScoreBar score={assessment.overall_risk_score} />
          <View style={styles.riskMetaRow}>
            <RiskBadge status={assessment.overall_status} />
            <Text style={styles.confidenceText}>
              {CONFIDENCE_LABEL[assessment.confidence] ?? assessment.confidence}
            </Text>
          </View>
        </View>

        {}
        {assessment.parameter_flags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>ПАРАМЕТРЫ</Text>
            {assessment.parameter_flags.map((flag, i) => (
              <View key={i} style={styles.flagRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.flagGroup}>{flag.group}</Text>
                  {flag.contributing_sensors.length > 0 && (
                    <Text style={styles.flagSensors}>
                      {flag.contributing_sensors.join(", ")}
                    </Text>
                  )}
                </View>
                <RiskBadge status={flag.status} size="sm" />
              </View>
            ))}
          </View>
        )}

        {}
        <View style={[styles.section, styles.buildingRow]}>
          <InfoPill label="Тип" value={measurement.building_type} />
          <InfoPill label="Материал" value={measurement.construction_material} />
          <InfoPill label="Регион" value={measurement.region} />
          <InfoPill label="Площадь" value={`${measurement.building_area_m2} м²`} />
          <InfoPill label="Возраст" value={`${measurement.building_age_years} л`} />
        </View>

        {}
        <View style={styles.solutionsHeader}>
          <Text style={styles.solutionsTitle}>Варианты реставрации</Text>
          <Text style={styles.solutionsSub}>Коснитесь карточки, чтобы раскрыть детали.</Text>
        </View>

        {}
        {solutions.length > 0 ? (
          solutions.map((sol) => (
            <SolutionCard
              key={sol.type}
              solution={sol}
              defaultExpanded={sol.type === "optimal"}
            />
          ))
        ) : (
          <View style={styles.noSolutions}>
            <Text style={styles.noSolutionsText}>Решения не получены от сервера.</Text>
          </View>
        )}

        {}
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={onNewMeasurement}
          activeOpacity={0.8}
          accessibilityLabel="Новый замер"
          accessibilityRole="button"
        >
          <Text style={styles.btnPrimaryText}>Новый замер</Text>
        </TouchableOpacity>

        {}
        {sessionId && onExportPdf && (
          <TouchableOpacity
            style={[styles.btnGhost, { marginTop: Spacing.sm }]}
            onPress={() => onExportPdf(String(sessionId))}
            activeOpacity={0.8}
            accessibilityLabel="Экспорт PDF"
            accessibilityRole="button"
            testID="btn-export-pdf"
          >
            <Text style={styles.btnGhostText}>↓ Экспорт PDF</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={pillStyles.pill}>
      <Text style={pillStyles.label}>{label}</Text>
      <Text style={pillStyles.value}>{value}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  label: { fontFamily: "System", fontSize: 8.5, color: Colors.textSecondary, letterSpacing: 0.3 },
  value: { fontFamily: "System", fontSize: 11, fontWeight: "700", color: Colors.ink },
});


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.offwhite },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 48,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  backArrow: { fontSize: 22, color: Colors.ink, fontWeight: "300" },
  headerCenter: { flex: 1, alignItems: "center" },
  pageTag: {
    fontFamily: "System",
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: Colors.blushDark,
    marginBottom: 2,
  },
  pageTitle: { fontFamily: "System", fontWeight: "700", fontSize: 20, color: Colors.ink },

  
  summaryCard: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.elevated,
  },
  summaryEyebrow: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.blushLight,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  summaryText: {
    fontFamily: "System",
    fontSize: 13,
    color: "#f1e9ee",
    lineHeight: 20,
  },
  mlChip: {
    marginTop: Spacing.md,
    alignSelf: "flex-start",
    backgroundColor: "rgba(191,164,184,0.2)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  mlChipText: {
    fontFamily: "System",
    fontSize: 9.5,
    color: Colors.blushLight,
    letterSpacing: 0.5,
  },

  
  section: {
    marginBottom: Spacing.lg,
  },
  sectionEyebrow: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.blushDark,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  riskMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confidenceText: {
    fontFamily: "System",
    fontSize: 11.5,
    color: Colors.textSecondary,
  },

  
  flagRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.stone,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  flagGroup: {
    fontFamily: "System",
    fontWeight: "600",
    fontSize: 13,
    color: Colors.ink,
    marginBottom: 2,
  },
  flagSensors: {
    fontFamily: "System",
    fontSize: 10.5,
    color: Colors.textSecondary,
  },

  
  buildingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },

  
  solutionsHeader: { marginBottom: Spacing.md },
  solutionsTitle: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 18,
    color: Colors.ink,
    marginBottom: 3,
  },
  solutionsSub: {
    fontFamily: "System",
    fontSize: 12,
    color: Colors.textSecondary,
  },

  noSolutions: {
    padding: Spacing.xl,
    alignItems: "center",
    backgroundColor: Colors.stone,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  noSolutionsText: { fontFamily: "System", fontSize: 13, color: Colors.textSecondary },

  
  btnPrimary: {
    width: "100%",
    backgroundColor: Colors.maroon,
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: "center",
    marginTop: Spacing.md,
    ...Shadow.card,
  },
  btnPrimaryText: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 14,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  btnGhost: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  btnGhostText: {
    fontFamily: "System",
    fontWeight: "600",
    fontSize: 14,
    color: Colors.ink,
  },
});
