// import { useFocusEffect } from "@react-navigation/native";
// import React, { useCallback, useContext, useState } from "react";
// import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
//
// import { apiRequest } from "../api/client";
// import { AuthContext } from "../auth/AuthContext";
// import { StatusBlock } from "../components/StatusBlock";
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
// type GroupMembership = {
//   group: Group;
//   role: "OWNER" | "MEMBER";
//   joinedAt: string;
// };
//
// export function GroupsScreen(props: { navigation: { navigate: (screen: string, params?: unknown) => void } }) {
//   const auth = useContext(AuthContext);
//   if (!auth) throw new Error("AuthProvider missing");
//   if (auth.state.status !== "signedIn") return null;
//
//   const token = auth.state.token;
//
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);
//   const [groups, setGroups] = useState<GroupMembership[]>([]);
//
//   const load = useCallback(async () => {
//     const res = await apiRequest<{ items: GroupMembership[] }>({
//       path: "/api/groups?page=1&pageSize=50",
//       token,
//     });
//     setGroups(res.items);
//   }, [token]);
//
//   useFocusEffect(
//     useCallback(() => {
//       let mounted = true;
//       (async () => {
//         try {
//           setLoading(true);
//           setErrorMessage(null);
//           await load();
//         } catch (err: unknown) {
//           if (!mounted) return;
//           setErrorMessage(err instanceof Error ? err.message : "请稍后重试");
//         } finally {
//           if (mounted) setLoading(false);
//         }
//       })();
//       return () => {
//         mounted = false;
//       };
//     }, [load]),
//   );
//
//   const onRefresh = useCallback(async () => {
//     try {
//       setRefreshing(true);
//       setErrorMessage(null);
//       await load();
//     } catch (err: unknown) {
//       setErrorMessage(err instanceof Error ? err.message : "请稍后重试");
//     } finally {
//       setRefreshing(false);
//     }
//   }, [load]);
//
//   return (
//     <View style={{ flex: 1, padding: 16, gap: 12 }}>
//       <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
//         <Text style={{ fontSize: 20, fontWeight: "700" }}>小组</Text>
//         <View style={{ flexDirection: "row", gap: 10 }}>
//           <TouchableOpacity
//             onPress={() => props.navigation.navigate("GroupJoin")}
//             style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: "#ddd" }}
//           >
//             <Text>加入</Text>
//           </TouchableOpacity>
//           <TouchableOpacity
//             onPress={() => props.navigation.navigate("GroupCreate")}
//             style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#111" }}
//           >
//             <Text style={{ color: "#fff" }}>创建</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//
//       {loading && groups.length === 0 ? (
//         <StatusBlock variant="loading" message="正在加载你加入的小组…" />
//       ) : errorMessage && groups.length === 0 ? (
//         <StatusBlock variant="error" message={errorMessage} onRetry={onRefresh} />
//       ) : (
//         <FlatList
//           data={groups}
//           keyExtractor={(it) => it.group.id}
//           refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
//           ListEmptyComponent={<StatusBlock variant="empty" message="你还没有加入任何小组。可以先创建一个，或用邀请码加入。" />}
//           renderItem={({ item }) => (
//             <TouchableOpacity
//               onPress={() =>
//                 props.navigation.navigate("GroupDetail", {
//                   groupId: item.group.id,
//                   group: item.group,
//                   role: item.role,
//                 })
//               }
//               style={{
//                 padding: 12,
//                 borderWidth: 1,
//                 borderColor: "#eee",
//                 borderRadius: 12,
//                 backgroundColor: "#fff",
//                 marginBottom: 10,
//                 gap: 6,
//               }}
//             >
//               <Text style={{ fontSize: 16, fontWeight: "700" }}>{item.group.name}</Text>
//               {item.group.description ? <Text style={{ color: "#666" }}>{item.group.description}</Text> : null}
//               <Text style={{ color: "#666" }}>
//                 身份：{item.role} · 加入方式：{item.group.joinType}
//                 {item.group.joinType === "INVITE" && item.group.inviteCode ? ` · 邀请码：${item.group.inviteCode}` : ""}
//               </Text>
//             </TouchableOpacity>
//           )}
//         />
//       )}
//     </View>
//   );
// }
