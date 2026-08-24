

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Radius, Shadow, Spacing } from "../../theme";
import { useMeasurementSession } from "../../features/measurement/useMeasurementSession";
import type { BleAdapter } from "../../features/ble_connection/bleadapter";
import type { RawSensorPacket } from "../../types/wolis";


interface ReadingDescriptor {
  key: keyof RawSensorPacket;
  label: string;
  unit: string;
  precision: number;
  flagFn?: (v: number | boolean) => boolean;
  flagLabel?: string;
}

const READINGS: ReadingDescriptor[] = [
  { key: "temperature_c", label: "Температура", unit: "°C", precision: 1 },
  {
    key: "humidity_pct",
    label: "Влажность",
    unit: "%",
    precision: 0,
    flagFn: (v) => (v as number) > 70,
    flagLabel: "Требует внимания",
  },
  { key: "pressure_hpa", label: "Давление", unit: "гПа", precision: 0 },
  { key: "illuminance_lux", label: "Освещённость", unit: "лк", precision: 0 },
  {
    key: "tilt_angle_deg",
    label: "Угол наклона",
    unit: "°",
    precision: 1,
    flagFn: (v) => (v as number) > 2,
    flagLabel: "Требует внимания",
  },
  { key: "vibration_magnitude", label: "Вибрация", unit: "g", precision: 3 },
  {
    key: "shock_detected",
    label: "Удар",
    unit: "",
    precision: 0,
    flagFn: (v) => v === true,
    flagLabel: "Удар!",
  },
];


function useFlicker(value: number | boolean | null) {
  const anim = useRef(new Animated.Value(1)).current;
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value && value !== null) {
      prevRef.current = value;
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.4, duration: 80, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  });

  return anim;
}


function ReadingCard({
  descriptor,
  reading,
}: {
  descriptor: ReadingDescriptor;
  reading: RawSensorPacket | null;
}) {
  const raw = reading ? reading[descriptor.key] : null;
  const isBool = typeof raw === "boolean";
  const numVal = isBool ? null : (raw as number | null);
  const boolVal = isBool ? (raw as boolean) : null;

  const displayValue =
    raw === null
      ? "—"
      : isBool
      ? boolVal
        ? "ДА"
        : "НЕТ"
      : numVal!.toFixed(descriptor.precision);

  const flagged = descriptor.flagFn ? descriptor.flagFn(raw ?? false) : false;
  const flickerOpacity = useFlicker(raw);

  return (
    <View style={[styles.readingCard, flagged && styles.readingCardFlagged]} accessibilityLabel={`${descriptor.label}: ${displayValue} ${descriptor.unit}`}>
      <Text style={styles.readingLabel}>{descriptor.label.toUpperCase()}</Text>
      <Animated.View style={{ opacity: flickerOpacity }}>
        <Text style={styles.readingValue}>
          {displayValue}
          {descriptor.unit ? (
            <Text style={styles.readingUnit}> {descriptor.unit}</Text>
          ) : null}
        </Text>
      </Animated.View>
      {flagged && descriptor.flagLabel && (
        <View style={styles.flagBadge}>
          <Text style={styles.flagBadgeText}>{descriptor.flagLabel}</Text>
        </View>
      )}
    </View>
  );
}


function LiveBadge({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active, pulse]);

  return (
    <View style={[styles.liveBadge, !active && styles.liveBadgeInactive]}>
      <Animated.View style={[styles.liveDot, { opacity: active ? pulse : 0.3 }]} />
      <Text style={[styles.liveText, !active && styles.liveTextInactive]}>
        {active ? "LIVE" : "ПАУЗА"}
      </Text>
    </View>
  );
}


export interface MeasurementScreenProps {
  
  adapter: BleAdapter;
  
  onSubmit?: (reading: RawSensorPacket) => void;
  
  onBack?: () => void;
}

