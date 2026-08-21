/**
 * screens/HistoryScreen/index.tsx
 *
 * TASK 37 — List of past measurement sessions.
 *
 * Fetches GET /measurements on mount, shows:
 *   • Each session as a card: date, building type, material, risk badge
 *   • Tap → load full result → navigate to ResultsScreen
 *   • Pull-to-refresh
 *   • Empty state when no sessions exist
 *   • Error state with retry
 *
 * Navigation: receives onSelectSession(result) prop so WolisNavigator
 * can push ResultsScreen with the loaded WolisResult.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Radius, Shadow, Spacing } from "../../theme";
import { getHistory, getSessionResult } from "../../services/measurementsApi";
import { RiskBadge } from "../../components/RiskBadge";
import type { MeasurementSummary, WolisResult, Status } from "../../types/wolis";

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

// ─── Building type labels ─────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  residential: "Жилой",
  commercial: "Коммерческий",
  historical: "Исторический",
  industrial: "Промышленный",
};
const MAT_LABELS: Record<string, string> = {
  brick: "Кирпич",
  concrete: "Бетон",
  wood: "Дерево",
  mixed: "Смешанный",
};

// ─── Session row card ─────────────────────────────────────────────────────────
interface SessionCardProps {
  item: MeasurementSummary & {
    overall_status?: string | null;
    overall_risk_score?: number | null;
  };
  onPress: () => void;
  loading: boolean;
}

function SessionCard({ item, onPress, loading }: SessionCardProps) {
  const riskStatus = (item.overall_status as Status | null) ?? null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.82}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={`Обследование от ${formatDate(item.session_id)}`}
    >
      {/* Left accent bar */}
      <View
        style={[
          styles.cardAccent,
          {
            backgroundColor:
              riskStatus === "critical"
                ? Colors.maroon
                : riskStatus === "attention"
                ? Colors.warning
                : Colors.success,
          },
        ]}
      />

      <View style={styles.cardBody}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>
              {TYPE_LABELS[item.building_type] ?? item.building_type}
            </Text>
            <Text style={styles.cardMeta}>
              {MAT_LABELS[item.material] ?? item.material}
              {"  ·  "}
              {item.age_years} лет
              {"  ·  "}
              {item.area_m2} м²
            </Text>
          </View>
          {riskStatus && (
            <RiskBadge status={riskStatus} size="sm" />
          )}
        </View>

        {/* Bottom row */}
        <View style={styles.cardBottom}>
          <Text style={styles.cardDate}>
            {formatDate(String(item.session_id))}
          </Text>
          {item.overall_risk_score !== null && item.overall_risk_score !== undefined && (
            <Text style={styles.cardScore}>
              Риск: {Math.round(item.overall_risk_score)}
            </Text>
          )}
          {loading ? (
            <ActivityIndicator size="small" color={Colors.maroon} />
          ) : (
            <Text style={styles.cardArrow}>→</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCircle}>
        <Text style={styles.emptyIcon}>📋</Text>
      </View>
      <Text style={styles.emptyTitle}>Нет обследований</Text>
      <Text style={styles.emptySub}>
        Завершите первый замер, и он появится здесь.
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export interface HistoryScreenProps {
  onSelectSession: (result: WolisResult) => void;
  onBack?: () => void;
}

type HistoryItem = MeasurementSummary & {
  overall_status?: string | null;
  overall_risk_score?: number | null;
};

export default function HistoryScreen({ onSelectSession, onBack }: HistoryScreenProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingList(true);
    setListError(null);
    try {
      // Backend returns MeasurementHistoryItem[] which is a superset of MeasurementSummary
      const data = await getHistory() as HistoryItem[];
      setItems(data);
    } catch (e) {
      setListError((e as Error).message ?? "Не удалось загрузить историю.");
    } finally {
      setLoadingList(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  async function handleSelect(item: HistoryItem) {
    setLoadingId(item.session_id);
    try {
      const result = await getSessionResult(item.session_id);
      onSelectSession(result);
    } catch (e) {
      // Show inline error — don't crash the list
      setListError((e as Error).message ?? "Не удалось загрузить результат.");
    } finally {
      setLoadingId(null);
    }
  }

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
        <Text style={styles.pageTitle}>История</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* ── Error banner ── */}
      {listError && (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorText}>{listError}</Text>
          <TouchableOpacity onPress={() => fetchHistory()} style={styles.retryLink}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ── */}
      {loadingList ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.maroon} />
          <Text style={styles.loadingText}>Загрузка истории…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.session_id}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => (
            <SessionCard
              item={item}
              onPress={() => handleSelect(item)}
              loading={loadingId === item.session_id}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchHistory(true)}
              tintColor={Colors.maroon}
              colors={[Colors.maroon]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    backgroundColor: Colors.offwhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.ink, fontWeight: "300" },
  pageTitle: { fontFamily: "System", fontWeight: "700", fontSize: 20, color: Colors.ink },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.errorBg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#ffd0d0",
  },
  errorText: { fontFamily: "System", fontSize: 12.5, color: Colors.maroon, flex: 1 },
  retryLink: { paddingLeft: Spacing.md },
  retryText: { fontFamily: "System", fontWeight: "700", fontSize: 12.5, color: Colors.maroon },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
  loadingText: { fontFamily: "System", fontSize: 13, color: Colors.textSecondary },

  listContent: {
    padding: Spacing.lg,
  },
  listEmpty: {
    flex: 1,
    justifyContent: "center",
  },

  // Session card
  card: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    ...Shadow.card,
  },
  cardAccent: {
    width: 4,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  cardTitle: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 14.5,
    color: Colors.ink,
    marginBottom: 2,
  },
  cardMeta: {
    fontFamily: "System",
    fontSize: 11.5,
    color: Colors.textSecondary,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  cardDate: {
    fontFamily: "System",
    fontSize: 11,
    color: Colors.textTertiary,
    flex: 1,
  },
  cardScore: {
    fontFamily: "System",
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  cardArrow: {
    fontSize: 16,
    color: Colors.blushDark,
    fontWeight: "300",
  },

  // Empty state
  emptyWrap: { alignItems: "center", paddingVertical: Spacing.xxxl },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.blushLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontFamily: "System", fontWeight: "700", fontSize: 18, color: Colors.ink, marginBottom: Spacing.sm },
  emptySub: { fontFamily: "System", fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 18, paddingHorizontal: Spacing.xl },
});
