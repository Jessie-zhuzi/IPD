import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Button, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

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

function dateToLocalDateString(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function FrequencyPicker(props: { value: HabitFrequency; onChange: (v: HabitFrequency) => void }) {
  const items: Array<{ key: HabitFrequency; label: string }> = [
    { key: "DAILY", label: "Everyday" },
    { key: "WEEKLY", label: "Every week" },
    { key: "MONTHLY", label: "Every month" },
  ];

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {items.map((it) => {
        const active = props.value === it.key;
        return (
          <TouchableOpacity
            key={it.key}
            onPress={() => props.onChange(it.key)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              backgroundColor: active ? "#111" : "#fff",
              borderWidth: 1,
              borderColor: active ? "#111" : "#ddd",
            }}
          >
            <Text style={{ color: active ? "#fff" : "#111", fontWeight: "600" }}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function HabitFormScreen(props: {
  navigation: { goBack: () => void };
  route?: { params?: { habitId?: string } };
}) {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");
  if (auth.state.status !== "signedIn") return null;

  const token = auth.state.token;
  const habitId = props.route?.params?.habitId;
  const isEdit = Boolean(habitId);

  const today = useMemo(() => dateToLocalDateString(new Date()), []);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [startDateText, setStartDateText] = useState(today);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<HabitFrequency>("DAILY");
  const [targetCountText, setTargetCountText] = useState("1");

  const loadHabit = useCallback(async () => {
    if (!habitId) return;
    const habit = await apiRequest<Habit>({ path: `/api/habits/${encodeURIComponent(habitId)}`, token });
    setName(habit.name);
    setDescription(habit.description ?? "");
    setFrequency(habit.frequency);
    setTargetCountText(String(habit.targetCount));
    setStartDateText(dateToLocalDateString(new Date(habit.createdAt)));
  }, [habitId, token]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!habitId) return;
      try {
        setLoading(true);
        await loadHabit();
      } catch (err: unknown) {
        if (!mounted) return;
        Alert.alert("fail to load\n", err instanceof Error ? err.message : "Please try again later.");
        props.navigation.goBack();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [habitId, loadHabit, props.navigation]);

  const parsedTargetCount = Number(targetCountText);
  const validName = name.trim().length > 0;
  const validTarget = Number.isFinite(parsedTargetCount) && Number.isInteger(parsedTargetCount) && parsedTargetCount >= 1 && parsedTargetCount <= 999;
  const canSubmit = validName && validTarget && !loading && !submitting;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const body = {
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        frequency,
        targetCount: parsedTargetCount,
      };
      if (habitId) {
        await apiRequest({
          path: `/api/habits/${encodeURIComponent(habitId)}`,
          method: "PUT",
          token,
          body,
        });
        Alert.alert("Save successfully", "Updated habit information");
      } else {
        await apiRequest({
          path: "/api/habits",
          method: "POST",
          token,
          body,
        });
        Alert.alert("Success in creation", "A new habit has been formed.");
      }
      props.navigation.goBack();
    } catch (err: unknown) {
      Alert.alert(isEdit ? "Fail in keeping\n" : "Creation failed", err instanceof Error ? err.message : "Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, description, frequency, habitId, isEdit, name, parsedTargetCount, props.navigation, token]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>{isEdit ? "Editing habits" : "Establishing habits"}</Text>

      {loading ? <Text style={{ color: "#666" }}>loading…</Text> : null}

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>name</Text>
        <TextInput
          placeholder="For example: Drink water every day"
          value={name}
          onChangeText={setName}
          style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 10, backgroundColor: "#fff" }}
        />
        {!validName ? <Text style={{ color: "#d00" }}>The name cannot be left blank.</Text> : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>frequency</Text>
        <FrequencyPicker value={frequency} onChange={setFrequency} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Number of attempts</Text>
        <TextInput
          placeholder="eg：3"
          keyboardType="number-pad"
          value={targetCountText}
          onChangeText={(t) => setTargetCountText(t.replace(/[^\d]/g, ""))}
          style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 10, backgroundColor: "#fff" }}
        />
        {!validTarget ? <Text style={{ color: "#d00" }}>The target number must be an integer ranging from 1 to 999.</Text> : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>start date</Text>
        <TextInput
          editable={false}
          value={startDateText}
          style={{
            borderWidth: 1,
            borderColor: "#eee",
            padding: 12,
            borderRadius: 10,
            backgroundColor: "#f6f6f6",
            color: "#666",
          }}
        />
        <Text style={{ color: "#666" }}>The start date is defaulted to be equal to the creation date.</Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Note (Optional)</Text>
        <TextInput
          placeholder="eg：Once every 1 cup"
          value={description}
          onChangeText={setDescription}
          style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 10, backgroundColor: "#fff" }}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Button title={submitting ? "uploading" : isEdit ? "save" : "create"} onPress={onSubmit} disabled={!canSubmit} />
        <Button title="cancel" onPress={() => props.navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