export default function MeasurementScreen({ adapter, onSubmit, onBack }: MeasurementScreenProps) {
  const { status, latestReading, packetCount, error, startSession, stopSession, averagedReading } =
    useMeasurementSession(adapter);

  const isRecording = status === "recording";
  const isStopped = status === "stopped";

  
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isRecording) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  const elapsedStr = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Назад">
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.pageTag}>01 / 03</Text>
            <Text style={styles.pageTitle}>Замер показателей</Text>
          </View>
          <LiveBadge active={isRecording} />
        </View>

        {}
        <Text style={styles.subCaption}>
          {isRecording
            ? "Sensor Box подключён. Идёт сбор данных с объекта."
            : isStopped
            ? "Сбор завершён. Проверьте данные перед отправкой."
            : "Нажмите «Начать», чтобы запустить сбор данных."}
        </Text>

        {}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{packetCount}</Text>
            <Text style={styles.statLabel}>пакетов</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{elapsedStr}</Text>
            <Text style={styles.statLabel}>время</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: status === "error" ? Colors.error : Colors.success }]}>
              {status === "error" ? "ERR" : isRecording ? "OK" : "—"}
            </Text>
            <Text style={styles.statLabel}>статус</Text>
          </View>
        </View>

        {}
        <View style={styles.readingsGrid}>
          {READINGS.map((desc) => (
            <ReadingCard key={desc.key} descriptor={desc} reading={latestReading} />
          ))}
        </View>

        {}
        {status === "error" && error && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {}
        <View style={styles.ctaStack}>
          {status === "idle" && (
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={startSession}
              activeOpacity={0.8}
              accessibilityLabel="Начать сбор данных"
              accessibilityRole="button"
            >
              <Text style={styles.btnPrimaryText}>Начать сбор данных</Text>
            </TouchableOpacity>
          )}

          {isRecording && (
            <TouchableOpacity
              style={styles.btnStop}
              onPress={stopSession}
              activeOpacity={0.8}
              accessibilityLabel="Остановить сбор"
              accessibilityRole="button"
            >
              <Text style={styles.btnStopText}>■ Остановить сбор</Text>
            </TouchableOpacity>
          )}

          {isStopped && (
            <>
              <TouchableOpacity
                style={[styles.btnPrimary, !averagedReading && styles.btnDisabled]}
                onPress={() => averagedReading && onSubmit?.(averagedReading)}
                disabled={!averagedReading}
                activeOpacity={0.8}
                accessibilityLabel="Отправить в AI-модуль"
                accessibilityRole="button"
              >
                <Text style={styles.btnPrimaryText}>Отправить в AI‑модуль →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnGhost}
                onPress={startSession}
                activeOpacity={0.7}
                accessibilityLabel="Повторить замер"
              >
                <Text style={styles.btnGhostText}>Повторить замер</Text>
              </TouchableOpacity>
            </>
          )}

          {status === "error" && (
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={startSession}
              activeOpacity={0.8}
              accessibilityLabel="Попробовать снова"
              accessibilityRole="button"
            >
              <Text style={styles.btnPrimaryText}>Попробовать снова</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.offwhite,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 40,
  },

  
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  backArrow: {
    fontSize: 22,
    color: Colors.ink,
    fontWeight: "300",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
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

  
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.maroon,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  liveBadgeInactive: {
    backgroundColor: Colors.surfaceAlt,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.white,
  },
  liveText: {
    fontFamily: "System",
    fontSize: 9.5,
    fontWeight: "700",
    color: Colors.white,
    letterSpacing: 0.5,
  },
  liveTextInactive: {
    color: Colors.textSecondary,
  },

  
  subCaption: {
    fontFamily: "System",
    fontSize: 12.5,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },

  
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    ...Shadow.card,
  },
  statCell: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  statValue: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 18,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontFamily: "System",
    fontSize: 9.5,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    marginTop: 2,
  },

  
  readingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  readingCard: {
    width: "47.5%",
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border,
    ...Shadow.card,
  },
  readingCardFlagged: {
    borderLeftColor: Colors.maroon,
    backgroundColor: "#fff9f9",
  },
  readingLabel: {
    fontFamily: "System",
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  readingValue: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 22,
    color: Colors.ink,
    letterSpacing: -0.5,
  },
  readingUnit: {
    fontFamily: "System",
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "400",
  },
  flagBadge: {
    marginTop: Spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: Colors.blushLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  flagBadgeText: {
    fontFamily: "System",
    fontSize: 8.5,
    color: Colors.maroon,
    letterSpacing: 0.3,
  },

  
  errorBanner: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.maroon,
  },
  errorText: {
    fontFamily: "System",
    fontSize: 13,
    color: Colors.maroon,
    lineHeight: 18,
  },

  
  ctaStack: {
    gap: Spacing.sm,
  },
  btnPrimary: {
    width: "100%",
    backgroundColor: Colors.maroon,
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: "center",
    ...Shadow.card,
  },
  btnPrimaryText: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 14,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnStop: {
    width: "100%",
    backgroundColor: Colors.ink,
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  btnStopText: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 14,
    color: Colors.white,
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
