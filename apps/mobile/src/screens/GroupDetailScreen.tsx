// import { useFocusEffect } from "@react-navigation/native";
// import React, { useCallback, useContext, useMemo, useState } from "react";
// import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
//
// import { apiRequest } from "../api/client";
// import { AuthContext } from "../auth/AuthContext";
// import { AssetIcon } from "../components/AssetIcon";
//
// type Group = {
//   id: string;
//   ownerUserId: string;
//   name: string;
//   description?: string | null;
//   joinType: "PUBLIC" | "INVITE";
//   inviteCode?: string | null;
// };
//
// type MemberItem = {
//   userId: string;
//   displayName: string;
//   avatarKey: string | null;
//   points: number;
//   role: "OWNER" | "MEMBER";
//   joinedAt: string;
// };
//
// type LeaderboardItem = {
//   userId: string;
//   displayName: string;
//   avatarKey: string | null;
//   points: number;
//   bestStreak: number;
//   todayAchieved: boolean;
// };
//
// type LeaderboardSort = "points_desc" | "streak_desc";
//
// export function GroupDetailScreen(props: {
//   navigation: { goBack: () => void };
//   route: { params?: { groupId?: string; group?: Group; role?: "OWNER" | "MEMBER" } };
// }) {
//   const auth = useContext(AuthContext);
//   if (!auth) throw new Error("AuthProvider missing");
//   if (auth.state.status !== "signedIn") return null;
//
//   const token = auth.state.token;
//   const groupId = props.route.params?.groupId;
//   const initialGroup = props.route.params?.group;
//   const initialRole = props.route.params?.role ?? null;
//
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [group, setGroup] = useState<Group | null>(initialGroup ?? null);
//   const [role, setRole] = useState<"OWNER" | "MEMBER" | null>(initialRole);
//   const [members, setMembers] = useState<MemberItem[]>([]);
//   const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
//   const [sort, setSort] = useState<LeaderboardSort>("points_desc");
//
//   const loadGroupFallback = useCallback(async () => {
//     if (group) return;
//     const res = await apiRequest<{ items: Array<{ group: Group; role: "OWNER" | "MEMBER" }> }>({
//       path: "/api/groups?page=1&pageSize=100",
//       token,
//     });
//     const found = res.items.find((it) => it.group.id === groupId);
//     if (found) {
//       setGroup(found.group);
//       setRole(found.role);
//     }
//   }, [group, groupId, token]);
//
//   const load = useCallback(async () => {
//     if (!groupId) return;
//     await loadGroupFallback();
//     const [membersData, leaderboardData] = await Promise.all([
//       apiRequest<{ items: MemberItem[] }>({ path: `/api/groups/${encodeURIComponent(groupId)}/members`, token }),
//       apiRequest<{ items: LeaderboardItem[] }>({
//         path: `/api/groups/${encodeURIComponent(groupId)}/leaderboard?sort=${sort}&page=1&pageSize=50`,
//         token,
//       }),
//     ]);
//     setMembers(membersData.items);
//     setLeaderboard(leaderboardData.items);
//   }, [groupId, loadGroupFallback, sort, token]);
//
//   useFocusEffect(
//     useCallback(() => {
//       let mounted = true;
//       (async () => {
//         if (!groupId) return;
//         try {
//           setLoading(true);
//           await load();
//         } catch (err: unknown) {
//           if (!mounted) return;
//           Alert.alert("加载失败", err instanceof Error ? err.message : "请稍后重试");
//         } finally {
//           if (mounted) setLoading(false);
//         }
//       })();
//       return () => {
//         mounted = false;
//       };
//     }, [groupId, load]),
//   );
//
//   const onRefresh = useCallback(async () => {
//     try {
//       setRefreshing(true);
//       await load();
//     } catch (err: unknown) {
//       Alert.alert("刷新失败", err instanceof Error ? err.message : "请稍后重试");
//     } finally {
//       setRefreshing(false);
//     }
//   }, [load]);
//
//   const todayAchievedCount = useMemo(() => leaderboard.filter((it) => it.todayAchieved).length, [leaderboard]);
//
//   const leaveGroup = useCallback(async () => {
//     if (!groupId) return;
//     Alert.alert("确认退出小组？", "", [
//       { text: "取消", style: "cancel" },
//       {
//         text: "退出",
//         style: "destructive",
//         onPress: async () => {
//           try {
//             await apiRequest({ path: `/api/groups/${encodeURIComponent(groupId)}/leave`, method: "POST", token });
//             Alert.alert("已退出小组");
//             props.navigation.goBack();
//           } catch (err: unknown) {
//             Alert.alert("退出失败", err instanceof Error ? err.message : "请稍后重试");
//           }
//         },
//       },
//     ]);
//   }, [groupId, props.navigation, token]);
//
//   if (!groupId) {
//     return (
//       <View style={{ flex: 1, padding: 16 }}>
//         <Text style={{ color: "#666" }}>缺少 groupId 参数。</Text>
//       </View>
//     );
//   }
//
//   return (
//     <View style={{ flex: 1, padding: 16, gap: 12 }}>
//       <View style={{ gap: 6 }}>
//         <Text style={{ fontSize: 20, fontWeight: "700" }}>{group ? group.name : "小组详情"}</Text>
//         {group?.description ? <Text style={{ color: "#666" }}>{group.description}</Text> : null}
//         <Text style={{ color: "#666" }}>
//           groupId：{groupId} {role ? `· 我的身份：${role}` : ""}
//         </Text>
//         {group?.joinType === "INVITE" && group.inviteCode ? <Text style={{ color: "#666" }}>邀请码：{group.inviteCode}</Text> : null}
//       </View>
//
//       <View style={{ flexDirection: "row", gap: 10 }}>
//         <TouchableOpacity
//           onPress={() => setSort((prev) => (prev === "points_desc" ? "streak_desc" : "points_desc"))}
//           style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: "#ddd" }}
//         >
//           <Text>排序：{sort === "points_desc" ? "按积分" : "按连胜"}</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           onPress={leaveGroup}
//           style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" }}
//         >
//           <Text>退出小组</Text>
//         </TouchableOpacity>
//       </View>
//
//       <View style={{ padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12, backgroundColor: "#fff", gap: 6 }}>
//         <Text style={{ fontWeight: "700" }}>监督/竞争（同组）</Text>
//         <Text style={{ color: "#666" }}>今日已达成：{todayAchievedCount}/{leaderboard.length}</Text>
//       </View>
//
//       {loading ? (
//         <Text style={{ color: "#666" }}>加载中…</Text>
//       ) : (
//         <View style={{ flex: 1, gap: 8 }}>
//           <Text style={{ fontWeight: "700" }}>排行榜（成员进度对比）</Text>
//           <FlatList
//             data={leaderboard}
//             keyExtractor={(it) => it.userId}
//             refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
//             ListEmptyComponent={<Text style={{ color: "#666" }}>暂无成员数据。</Text>}
//             renderItem={({ item, index }) => (
//               <View
//                 style={{
//                   paddingVertical: 10,
//                   paddingHorizontal: 12,
//                   borderWidth: 1,
//                   borderColor: "#eee",
//                   borderRadius: 12,
//                   backgroundColor: "#fff",
//                   marginBottom: 8,
//                   flexDirection: "row",
//                   justifyContent: "space-between",
//                 }}
//               >
//                 <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
//                   <AssetIcon assetKey={item.avatarKey ?? "avatar_default"} size={32} />
//                   <Text style={{ fontWeight: "700" }}>
//                     #{index + 1} {item.displayName}
//                   </Text>
//                 </View>
//                 <Text style={{ color: "#666" }}>
//                   积分 {item.points} · 最佳连胜 {item.bestStreak} · 今日 {item.todayAchieved ? "✅" : "—"}
//                 </Text>
//               </View>
//             )}
//           />
//
//           <Text style={{ fontWeight: "700" }}>成员列表</Text>
//           <View style={{ gap: 8 }}>
//             {members.slice(0, 12).map((m) => (
//               <View
//                 key={m.userId}
//                 style={{
//                   paddingVertical: 10,
//                   paddingHorizontal: 12,
//                   borderWidth: 1,
//                   borderColor: "#eee",
//                   borderRadius: 12,
//                   backgroundColor: "#fff",
//                   flexDirection: "row",
//                   justifyContent: "space-between",
//                 }}
//               >
//                 <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
//                   <AssetIcon assetKey={m.avatarKey ?? "avatar_default"} size={32} />
//                   <Text>
//                     {m.displayName} {m.role === "OWNER" ? "(群主)" : ""}
//                   </Text>
//                 </View>
//                 <Text style={{ color: "#666" }}>积分 {m.points}</Text>
//               </View>
//             ))}
//           </View>
//         </View>
//       )}
//     </View>
//   );
// }
