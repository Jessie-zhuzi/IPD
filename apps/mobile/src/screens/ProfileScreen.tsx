import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useContext, useMemo, useState } from "react";
import { Alert, Button, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";

import { apiRequest } from "../api/client";
import { AuthContext } from "../auth/AuthContext";
import { AssetIcon } from "../components/AssetIcon";

type AssetItem = {
  assetKey: string;
  type: "AVATAR" | "BADGE";
  name: string;
  costPoints: number;
  owned: boolean;
};

export function ProfileScreen() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");
  if (auth.state.status !== "signedIn") return null;

  const token = auth.state.token;
  const signedInUser = auth.state.user;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatars, setAvatars] = useState<AssetItem[]>([]);
  const [badges, setBadges] = useState<AssetItem[]>([]);

  const currentAvatar = useMemo(() => avatars.find((a) => a.assetKey === signedInUser.avatarKey) ?? null, [avatars, signedInUser.avatarKey]);

  const load = useCallback(async () => {
    const [avatarsData, badgesData] = await Promise.all([
      apiRequest<{ items: AssetItem[] }>({ path: "/api/assets?type=AVATAR", token }),
      apiRequest<{ items: AssetItem[] }>({ path: "/api/assets?type=BADGE", token }),
    ]);
    setAvatars(avatarsData.items);
    setBadges(badgesData.items);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          setLoading(true);
          await load();
        } catch (err: unknown) {
          if (!mounted) return;
          Alert.alert("fail to load", err instanceof Error ? err.message : "Please try again later.");
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
      await load();
      await auth.refreshMe();
    } catch (err: unknown) {
      Alert.alert("Refresh failed", err instanceof Error ? err.message : "Please try again later.");
    } finally {
      setRefreshing(false);
    }
  }, [auth, load]);

  const ownedBadges = useMemo(() => badges.filter((b) => b.owned), [badges]);

  const setAvatar = useCallback(
    async (assetKey: string) => {
      try {
        await apiRequest({
          path: "/api/me/avatar",
          method: "POST",
          token,
          body: { assetKey },
        });
        await auth.refreshMe();
        await load();
        Alert.alert("Headshot updated");
      } catch (err: unknown) {
        Alert.alert("Setup failed", err instanceof Error ? err.message : "Please try again later.");
      }
    },
    [auth, load, token],
  );

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={avatars}
      keyExtractor={(it) => it.assetKey}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: "700" }}>Mine</Text>
          <Text>nickname ：{signedInUser.displayName}</Text>
          <Text>integral：{signedInUser.points}</Text>

          <View style={{ padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12, backgroundColor: "#fff", gap: 6 }}>
            <Text style={{ fontWeight: "700" }}>Current profile picture</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <AssetIcon assetKey={signedInUser.avatarKey ?? "avatar_default"} size={52} />
              <View style={{ gap: 4 }}>
                <Text style={{ color: "#666" }}>{signedInUser.avatarKey ?? "avatar_default"}</Text>
                {currentAvatar ? <Text style={{ color: "#666" }}>{currentAvatar.name}</Text> : null}
              </View>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "700" }}>Profile picture list (optional)</Text>
            {loading ? <Text style={{ color: "#666" }}>loading...</Text> : null}
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={{ color: "#666" }}>No profile picture available.</Text>}
      renderItem={({ item }) => {
        const isCurrent = (signedInUser.avatarKey ?? "avatar_default") === item.assetKey;
        const canUse = item.owned || item.costPoints <= 0;
        return (
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <AssetIcon assetKey={item.assetKey} size={44} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontWeight: "700" }}>{item.name}</Text>
                <Text style={{ color: "#666" }}>
                  {item.assetKey} · {item.costPoints <= 0 ? "Free" : `${item.costPoints} integral`} · {item.owned ? "Already owned\n" : "Not having"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setAvatar(item.assetKey)}
              disabled={!canUse || isCurrent}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: !canUse || isCurrent ? "#ddd" : "#111",
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ color: "#fff" }}>{isCurrent ? "Currently in use" : canUse ? "Already owned\n" : "Not having"}</Text>
            </TouchableOpacity>
          </View>
        );
      }}
      ListFooterComponent={
        <View style={{ gap: 12, paddingTop: 12 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "700" }}>My badge</Text>
            {ownedBadges.length === 0 ? (
              <Text style={{ color: "#666" }}>You don't have any badges yet. Go to the "Exchange" page and get one.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {ownedBadges.slice(0, 6).map((b) => (
                  <View
                    key={b.assetKey}
                    style={{
                      padding: 12,
                      borderWidth: 1,
                      borderColor: "#eee",
                      borderRadius: 12,
                      backgroundColor: "#fff",
                      gap: 4,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <AssetIcon assetKey={b.assetKey} size={44} rounded={false} />
                      <View style={{ gap: 4 }}>
                        <Text style={{ fontWeight: "700" }}>{b.name}</Text>
                        <Text style={{ color: "#666" }}>{b.assetKey}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Button
            title="log out"
            onPress={() => {
              Alert.alert("Sure？", "", [
                { text: "Off", style: "cancel" },
                { text: "Out", style: "destructive", onPress: () => auth.logout() },
              ]);
            }}
          />
        </View>
      }
    />
  );
}
