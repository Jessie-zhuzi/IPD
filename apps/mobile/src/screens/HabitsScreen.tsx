import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useContext, useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";

import { AuthContext } from "../auth/AuthContext";
import { apiRequest } from "../api/client";
import { StatusBlock } from "../components/StatusBlock";

type Habit = {
  id: string;
  name: string;
  description?: string | null;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  targetCount: number;
  isArchived: boolean;
};

type ProgressItem = {
  periodStart: string;
  periodEnd: string;
  count: number;
  targetCount: number;
  achieved: boolean;
};

function toLocalDateString(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function HabitsScreen(props: { navigation: { navigate: (screen: string, params?: unknown) => void } }) {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");
  if (auth.state.status !== "signedIn") return null;

  const token = auth.state.token;
  const today = useMemo(() => toLocalDateString(new Date()), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayCounts, setTodayCounts] = useState<Record<string, number>>({});
  const [periodProgress, setPeriodProgress] = useState<Record<string, ProgressItem>>({});

  const load = useCallback(async () => {
    const res = await apiRequest<{ items: Habit[] }>({
      path: "/api/habits?page=1&pageSize=50&includeArchived=false&sort=createdAt_desc",
      token,
    });
    const list = res.items;
    setHabits(list);

    const [countPairs, progressPairs] = await Promise.all([
      Promise.all(
        list.map(async (h) => {
          const data = await apiRequest<{ items: Array<{ localDate: string; count: number }> }>({
            path: `/api/checkins?habitId=${encodeURIComponent(h.id)}&from=${today}&to=${today}`,
            token,
          });
          const count = data.items[0]?.count ?? 0;
          return [h.id, count] as const;
        }),
      ),
      Promise.all(
        list.map(async (h) => {
          const data = await apiRequest<{ items: ProgressItem[] }>({
            path: `/api/checkins/progress?habitId=${encodeURIComponent(h.id)}&from=${today}&to=${today}&granularity=AUTO`,
            token,
          });
          const item =
            data.items[0] ??
            ({
              periodStart: today,
              periodEnd: today,
              count: 0,
              targetCount: h.targetCount,
              achieved: false,
            } satisfies ProgressItem);
          return [h.id, item] as const;
        }),
      ),
    ]);
    const map: Record<string, number> = {};
    for (const [id, c] of countPairs) map[id] = c;
    setTodayCounts(map);

    const progressMap: Record<string, ProgressItem> = {};
    for (const [id, it] of progressPairs) progressMap[id] = it;
    setPeriodProgress(progressMap);
  }, [token, today]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          setLoading(true);
          setErrorMessage(null);
          await load();
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
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMessage(null);
      await load();
      await auth.refreshMe();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Please try again later.");
    } finally {
      setRefreshing(false);
    }
  }, [auth, load]);

  const onQuickCheckin = useCallback(
    async (habit: Habit) => {
      const current = todayCounts[habit.id] ?? 0;
      const next = current + 1;
      try {
        const data = await apiRequest<{ points: number; achieved: boolean }>({
          path: "/api/checkins",
          method: "PUT",
          token,
          body: { habitId: habit.id, localDate: today, count: next },
        });
        setTodayCounts((prev) => ({ ...prev, [habit.id]: next }));
        const progress = await apiRequest<{ items: ProgressItem[] }>({
          path: `/api/checkins/progress?habitId=${encodeURIComponent(habit.id)}&from=${today}&to=${today}&granularity=AUTO`,
          token,
        });
        const item = progress.items[0];
        if (item) setPeriodProgress((prev) => ({ ...prev, [habit.id]: item }));
        await auth.refreshMe();
        if (data.achieved) {
          Alert.alert("Over！", `It is finished today「${habit.name}」Target, current score：${data.points}`);
        }
      } catch (err: unknown) {
        Alert.alert("Failed to clock in", err instanceof Error ? err.message : "Please try again later.");
      }
    },
    [auth, token, today, todayCounts],
  );

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 20, fontWeight: "700" }}>habit</Text>
            <Text style={{ color: "#666" }}>
              today（{today}） · integral：{auth.state.user.points}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => props.navigation.navigate("HabitForm")}
            style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#111" }}
          >
            <Text style={{ color: "#fff" }}>Create habits</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && habits.length === 0 ? (
        <StatusBlock variant="loading" message="Loading the habit list..." />
      ) : errorMessage && habits.length === 0 ? (
        <StatusBlock variant="error" message={errorMessage} onRetry={onRefresh} />
      ) : (
        <FlatList
          data={habits}
          keyExtractor={(h) => h.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<StatusBlock variant="empty" message="You haven't got used to it yet. Go to the 'Create a Habit' page and add one." />}
          renderItem={({ item }) => {
            const progress = periodProgress[item.id];
            const progressCount = progress?.count ?? (todayCounts[item.id] ?? 0);
            const achieved = progress?.achieved ?? progressCount >= item.targetCount;
            const label = item.frequency === "DAILY" ? "Today" : item.frequency === "WEEKLY" ? "This week" : "This month";
            return (
              <View
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#eee",
                  borderRadius: 12,
                  marginBottom: 10,
                  backgroundColor: "#fff",
                  gap: 6,
                }}
              >
                <TouchableOpacity onPress={() => props.navigation.navigate("HabitDetail", { habitId: item.id })}>
                  <Text style={{ fontSize: 16, fontWeight: "700" }}>{item.name}</Text>
                </TouchableOpacity>
                <Text style={{ color: "#666" }}>
                  frequency ：{item.frequency} · {label}Plan：{progressCount}/{item.targetCount} {achieved ? "✅" : ""}
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => onQuickCheckin(item)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      backgroundColor: achieved ? "#ddd" : "#111",
                    }}
                    disabled={achieved}
                  >
                    <Text style={{ color: "#fff" }}>{achieved ? "Finished" : "+1 "}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => props.navigation.navigate("HabitForm", { habitId: item.id })}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      backgroundColor: "#fff",
                      borderWidth: 1,
                      borderColor: "#ddd",
                    }}
                  >
                    <Text style={{ color: "#111" }}>edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
