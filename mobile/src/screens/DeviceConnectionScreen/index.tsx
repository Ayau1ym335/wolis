/**
 * screens/DeviceConnectionScreen/index.tsx
 *
 * TASK 30 — Экран подключения к Sensor Box.
 *
 * States handled:
 *   disconnected (no device)  →  "Scan" button
 *   scanning                  →  animated scanner ring
 *   disconnected (device found) →  device card + "Connect" button
 *   connecting                →  pulse animation
 *   connected                 →  success state + "Start Measurement" CTA
 *   error                     →  error pill + retry
 *
 * Design language: Wolis brand tokens — maroon #731919, blush #bfa4b8,
 * ink #141616, offwhite #f5f5f7.  Fraunces serif headings, IBM Plex Mono
 * for status labels and values.
 */

import React, { useEffect, useRef } from "react";
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
import { useBleDevice } from "../../features/ble_connection/useBleDevice";
import { DEVICE_NAME_PREFIX } from "../../features/ble_connection/bleadapter";

// ─── Sensor chip labels ──────────────────────────────────────────────────────
const SENSOR_CHIPS = ["BME280", "BH1750", "MPU6050", "SW-420"] as const;

// ─── Status metadata ──────────────────────────────────────────────────────────
const STATUS_META = {
  disconnected: { label: "Не подключён", color: Colors.textSecondary },
  scanning: { label: "Сканирование…", color: Colors.warning },
  connecting: { label: "Подключение…", color: Colors.warning },
  connected: { label: "Подключён", color: Colors.success },
  error: { label: "Ошибка", color: Colors.error },
} as const;

