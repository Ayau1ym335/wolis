/**
 * app/WolisNavigator.tsx
 *
 * TASK 33 + TASK 36 update — wraps the full app flow with authentication.
 *
 * Boot sequence:
 *   1. initializeAuth() → restores persisted session / attaches token
 *   2. AuthStatus "loading"       → splash/spinner
 *   3. AuthStatus "unauthenticated" → LoginScreen
 *   4. AuthStatus "authenticated"   → measurement flow
 *
 * Measurement flow (unchanged from TASK 33):
 *   DeviceConnectionScreen → MeasurementScreen
 *     → BuildingContextFormScreen → [submitting] → ResultsScreen
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth, initializeAuth } from "../features/auth/useAuth";
import { useBleDevice } from "../features/ble_connection/useBleDevice";
import { submit as submitMeasurement } from "../services/measurementsApi";
import { ApiError } from "../services/apiClient";
import type { BuildingContextFormValues, RawSensorPacket, WolisResult } from "../types/wolis";
import { Colors, Radius, Shadow, Spacing } from "../theme";

import LoginScreen from "../screens/LoginScreen";
import DeviceConnectionScreen from "../screens/DeviceConnectionScreen";
import MeasurementScreen from "../screens/MeasurementScreen";
import BuildingContextFormScreen from "../screens/BuildingContextFormScreen";
import ResultsScreen from "../screens/ResultsScreen";
import ReportPreviewScreen from "../screens/ReportPreviewScreen";

// ─── Flow state ───────────────────────────────────────────────────────────────
type FlowStep =
  | { step: "connect" }
  | { step: "measure" }
  | { step: "form"; reading: RawSensorPacket }
  | { step: "submitting"; reading: RawSensorPacket; context: BuildingContextFormValues }
  | { step: "results"; result: WolisResult }
  | { step: "report"; result: WolisResult; sessionId: string }
  | { step: "error"; message: string; fromStep: FlowStep };

// ─── Splash / loading screen ──────────────────────────────────────────────────
function SplashScreen() {
  return (
    <SafeAreaView style={splashStyles.safe}>
      <View style={splashStyles.center}>
        <View style={splashStyles.logoRow}>
          <Text style={splashStyles.logoL}>W</Text>
          <View style={splashStyles.logoO}><View style={splashStyles.logoOIn} /></View>
          <Text style={splashStyles.logoL}>LIS</Text>
        </View>
        <ActivityIndicator color={Colors.maroon} style={{ marginTop: 32 }} />
      </View>
    </SafeAreaView>
  );
}

const splashStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.offwhite },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  logoL: { fontFamily: "System", fontWeight: "900", fontSize: 42, color: Colors.ink, letterSpacing: -1 },
  logoO: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.maroon, alignItems: "center", justifyContent: "center" },
  logoOIn: { width: 9, height: 18, backgroundColor: Colors.white, borderRadius: 3 },
});

// ─── Submitting overlay ───────────────────────────────────────────────────────
function SubmittingOverlay() {
  return (
    <SafeAreaView style={overlayStyles.safe}>
      <View style={overlayStyles.center}>
        <View style={overlayStyles.card}>
          <ActivityIndicator size="large" color={Colors.maroon} />
          <Text style={overlayStyles.title}>Отправка в AI‑модуль</Text>
          <Text style={overlayStyles.sub}>Анализируем данные датчиков…</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const overlayStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.offwhite },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  card: {
    width: "100%", backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.xxl, alignItems: "center", gap: Spacing.md, ...Shadow.elevated,
  },
  title: { fontFamily: "System", fontWeight: "700", fontSize: 18, color: Colors.ink, marginTop: Spacing.md, textAlign: "center" },
  sub: { fontFamily: "System", fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 18 },
});

// ─── Error screen ─────────────────────────────────────────────────────────────
function ErrorScreen({ message, onRetry, onReset }: { message: string; onRetry: () => void; onReset: () => void }) {
  return (
    <SafeAreaView style={errStyles.safe}>
      <View style={errStyles.center}>
        <View style={errStyles.iconCircle}><Text style={errStyles.icon}>!</Text></View>
        <Text style={errStyles.title}>Ошибка</Text>
        <Text style={errStyles.message}>{message}</Text>
        <TouchableOpacity style={errStyles.btnPrimary} onPress={onRetry} activeOpacity={0.8}>
          <Text style={errStyles.btnText}>Попробовать снова</Text>
        </TouchableOpacity>
        <TouchableOpacity style={errStyles.btnGhost} onPress={onReset} activeOpacity={0.7}>
          <Text style={errStyles.btnGhostText}>Начать заново</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const errStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.offwhite },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.errorBg, alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg },
  icon: { fontSize: 28, color: Colors.maroon, fontWeight: "700" },
  title: { fontFamily: "System", fontWeight: "700", fontSize: 22, color: Colors.ink, marginBottom: Spacing.sm },
  message: { fontFamily: "System", fontSize: 13.5, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: Spacing.xl },
  btnPrimary: { width: "100%", backgroundColor: Colors.maroon, paddingVertical: 15, borderRadius: Radius.md, alignItems: "center", marginBottom: Spacing.sm, ...Shadow.card },
  btnText: { fontFamily: "System", fontWeight: "700", fontSize: 14, color: Colors.white },
  btnGhost: { width: "100%", paddingVertical: 14, borderRadius: Radius.md, alignItems: "center", borderWidth: 1, borderColor: Colors.ink },
  btnGhostText: { fontFamily: "System", fontWeight: "600", fontSize: 14, color: Colors.ink },
});

// ─── Main navigator ───────────────────────────────────────────────────────────
export default function WolisNavigator() {
  const auth = useAuth();
  const [flow, setFlow] = useState<FlowStep>({ step: "connect" });
  const ble = useBleDevice();

  // Initialize auth on first render (restores persisted session)
  useEffect(() => {
    initializeAuth();
  }, []);

  // Reset flow when user logs out
  useEffect(() => {
    if (auth.status === "unauthenticated") {
      ble.disconnect();
      setFlow({ step: "connect" });
    }
  }, [auth.status]);

  // ── Submission handler ──────────────────────────────────────────────────
  const handleFormSubmit = useCallback(
    async (context: BuildingContextFormValues, reading: RawSensorPacket) => {
      const fromStep: FlowStep = { step: "form", reading };
      setFlow({ step: "submitting", reading, context });

      const doSubmit = () =>
        submitMeasurement({
          ...reading,
          ...context,
          user_id: auth.session?.user_id ?? "anon-user",
        });

      try {
        const result = await doSubmit();
        setFlow({ step: "results", result });
      } catch (err) {
        // 401 → токен истёк. Пробуем обновить его и повторить запрос один раз.
        if (err instanceof ApiError && err.status === 401) {
          const refreshed = await auth.refreshSession();
          if (!refreshed) {
            // refreshSession сам вызвал signOut → навигатор покажет LoginScreen
            return;
          }
          // Повторяем запрос с новым токеном
          try {
            const result = await doSubmit();
            setFlow({ step: "results", result });
            return;
          } catch (retryErr) {
            const message =
              retryErr instanceof ApiError && retryErr.status === 401
                ? `Ошибка авторизации: ${retryErr.body?.message || "Токен недействителен"}`
                : retryErr instanceof Error
                ? retryErr.message
                : "Неизвестная ошибка при отправке данных.";
            setFlow({ step: "error", message, fromStep });
            return;
          }
        }
        const message =
          err instanceof Error ? err.message : "Неизвестная ошибка при отправке данных.";
        setFlow({ step: "error", message, fromStep });
      }
    },
    [auth]
  );

  const resetFlow = useCallback(() => {
    ble.disconnect();
    setFlow({ step: "connect" });
  }, [ble]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* Auth gate */}
      {auth.status === "loading" && <SplashScreen />}

      {auth.status === "unauthenticated" || auth.status === "error" ? (
        <LoginScreen />
      ) : null}

      {auth.status === "authenticated" && (
        <>
          {flow.step === "connect" && (
            <DeviceConnectionScreen onConnected={() => setFlow({ step: "measure" })} />
          )}
          {flow.step === "measure" && (
            <MeasurementScreen
              adapter={ble.adapter}
              onBack={() => { ble.disconnect(); setFlow({ step: "connect" }); }}
              onSubmit={(reading) => setFlow({ step: "form", reading })}
            />
          )}
          {flow.step === "form" && (
            <BuildingContextFormScreen
              onBack={() => setFlow({ step: "measure" })}
              onSubmit={(context) => handleFormSubmit(context, flow.reading)}
            />
          )}
          {flow.step === "submitting" && <SubmittingOverlay />}
          {flow.step === "results" && (
            <ResultsScreen
              result={flow.result}
              onBack={() => setFlow({ step: "form", reading: ({} as RawSensorPacket) })}
              onNewMeasurement={resetFlow}
              onExportPdf={(sessionId) =>
                setFlow({ step: "report", result: flow.result, sessionId })
              }
            />
          )}
          {flow.step === "report" && (
            <ReportPreviewScreen
              sessionId={flow.sessionId}
              onBack={() => setFlow({ step: "results", result: flow.result })}
            />
          )}
          {flow.step === "error" && (
            <ErrorScreen
              message={flow.message}
              onRetry={() => setFlow(flow.fromStep)}
              onReset={resetFlow}
            />
          )}
        </>
      )}
    </>
  );
}
