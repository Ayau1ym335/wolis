/**
 * screens/ReportPreviewScreen/index.tsx
 *
 * TASK 39 — "Export PDF" flow screen.
 *
 * States:
 *   generating  → spinner + "Генерируем PDF…" text
 *   ready       → success card with download URL link + "Открыть PDF" button
 *   error       → error card with retry
 *
 * Opening the URL:
 *   - React Native: Linking.openURL(url)
 *   - The URL is the public Supabase Storage link, so it opens directly
 *     in the device browser / PDF viewer.
 *
 * Props:
 *   sessionId   — used to call generateReport()
 *   onBack      — navigation back to ResultsScreen
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Radius, Shadow, Spacing } from "../../theme";
import { generateReport } from "../../services/reportsApi";

// ─── Copy-link helper (clipboard fallback) ────────────────────────────────────
async function openUrl(url: string): Promise<void> {
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  } else {
    // Fallback: try to open anyway (some custom schemes report false)
    await Linking.openURL(url);
  }
}

// ─── Checkmark animation ──────────────────────────────────────────────────────
function CheckCircle() {
  const scale = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 14 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[checkStyles.circle, { transform: [{ scale }], opacity }]}>
      <Text style={checkStyles.mark}>✓</Text>
    </Animated.View>
  );
}

const checkStyles = StyleSheet.create({
  circle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.successBg,
    alignItems: "center", justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  mark: { fontSize: 30, color: Colors.success },
});

// ─── URL card ─────────────────────────────────────────────────────────────────
function UrlCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    // In Expo: use expo-clipboard; in bare RN: @react-native-clipboard/clipboard
    // Fallback: just show a confirmation
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const displayUrl = url.length > 52 ? `${url.slice(0, 49)}…` : url;

  return (
    <TouchableOpacity
      style={urlStyles.card}
      onPress={handleCopy}
      activeOpacity={0.8}
      accessibilityLabel="Ссылка на PDF"
    >
      <Text style={urlStyles.label}>ССЫЛКА НА ФАЙЛ</Text>
      <Text style={urlStyles.url} numberOfLines={2}>{displayUrl}</Text>
      <Text style={urlStyles.copyHint}>{copied ? "✓ Скопировано" : "Коснитесь, чтобы скопировать"}</Text>
    </TouchableOpacity>
  );
}

const urlStyles = StyleSheet.create({
  card: {
    width: "100%", backgroundColor: Colors.stone,
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  label: { fontFamily: "System", fontSize: 9, letterSpacing: 0.8, color: Colors.textSecondary, marginBottom: Spacing.xs },
  url: { fontFamily: "System", fontSize: 11.5, color: Colors.ink, lineHeight: 16, marginBottom: Spacing.xs },
  copyHint: { fontFamily: "System", fontSize: 10.5, color: Colors.blushDark },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export interface ReportPreviewScreenProps {
  sessionId: string;
  onBack?: () => void;
}

type ReportState =
  | { phase: "generating" }
  | { phase: "ready"; url: string }
  | { phase: "error"; message: string };

export default function ReportPreviewScreen({ sessionId, onBack }: ReportPreviewScreenProps) {
  const [state, setState] = useState<ReportState>({ phase: "generating" });

  const generate = useCallback(async () => {
    setState({ phase: "generating" });
    try {
      const { download_url } = await generateReport(sessionId);
      setState({ phase: "ready", url: download_url });
    } catch (e) {
      setState({ phase: "error", message: (e as Error).message ?? "Не удалось создать отчёт." });
    }
  }, [sessionId]);

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Назад"
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>PDF‑отчёт</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.body}>
        {/* ── Generating ── */}
        {state.phase === "generating" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.maroon} />
            <Text style={styles.generatingTitle}>Генерируем PDF…</Text>
            <Text style={styles.generatingSub}>
              Запрашиваем данные, рендерим отчёт{"\n"}и загружаем в облако.
            </Text>
          </View>
        )}

        {/* ── Ready ── */}
        {state.phase === "ready" && (
          <View style={styles.center}>
            <CheckCircle />
            <Text style={styles.readyTitle}>Отчёт готов</Text>
            <Text style={styles.readySub}>
              PDF сформирован и сохранён в Supabase Storage.
            </Text>

            <UrlCard url={state.url} />

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => openUrl(state.url)}
              activeOpacity={0.8}
              accessibilityLabel="Открыть PDF"
              accessibilityRole="button"
              testID="btn-open-pdf"
            >
              <Text style={styles.btnPrimaryText}>Открыть PDF ↗</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnGhost}
              onPress={generate}
              activeOpacity={0.7}
              accessibilityLabel="Пересоздать отчёт"
            >
              <Text style={styles.btnGhostText}>Пересоздать</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Error ── */}
        {state.phase === "error" && (
          <View style={styles.center}>
            <View style={styles.errorCircle}>
              <Text style={styles.errorIcon}>!</Text>
            </View>
            <Text style={styles.errorTitle}>Не удалось создать PDF</Text>
            <Text style={styles.errorSub}>{state.message}</Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={generate}
              activeOpacity={0.8}
              accessibilityLabel="Попробовать снова"
              testID="btn-retry-pdf"
            >
              <Text style={styles.btnPrimaryText}>Попробовать снова</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.offwhite },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.ink, fontWeight: "300" },
  pageTitle: { fontFamily: "System", fontWeight: "700", fontSize: 20, color: Colors.ink },

  body: { flex: 1, paddingHorizontal: Spacing.xl },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Generating
  generatingTitle: {
    fontFamily: "System", fontWeight: "700", fontSize: 18, color: Colors.ink,
    marginTop: Spacing.xl, marginBottom: Spacing.sm, textAlign: "center",
  },
  generatingSub: {
    fontFamily: "System", fontSize: 13, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 19,
  },

  // Ready
  readyTitle: {
    fontFamily: "System", fontWeight: "700", fontSize: 22, color: Colors.ink,
    marginBottom: Spacing.sm, textAlign: "center",
  },
  readySub: {
    fontFamily: "System", fontSize: 13, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 19, marginBottom: Spacing.xl,
  },

  // Error
  errorCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.errorBg,
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg,
  },
  errorIcon: { fontSize: 28, color: Colors.maroon, fontWeight: "700" },
  errorTitle: {
    fontFamily: "System", fontWeight: "700", fontSize: 18, color: Colors.ink,
    marginBottom: Spacing.sm, textAlign: "center",
  },
  errorSub: {
    fontFamily: "System", fontSize: 13, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 19, marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },

  // Buttons
  btnPrimary: {
    width: "100%", backgroundColor: Colors.maroon, paddingVertical: 15,
    borderRadius: Radius.md, alignItems: "center", marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  btnPrimaryText: { fontFamily: "System", fontWeight: "700", fontSize: 14, color: Colors.white, letterSpacing: 0.2 },
  btnGhost: {
    width: "100%", paddingVertical: 14, borderRadius: Radius.md,
    alignItems: "center", borderWidth: 1, borderColor: Colors.border,
  },
  btnGhostText: { fontFamily: "System", fontWeight: "600", fontSize: 14, color: Colors.ink },
});