// ─── Animated ring ────────────────────────────────────────────────────────────
function ScanRing({ active }: { active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      opacity.setValue(0.8);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.35, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [active, scale, opacity]);

  return (
    <View style={styles.ringContainer}>
      {/* Pulsing ring */}
      <Animated.View
        style={[
          styles.ringOuter,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
      {/* Static inner circle */}
      <View style={styles.ringInner}>
        <Text style={styles.ringIcon}>{active ? "⟳" : "◉"}</Text>
      </View>
    </View>
  );
}

// ─── Wolis logo mark ──────────────────────────────────────────────────────────
function WolisLogo() {
  return (
    <View style={styles.logoRow} accessibilityLabel="Wolis logo">
      <Text style={styles.logoLetters}>W</Text>
      <View style={styles.logoO}>
        <View style={styles.logoOInner} />
      </View>
      <Text style={styles.logoLetters}>LIS</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export interface DeviceConnectionScreenProps {
  /** Called when device is confirmed connected — navigate to MeasurementScreen */
  onConnected?: () => void;
}

export default function DeviceConnectionScreen({ onConnected }: DeviceConnectionScreenProps) {
  const { status, device, error, scan, connect, disconnect } = useBleDevice();

  const statusMeta = STATUS_META[status] ?? STATUS_META.disconnected;
  const isScanning = status === "scanning";
  const isConnecting = status === "connecting";
  const isConnected = status === "connected";
  const isBusy = isScanning || isConnecting;
  const hasDevice = device !== null;

  // Dot blink when busy
  const dotOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isBusy) {
      dotOpacity.setValue(1);
      return;
    }
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [isBusy, dotOpacity]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Logo lock-up ── */}
        <View style={styles.logoLockup}>
          <WolisLogo />
          <Text style={styles.tagline}>WHERE BUILDINGS MEET THE FUTURE</Text>
        </View>

        {/* ── Scan animation ── */}
        <ScanRing active={isBusy || isConnected} />

        {/* ── Status pill ── */}
        <View style={[styles.statusPill, isConnected && styles.statusPillConnected]}>
          <Animated.View style={[styles.statusDot, { backgroundColor: statusMeta.color, opacity: dotOpacity }]} />
          <Text style={[styles.statusLabel, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>

        {/* ── Device card (once found) ── */}
        {hasDevice && (
          <View style={[styles.card, styles.deviceCard]} accessibilityLabel="Discovered device card">
            <Text style={styles.deviceCardEyebrow}>SENSOR BOX ОБНАРУЖЕН</Text>
            <Text style={styles.deviceCardName}>{device!.name ?? "Wolis-SensorBox"}</Text>
            <Text style={styles.deviceCardId} numberOfLines={1} ellipsizeMode="middle">
              ID: {device!.id}
            </Text>

            {/* Sensor chips */}
            <View style={styles.chipRow}>
              {SENSOR_CHIPS.map((chip) => (
                <View key={chip} style={styles.sensorChip}>
                  <Text style={styles.sensorChipText}>{chip}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Error banner ── */}
        {status === "error" && error && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* ── CTA area ── */}
        <View style={styles.ctaStack}>
          {!isConnected && !hasDevice && (
            <TouchableOpacity
              style={[styles.btnPrimary, isBusy && styles.btnDisabled]}
              onPress={scan}
              disabled={isBusy}
              activeOpacity={0.8}
              accessibilityLabel="Начать сканирование"
              accessibilityRole="button"
            >
              <Text style={styles.btnPrimaryText}>
                {isScanning ? "Сканирование…" : "Сканировать устройства"}
              </Text>
            </TouchableOpacity>
          )}

          {hasDevice && !isConnected && (
            <>
              <TouchableOpacity
                style={[styles.btnPrimary, isBusy && styles.btnDisabled]}
                onPress={connect}
                disabled={isBusy}
                activeOpacity={0.8}
                accessibilityLabel="Подключить Sensor Box"
                accessibilityRole="button"
              >
                <Text style={styles.btnPrimaryText}>
                  {isConnecting ? "Подключение…" : "Подключить Sensor Box"}
                </Text>
              </TouchableOpacity>
              {!isBusy && (
                <TouchableOpacity
                  style={styles.btnGhost}
                  onPress={scan}
                  activeOpacity={0.7}
                  accessibilityLabel="Повторить сканирование"
                >
                  <Text style={styles.btnGhostText}>Сканировать снова</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {isConnected && (
            <>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={onConnected}
                activeOpacity={0.8}
                accessibilityLabel="Начать замер"
                accessibilityRole="button"
              >
                <Text style={styles.btnPrimaryText}>Начать замер →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnGhost}
                onPress={disconnect}
                activeOpacity={0.7}
                accessibilityLabel="Отключиться"
              >
                <Text style={styles.btnGhostText}>Отключиться</Text>
              </TouchableOpacity>
            </>
          )}

          {status === "error" && (
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={scan}
              activeOpacity={0.8}
              accessibilityLabel="Повторить"
              accessibilityRole="button"
            >
              <Text style={styles.btnPrimaryText}>Попробовать снова</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Bottom caption ── */}
        <Text style={styles.caption}>
          {"Убедитесь, что Sensor Box включён\nи находится рядом."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.offwhite,
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 40,
  },

  // Logo
  logoLockup: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  logoLetters: {
    fontFamily: "System",
    fontWeight: "900",
    fontSize: 36,
    color: Colors.ink,
    letterSpacing: -1,
    lineHeight: 40,
  },
  logoO: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.maroon,
    marginHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  logoOInner: {
    width: 8,
    height: 16,
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  tagline: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 2.5,
    color: Colors.blushDark,
    textAlign: "center",
  },

  // Animated ring
  ringContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  ringOuter: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: Colors.maroon,
  },
  ringInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.maroon,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.elevated,
  },
  ringIcon: {
    fontSize: 28,
    color: Colors.white,
  },

  // Status pill
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.blushLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    marginBottom: Spacing.xl,
  },
  statusPillConnected: {
    backgroundColor: Colors.successBg,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontFamily: "System",
    fontSize: 11,
    letterSpacing: 0.4,
  },

  // Device card
  card: {
    width: "100%",
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    ...Shadow.card,
  },
  deviceCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.maroon,
  },
  deviceCardEyebrow: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 0.8,
    color: Colors.blushDark,
    marginBottom: Spacing.xs,
  },
  deviceCardName: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 17,
    color: Colors.ink,
    marginBottom: 2,
  },
  deviceCardId: {
    fontFamily: "System",
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  sensorChip: {
    backgroundColor: Colors.offwhite,
    borderWidth: 1,
    borderColor: Colors.blush,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  sensorChipText: {
    fontFamily: "System",
    fontSize: 10.5,
    color: Colors.maroonDark,
    letterSpacing: 0.3,
  },

  // Error banner
  errorBanner: {
    width: "100%",
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.maroon,
  },
  errorBannerText: {
    fontFamily: "System",
    fontSize: 13,
    color: Colors.maroon,
    lineHeight: 18,
  },

  // CTAs
  ctaStack: {
    width: "100%",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  btnPrimary: {
    width: "100%",
    backgroundColor: Colors.maroon,
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.card,
  },
  btnDisabled: {
    opacity: 0.55,
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
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  btnGhostText: {
    fontFamily: "System",
    fontWeight: "600",
    fontSize: 14,
    color: Colors.ink,
  },

  // Caption
  caption: {
    fontFamily: "System",
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: "center",
    lineHeight: 18,
  },
});
