import React, { useCallback, useContext, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";

import { apiRequest } from "../api/client";
import { AuthContext } from "../auth/AuthContext";

type HabitFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

type Habit = {
  id: string;
  name: string;
  description?: string | null;
  frequency: HabitFrequency;
  targetCount: number;
  isArchived: boolean;
  createdAt: string;
};

type AnalyticsResponse = {
  habitId: string;
  granularity: HabitFrequency;
  from: string;
  to: string;
  targetCount: number;
  stats: { totalPeriods: number; achievedPeriods: number; completionRate: number; streak: number };
  items: Array<{
    periodStart: string;
    periodEnd: string;
    count: number;
    targetCount: number;
    achieved: boolean;
  }>;
  suggestions: string[];
};

type CheckinsResponse = {
  habitId: string;
  from: string;
  to: string;
  items: Array<{ localDate: string; count: number }>;
};

function dateToLocalDateString(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localDateToDate(localDate: string) {
  const [y, m, d] = localDate.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysUtc(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function HabitDetailScreen(props: {
  navigation: { navigate: (screen: string, params?: unknown) => void };
  route: { params?: { habitId?: string } };
}) {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");
  if (auth.state.status !== "signedIn") return null;

  const token = auth.state.token;
  const habitId = props.route.params?.habitId;
  if (!habitId) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ color: "#666" }}>lack habitId parameter</Text>
      </View>
    );
  }

  const todayLocal = useMemo(() => dateToLocalDateString(new Date()), []);
  const fromLocal = useMemo(() => dateToLocalDateString(addDaysUtc(localDateToDate(todayLocal), -13)), [todayLocal]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [habit, setHabit] = useState<Habit | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [checkins, setCheckins] = useState<CheckinsResponse | null>(null);

  const loadAll = useCallback(async () => {
    const [habitData, analyticsData, checkinsData] = await Promise.all([
      apiRequest<Habit>({ path: `/api/habits/${encodeURIComponent(habitId)}`, token }),
      apiRequest<AnalyticsResponse>({ path: `/api/analytics/habit?habitId=${encodeURIComponent(habitId)}`, token }),
      apiRequest<CheckinsResponse>({
        path: `/api/checkins?habitId=${encodeURIComponent(habitId)}&from=${fromLocal}&to=${todayLocal}`,
        token,
      }),
    ]);
    setHabit(habitData);
    setAnalytics(analyticsData);
    setCheckins(checkinsData);
  }, [fromLocal, habitId, todayLocal, token]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          setLoading(true);
          await loadAll();
        } catch (err: unknown) {
          if (!mounted) return;
          Alert.alert("fail to load\n", err instanceof Error ? err.message : "Please try again later.");
        } finally {
          if (mounted) setLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [loadAll]),
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadAll();
      await auth.refreshMe();
    } catch (err: unknown) {
      Alert.alert("Refresh failed", err instanceof Error ? err.message : "Please try again later.");
    } finally {
      setRefreshing(false);
    }
  }, [auth, loadAll]);

  const countsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of checkins?.items ?? []) map[it.localDate] = it.count;
    return map;
  }, [checkins?.items]);

  const history = useMemo(() => {
    const from = localDateToDate(fromLocal);
    const out: Array<{ localDate: string; count: number }> = [];
    for (let i = 0; i < 14; i += 1) {
      const d = addDaysUtc(from, i);
      const local = dateToLocalDateString(d);
      out.push({ localDate: local, count: countsByDate[local] ?? 0 });
    }
    return out.reverse();
  }, [countsByDate, fromLocal]);

  const todayCount = countsByDate[todayLocal] ?? 0;

  const setTodayCount = useCallback(
    async (next: number) => {
      if (!habit) return;
      try {
        const data = await apiRequest<{ points: number; achieved: boolean }>({
          path: "/api/checkins",
          method: "PUT",
          token,
          body: { habitId: habit.id, localDate: todayLocal, count: next },
        });
        await auth.refreshMe();
        await loadAll();
        if (data.achieved) {
          Alert.alert("Agreed", `This cycle has achieved the goal. Current score:${data.points}`);
        }
      } catch (err: unknown) {
        Alert.alert("operation failure\n", err instanceof Error ? err.message : "Please try again later.");
      }
    },
    [auth, habit, loadAll, todayLocal, token],
  );

  if (loading && !habit) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ color: "#666" }}>loading…</Text>
      </View>
    );
  }

  if (!habit) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ color: "#666" }}>The habit was not found.</Text>
      </View>
    );
  }

  const completionRateText =
    analytics && analytics.stats.totalPeriods > 0 ? `${Math.round(analytics.stats.completionRate * 100)}%` : "—";
  const currentPeriod = analytics?.items?.length ? analytics.items[analytics.items.length - 1] : null;
  const periodCount = currentPeriod?.count ?? todayCount;
  const periodAchieved =
    currentPeriod?.achieved ?? (habit.frequency === "DAILY" ? todayCount >= habit.targetCount : false);
  const periodLabel = habit.frequency === "DAILY" ? "Today" : habit.frequency === "WEEKLY" ? "This week" : "This month";

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 20, fontWeight: "700" }}>{habit.name}</Text>
          <TouchableOpacity
            onPress={() => props.navigation.navigate("HabitForm", { habitId: habit.id })}
            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#ddd" }}
          >
            <Text>edit</Text>
          </TouchableOpacity>
        </View>
        {habit.description ? <Text style={{ color: "#666" }}>{habit.description}</Text> : null}
      </View>

      <View
        style={{
          padding: 12,
          borderWidth: 1,
          borderColor: "#eee",
          borderRadius: 12,
          backgroundColor: "#fff",
          gap: 6,
        }}
      >
        <Text style={{ color: "#666" }}>
            frequency ：{habit.frequency} · Target：{habit.targetCount} Period/Cycle · Start：{dateToLocalDateString(new Date(habit.createdAt))}
        </Text>
        <Text style={{ fontWeight: "700" }}>
          {periodLabel}plan：{periodCount}/{habit.targetCount} {periodAchieved ? "✅" : ""}
        </Text>
        <Text style={{ color: "#666" }}>
            winning streak ：{analytics ? analytics.stats.streak : "—"} · finishing rate ：{completionRateText}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => setTodayCount(Math.min(todayCount + 1, 999))}
            style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#111" }}
            disabled={periodAchieved || habit.isArchived}
          >
            <Text style={{ color: "#fff" }}>{periodAchieved ? "Done" : "+1 "}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTodayCount(Math.max(todayCount - 1, 0))}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#ddd",
            }}
            disabled={todayCount <= 0 || habit.isArchived}
          >
            <Text style={{ color: "#111" }}>-1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTodayCount(0)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#ddd",
            }}
            disabled={todayCount === 0 || habit.isArchived}
          >
            <Text style={{ color: "#111" }}>revocation</Text>
          </TouchableOpacity>
        </View>
        {habit.isArchived ? <Text style={{ color: "#d00" }}>This habit has been archived and cannot be tracked any longer.</Text> : null}
      </View>

      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>The history for the past 14 days</Text>
        <FlatList
          data={history}
          keyExtractor={(it) => it.localDate}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const achieved = item.count >= habit.targetCount && habit.frequency === "DAILY";
            const isToday = item.localDate === todayLocal;
            return (
              <View
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: "#eee",
                  borderRadius: 12,
                  backgroundColor: "#fff",
                  marginBottom: 8,
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontWeight: isToday ? "700" : "400" }}>
                  {item.localDate} {isToday ? "(Today)" : ""}
                </Text>
                <Text style={{ color: "#666" }}>
                  {item.count}/{habit.targetCount} {achieved ? "✅" : ""}
                </Text>
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}
