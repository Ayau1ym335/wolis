/**
 * app/WolisNavigator.tsx
 *
 * TASK 33 — Submit flow integration.
 *
 * Wires together the complete end-to-end path:
 *
 *   DeviceConnectionScreen
 *     → MeasurementScreen          (BLE live readings)
 *       → BuildingContextFormScreen (building metadata form)
 *         → [submitting…]           (calls measurementsApi.submit)
 *           → ResultsScreen         (displays WolisResult)
 *
 * This file is a self-contained stack navigator that manages:
 *   • BLE adapter lifecycle (one useBleDevice instance for the whole stack)
 *   • RawSensorPacket hand-off from MeasurementScreen → BuildingContextFormScreen
 *   • API call (measurementsApi.submit) with loading + error states
 *   • WolisResult hand-off to ResultsScreen
 *
 * No React Navigation required — screen transitions are driven by a simple
 * discriminated-union flow state so the navigator can be embedded anywhere
 * (bare RN, Expo, or wrapped in a Navigator later).
 *
 * If you are using React Navigation, replace the conditional rendering with
 * Stack.Navigator screens and pass props via route.params.
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useBleDevice } from "../features/ble_connection/useBleDevice";
import { submit as submitMeasurement } from "../services/measurementsApi";
import type { BuildingContextFormValues, RawSensorPacket, WolisResult } from "../types/wolis";
import { Colors, Radius, Shadow, Spacing } from "../theme";

// Lazy imports to keep initial bundle lean
const DeviceConnectionScreen = React.lazy(() => import("../screens/DeviceConnectionScreen"));
const MeasurementScreen = React.lazy(() => import("../screens/MeasurementScreen"));
const BuildingContextFormScreen = React.lazy(() => import("../screens/BuildingContextFormScreen"));
const ResultsScreen = React.lazy(() => import("../screens/ResultsScreen"));

// ─── Flow state ───────────────────────────────────────────────────────────────
type FlowStep =
  | { step: "connect" }
  | { step: "measure" }
  | { step: "form"; reading: RawSensorPacket }
  | { step: "submitting"; reading: RawSensorPacket; context: BuildingContextFormValues }
  | { step: "results"; result: WolisResult }
  | { step: "error"; message: string; fromStep: FlowStep };

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
    width: "100%",
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: "center",
    gap: Spacing.md,
    ...Shadow.elevated,
  },
  title: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 18,
    color: Colors.ink,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  sub: {
    fontFamily: "System",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
});

// ─── Error screen ─────────────────────────────────────────────────────────────
function ErrorScreen({ message, onRetry, onReset }: { message: string; onRetry: () => void; onReset: () => void }) {
  return (
    <SafeAreaView style={errStyles.safe}>
      <View style={errStyles.center}>
        <View style={errStyles.iconCircle}>
          <Text style={errStyles.icon}>!</Text>
        </View>
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
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.errorBg,
    alignItems: "center", justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  icon: { fontSize: 28, color: Colors.maroon, fontWeight: "700" },
  title: { fontFamily: "System", fontWeight: "700", fontSize: 22, color: Colors.ink, marginBottom: Spacing.sm },
  message: {
    fontFamily: "System", fontSize: 13.5, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 20, marginBottom: Spacing.xl,
  },
  btnPrimary: {
    width: "100%", backgroundColor: Colors.maroon, paddingVertical: 15,
    borderRadius: Radius.md, alignItems: "center", marginBottom: Spacing.sm, ...Shadow.card,
  },
  btnText: { fontFamily: "System", fontWeight: "700", fontSize: 14, color: Colors.white },
  btnGhost: {
    width: "100%", paddingVertical: 14, borderRadius: Radius.md,
    alignItems: "center", borderWidth: 1, borderColor: Colors.ink,
  },
  btnGhostText: { fontFamily: "System", fontWeight: "600", fontSize: 14, color: Colors.ink },
});

// ─── Main navigator ───────────────────────────────────────────────────────────
/**
 * WOLIS_USER_ID — In production, replace with the authenticated user's ID
 * from your auth context / Supabase session.
 */
const WOLIS_USER_ID = "anon-user";

export default function WolisNavigator() {
  const [flow, setFlow] = useState<FlowStep>({ step: "connect" });

  const ble = useBleDevice();

  // ── Submission handler (TASK 33 core) ────────────────────────────────────
  const handleFormSubmit = useCallback(
    async (context: BuildingContextFormValues, reading: RawSensorPacket) => {
      const fromStep: FlowStep = { step: "form", reading };
      setFlow({ step: "submitting", reading, context });
      try {
        const result = await submitMeasurement({
          ...reading,
          ...context,
          user_id: WOLIS_USER_ID,
        });
        setFlow({ step: "results", result });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Неизвестная ошибка при отправке данных.";
        setFlow({ step: "error", message, fromStep });
      }
    },
    []
  );

  // ── Reset to start ────────────────────────────────────────────────────────
  const resetFlow = useCallback(() => {
    ble.disconnect();
    setFlow({ step: "connect" });
  }, [ble]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <React.Suspense fallback={<SubmittingOverlay />}>
      {flow.step === "connect" && (
        <DeviceConnectionScreen
          onConnected={() => setFlow({ step: "measure" })}
        />
      )}

      {flow.step === "measure" && (
        <MeasurementScreen
          adapter={ble.adapter}
          onBack={() => {
            ble.disconnect();
            setFlow({ step: "connect" });
          }}
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
        />
      )}

      {flow.step === "error" && (
        <ErrorScreen
          message={flow.message}
          onRetry={() => {
            // Go back to the form step with the preserved reading
            if (flow.fromStep.step === "form") {
              handleFormSubmit(
                ({} as BuildingContextFormValues), // user needs to re-fill
                flow.fromStep.reading
              );
            }
            setFlow(flow.fromStep);
          }}
          onReset={resetFlow}
        />
      )}
    </React.Suspense>
  );
}
