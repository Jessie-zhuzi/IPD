import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useContext, useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";

import { apiRequest } from "../api/client";
import { AuthContext } from "../auth/AuthContext";
import { AssetIcon } from "../components/AssetIcon";
import { StatusBlock } from "../components/StatusBlock";

type AssetItem = {
  assetKey: string;
  type: "AVATAR" | "BADGE";
  name: string;
  costPoints: number;
  owned: boolean;
};

type PointRules = {
  baseAchievePoints: number;
  streakBonusPerPeriod: number;
  maxLookbackDays: number;
  maxLookbackWeeks: number;
  maxLookbackMonths: number;
};

export function GamificationScreen() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");
  if (auth.state.status !== "signedIn") return null;

  const token = auth.state.token;
  const signedInUser = auth.state.user;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rules, setRules] = useState<PointRules | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);

  const load = useCallback(async () => {
    const [rulesData, assetsData] = await Promise.all([
      apiRequest<PointRules>({ path: "/api/gamification/rules", token }),
      apiRequest<{ items: AssetItem[] }>({ path: "/api/assets", token }),
    ]);
    setRules(rulesData);
    setAssets(assetsData.items);
  }, [token]);

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

  const redeemable = useMemo(
    () => assets.filter((a) => a.costPoints > 0).sort((a, b) => a.type.localeCompare(b.type) || a.costPoints - b.costPoints),
    [assets],
  );

  const onRedeem = useCallback(
    async (asset: AssetItem) => {
      Alert.alert("Confirm the exchange？", `${asset.name}（${asset.costPoints} 积分）`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Conversion",
          style: "default",
          onPress: async () => {
            try {
              const res = await apiRequest<{ points: number }>({
                path: "/api/gamification/redeem",
                method: "POST",
                token,
                body: { assetKey: asset.assetKey },
              });
              await auth.refreshMe();
              await load();
              Alert.alert("Redemption successful", `Remaining integral：${res.points}`);
            } catch (err: unknown) {
              Alert.alert("Redemption failed", err instanceof Error ? err.message : "Please try again later.");
            }
          },
        },
      ]);
    },
    [auth, load, token],
  );

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>oCnversion</Text>
      <Text style={{ color: "#666" }}>Current integral：{signedInUser.points}</Text>

      <View style={{ padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12, backgroundColor: "#fff", gap: 6 }}>
        <Text style={{ fontWeight: "700" }}>Integration rule</Text>
        <Text style={{ color: "#666" }}>
          Complete a cycle：+{rules ? rules.baseAchievePoints : "—"} Points; Winning streak bonus: For each winning streak +{rules ? rules.streakBonusPerPeriod : "—"} integral
        </Text>
      </View>

      {loading && redeemable.length === 0 ? (
        <StatusBlock variant="loading" message="The redeemable list is loading..." />
      ) : errorMessage && redeemable.length === 0 ? (
        <StatusBlock variant="error" message={errorMessage} onRetry={onRefresh} />
      ) : (
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={{ fontWeight: "700" }}>List of redeemable items</Text>
          <FlatList
            data={redeemable}
            keyExtractor={(it) => it.assetKey}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<StatusBlock variant="empty" message="There are no redeemable items available for the moment." />}
            renderItem={({ item }) => {
              const disabled = item.owned || signedInUser.points < item.costPoints;
              const hint = item.owned ? "Already owned\n" : signedInUser.points < item.costPoints ? "Insufficient points" : "Convertible";
              return (
                <View
                  style={{
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#eee",
                    borderRadius: 12,
                    backgroundColor: "#fff",
                    marginBottom: 10,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <AssetIcon assetKey={item.assetKey} size={44} rounded={item.type === "AVATAR"} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700" }}>
                        {item.name} · {item.type}
                      </Text>
                      <Text style={{ color: "#666" }}>
                        Price：{item.costPoints} Integral · State：{hint}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => onRedeem(item)}
                    disabled={disabled}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      backgroundColor: disabled ? "#ddd" : "#111",
                      alignSelf: "flex-start",
                    }}
                  >
                    <Text style={{ color: "#fff" }}>{item.owned ? "Already owned" : "Conversion\n"}</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}
