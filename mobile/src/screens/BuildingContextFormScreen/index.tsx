/**
 * screens/BuildingContextFormScreen/index.tsx
 *
 * TASK 32 — Форма ввода типа/возраста/материала/площади/региона здания.
 *
 * Design:
 *   • Collapsible chip-selectors for enum fields (building_type, material, region)
 *   • Numeric text inputs for age_years and area_m2 with inline validation
 *   • Real-time field-level error messages under each field
 *   • Primary CTA disabled until isFormValid()
 *   • Wolis brand: maroon #731919, blush #bfa4b8, ink #141616, offwhite #f5f5f7
 */

import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Radius, Shadow, Spacing } from "../../theme";
import {
  BUILDING_TYPE_OPTIONS,
  EMPTY_FORM,
  MATERIAL_OPTIONS,
  REGION_OPTIONS,
  type FormErrors,
  type SelectOption,
  isFormValid,
  validateBuildingContext,
} from "../../features/building-context/buildingContextForm";
import type { BuildingContextFormValues, BuildingType, Material, Region } from "../../types/wolis";

// ─── Chip selector ────────────────────────────────────────────────────────────
function ChipSelector<T extends string>({
  options,
  value,
  onChange,
  error,
}: {
  options: SelectOption<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  error?: string;
}) {
  return (
    <View style={chipStyles.wrapper}>
      <View style={chipStyles.row}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[chipStyles.chip, selected && chipStyles.chipSelected]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
            >
              <Text style={[chipStyles.chipLabel, selected && chipStyles.chipLabelSelected]}>
                {opt.label}
              </Text>
              {opt.description ? (
                <Text style={[chipStyles.chipDesc, selected && chipStyles.chipDescSelected]} numberOfLines={1}>
                  {opt.description}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={chipStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.lg },
  row: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    minWidth: "46%",
    flexGrow: 1,
    ...Shadow.card,
  },
  chipSelected: {
    borderColor: Colors.maroon,
    backgroundColor: "#fff4f4",
  },
  chipLabel: {
    fontFamily: "System",
    fontWeight: "600",
    fontSize: 13.5,
    color: Colors.ink,
    marginBottom: 1,
  },
  chipLabelSelected: { color: Colors.maroon },
  chipDesc: {
    fontFamily: "System",
    fontSize: 10.5,
    color: Colors.textSecondary,
    lineHeight: 14,
  },
  chipDescSelected: { color: Colors.maroonLight },
  errorText: {
    marginTop: Spacing.xs,
    fontSize: 12,
    color: Colors.error,
    fontFamily: "System",
  },
});

// ─── Numeric input ────────────────────────────────────────────────────────────
function NumericField({
  label,
  placeholder,
  suffix,
  value,
  onChange,
  error,
  testID,
}: {
  label: string;
  placeholder: string;
  suffix?: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  error?: string;
  testID?: string;
}) {
  const [raw, setRaw] = useState(value !== undefined ? String(value) : "");

  const handleChange = (text: string) => {
    setRaw(text);
    const n = parseFloat(text.replace(",", "."));
    onChange(Number.isFinite(n) ? n : undefined);
  };

  const hasError = Boolean(error);

  return (
    <View style={numStyles.wrapper}>
      <Text style={numStyles.label}>{label}</Text>
      <View style={[numStyles.inputRow, hasError && numStyles.inputRowError]}>
        <TextInput
          style={numStyles.input}
          value={raw}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          keyboardType="numeric"
          returnKeyType="done"
          testID={testID}
          accessibilityLabel={label}
        />
        {suffix ? <Text style={numStyles.suffix}>{suffix}</Text> : null}
      </View>
      {hasError ? <Text style={numStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

const numStyles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.lg },
  label: {
    fontFamily: "System",
    fontSize: 11,
    letterSpacing: 0.6,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    ...Shadow.card,
  },
  inputRowError: { borderColor: Colors.error },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontFamily: "System",
    fontSize: 15,
    fontWeight: "600",
    color: Colors.ink,
  },
  suffix: {
    fontFamily: "System",
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  errorText: {
    marginTop: Spacing.xs,
    fontSize: 12,
    color: Colors.error,
    fontFamily: "System",
  },
});

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, tag }: { title: string; tag?: string }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.title}>{title}</Text>
      {tag ? <Text style={sectionStyles.tag}>{tag}</Text> : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline", marginBottom: Spacing.sm, gap: Spacing.sm },
  title: { fontFamily: "System", fontWeight: "700", fontSize: 15, color: Colors.ink },
  tag: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 0.8,
    color: Colors.blushDark,
    textTransform: "uppercase",
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export interface BuildingContextFormScreenProps {
  onSubmit: (values: BuildingContextFormValues) => void;
  onBack?: () => void;
  /** If provided, shown as initial values (e.g. when editing) */
  initialValues?: Partial<BuildingContextFormValues>;
}

export default function BuildingContextFormScreen({
  onSubmit,
  onBack,
  initialValues,
}: BuildingContextFormScreenProps) {
  const [values, setValues] = useState<Partial<BuildingContextFormValues>>(
    initialValues ?? EMPTY_FORM
  );
  // Errors are shown only after the user attempts to submit at least once
  const [submitted, setSubmitted] = useState(false);

  const errors: FormErrors = submitted ? validateBuildingContext(values) : {};
  const canSubmit = isFormValid(values);

  function set<K extends keyof BuildingContextFormValues>(key: K, val: BuildingContextFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function handleSubmit() {
    setSubmitted(true);
    if (!canSubmit) return;
    onSubmit(values as BuildingContextFormValues);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Назад"
            >
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.pageTag}>02 / 03</Text>
              <Text style={styles.pageTitle}>Объект</Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          <Text style={styles.subCaption}>
            Уточните характеристики здания — это поможет AI подобрать точные решения.
          </Text>

          {/* ── Building type ── */}
          <SectionHeader title="Тип здания" tag="обязательно" />
          <ChipSelector<BuildingType>
            options={BUILDING_TYPE_OPTIONS}
            value={values.building_type}
            onChange={(v) => set("building_type", v)}
            error={errors.building_type}
          />

          {/* ── Material ── */}
          <SectionHeader title="Основной материал" tag="обязательно" />
          <ChipSelector<Material>
            options={MATERIAL_OPTIONS}
            value={values.material}
            onChange={(v) => set("material", v)}
            error={errors.material}
          />

          {/* ── Region ── */}
          <SectionHeader title="Регион" tag="обязательно" />
          <ChipSelector<Region>
            options={REGION_OPTIONS}
            value={values.region}
            onChange={(v) => set("region", v)}
            error={errors.region}
          />

          {/* ── Numeric fields ── */}
          <SectionHeader title="Параметры" />
          <NumericField
            label="Возраст здания"
            placeholder="Например, 45"
            suffix="лет"
            value={values.age_years}
            onChange={(n) => set("age_years", n as number)}
            error={errors.age_years}
            testID="input-age-years"
          />
          <NumericField
            label="Общая площадь"
            placeholder="Например, 850"
            suffix="м²"
            value={values.area_m2}
            onChange={(n) => set("area_m2", n as number)}
            error={errors.area_m2}
            testID="input-area-m2"
          />

          {/* ── Validation summary (shown after first submit attempt) ── */}
          {submitted && !canSubmit && (
            <View style={styles.validationBanner} accessibilityRole="alert">
              <Text style={styles.validationBannerText}>
                Заполните все обязательные поля перед отправкой.
              </Text>
            </View>
          )}

          {/* ── CTA ── */}
          <TouchableOpacity
            style={[styles.btnPrimary, !canSubmit && styles.btnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            accessibilityLabel="Получить AI-анализ"
            accessibilityRole="button"
            testID="btn-submit-form"
          >
            <Text style={styles.btnPrimaryText}>Получить AI‑анализ →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
    marginBottom: Spacing.sm,
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
  pageTitle: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 20,
    color: Colors.ink,
  },

  subCaption: {
    fontFamily: "System",
    fontSize: 12.5,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: Spacing.xxl,
  },

  validationBanner: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.maroon,
  },
  validationBannerText: {
    fontFamily: "System",
    fontSize: 13,
    color: Colors.maroon,
    lineHeight: 18,
  },

  btnPrimary: {
    width: "100%",
    backgroundColor: Colors.maroon,
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: "center",
    marginTop: Spacing.sm,
    ...Shadow.card,
  },
  btnDisabled: { opacity: 0.45 },
  btnPrimaryText: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 14,
    color: Colors.white,
    letterSpacing: 0.2,
  },
});
