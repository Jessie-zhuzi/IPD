import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useContext, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { apiRequest } from "../api/client";
import { AuthContext } from "../auth/AuthContext";
import { StatusBlock } from "../components/StatusBlock";

type HabitFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

type Habit = {
  id: string;
  name: string;
  frequency: HabitFrequency;
  targetCount: number;
  isArchived: boolean;
};

type AnalyticsResponse = {
  habitId: string;
  granularity: HabitFrequency;
  from: string;
  to: string;
  targetCount: number;
  stats: { totalPeriods: number; achievedPeriods: number; completionRate: number; streak: number };
  items: Array<{ periodStart: string; periodEnd: string; count: number; targetCount: number; achieved: boolean }>;
  suggestions: string[];
};

function formatLabel(granularity: HabitFrequency, periodStart: string) {
  if (granularity === "MONTHLY") return periodStart.slice(0, 7);
  return periodStart.slice(5);
}

export function AnalyticsScreen() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");
  if (auth.state.status !== "signedIn") return null;

  const token = auth.state.token;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);

  const loadAll = useCallback(
    async (preferredHabitId: string | null) => {
      const habitsRes = await apiRequest<{ items: Habit[] }>({
        path: "/api/habits?page=1&pageSize=50&includeArchived=false&sort=createdAt_desc",
        token,
      });
      const list = habitsRes.items;
      setHabits(list);

      const chosen =
        preferredHabitId && list.some((h) => h.id === preferredHabitId) ? preferredHabitId : list[0]?.id ?? null;
      setSelectedHabitId(chosen);

      if (!chosen) {
        setAnalytics(null);
        return;
      }

      const data = await apiRequest<AnalyticsResponse>({
        path: `/api/analytics/habit?habitId=${encodeURIComponent(chosen)}`,
        token,
      });
      setAnalytics(data);
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          setLoading(true);
          setErrorMessage(null);
          await loadAll(selectedHabitId);
        } catch (err: unknown) {
          if (!mounted) return;
          setErrorMessage(err instanceof Error ? err.message : "Please try again later.");
        } finally {
          if (mounted) setLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [loadAll, selectedHabitId]),
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMessage(null);
      await loadAll(selectedHabitId);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Please try again later.");
    } finally {
      setRefreshing(false);
    }
  }, [loadAll, selectedHabitId]);

  const onSelectHabit = useCallback(
    async (habitId: string) => {
      try {
        setSelectedHabitId(habitId);
        setErrorMessage(null);
        const data = await apiRequest<AnalyticsResponse>({
          path: `/api/analytics/habit?habitId=${encodeURIComponent(habitId)}`,
          token,
        });
        setAnalytics(data);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Please try again later.");
      }
    },
    [token],
  );

  const selectedHabit = useMemo(() => habits.find((h) => h.id === selectedHabitId) ?? null, [habits, selectedHabitId]);

  const chartItems = useMemo(() => {
    if (!analytics) return [];
    const items = analytics.items;
    return items.length <= 7 ? items : items.slice(items.length - 7);
  }, [analytics]);

  const completionRateText =
    analytics && analytics.stats.totalPeriods > 0 ? `${Math.round(analytics.stats.completionRate * 100)}%` : "—";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>analyse</Text>

      {loading ? <Text style={{ color: "#666" }}>loading…</Text> : null}

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>Choosing habits</Text>
        {errorMessage && habits.length === 0 ? (
          <StatusBlock variant="error" message={errorMessage} onRetry={onRefresh} />
        ) : habits.length === 0 ? (
          <StatusBlock variant="empty" message="You haven't gotten used to it yet. Go to the 'Habit' page and create one first." />
        ) : (
          <FlatList
            horizontal
            data={habits}
            keyExtractor={(h) => h.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const active = item.id === selectedHabitId;
              return (
                <TouchableOpacity
                  onPress={() => onSelectHabit(item.id)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: active ? "#111" : "#fff",
                    borderWidth: 1,
                    borderColor: active ? "#111" : "#ddd",
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: active ? "#fff" : "#111" }}>{item.name}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {selectedHabit && analytics ? (
        <>
          <View style={{ padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12, backgroundColor: "#fff", gap: 6 }}>
            <Text style={{ fontWeight: "700" }}>Statistical card</Text>
            <Text style={{ color: "#666" }}>
                frequency：{selectedHabit.frequency} · target ：{selectedHabit.targetCount} period/ cycle
            </Text>
            <Text style={{ color: "#666" }}>
                winning streak ：{analytics.stats.streak} · percentage complete ：{completionRateText} · conclude：{analytics.stats.achievedPeriods}/{analytics.stats.totalPeriods}
            </Text>
          </View>

          <View style={{ padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12, backgroundColor: "#fff", gap: 10 }}>
            <Text style={{ fontWeight: "700" }}>Progress trend (the last 7 cycles)）</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, height: 110 }}>
              {chartItems.map((it) => {
                const ratio = it.targetCount <= 0 ? 0 : Math.min(it.count / it.targetCount, 1);
                const barH = Math.round(ratio * 80);
                return (
                  <View key={it.periodStart} style={{ alignItems: "center", width: 36, gap: 6 }}>
                    <View
                      style={{
                        height: 80,
                        width: 18,
                        borderRadius: 6,
                        backgroundColor: "#f0f0f0",
                        justifyContent: "flex-end",
                        overflow: "hidden",
                      }}
                    >
                      <View style={{ height: barH, backgroundColor: it.achieved ? "#111" : "#999" }} />
                    </View>
                    <Text style={{ color: "#666", fontSize: 12 }}>{formatLabel(analytics.granularity, it.periodStart)}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={{ color: "#666" }}>
                scope of statistics ：{analytics.from} ~ {analytics.to}
            </Text>
          </View>

          <View style={{ padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12, backgroundColor: "#fff", gap: 8 }}>
            <Text style={{ fontWeight: "700" }}>recommendations for improvement</Text>
            {analytics.suggestions.length === 0 ? (
              <Text style={{ color: "#666" }}>No suggestions for the time being</Text>
            ) : (
              <View style={{ gap: 6 }}>
                {analytics.suggestions.map((s, idx) => (
                  <Text key={`${idx}-${s}`} style={{ color: "#333" }}>
                    • {s}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
