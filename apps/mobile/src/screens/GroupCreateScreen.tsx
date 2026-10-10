// import React, { useCallback, useContext, useState } from "react";
// import { Alert, Button, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
//
// import { apiRequest } from "../api/client";
// import { AuthContext } from "../auth/AuthContext";
//
// type GroupJoinType = "PUBLIC" | "INVITE";
//
// type Group = {
//   id: string;
//   ownerUserId: string;
//   name: string;
//   description?: string | null;
//   joinType: GroupJoinType;
//   inviteCode?: string | null;
// };
//
// function JoinTypePicker(props: { value: GroupJoinType; onChange: (v: GroupJoinType) => void }) {
//   const items: Array<{ key: GroupJoinType; label: string }> = [
//     { key: "PUBLIC", label: "公开加入" },
//     { key: "INVITE", label: "邀请码" },
//   ];
//
//   return (
//     <View style={{ flexDirection: "row", gap: 8 }}>
//       {items.map((it) => {
//         const active = props.value === it.key;
//         return (
//           <TouchableOpacity
//             key={it.key}
//             onPress={() => props.onChange(it.key)}
//             style={{
//               paddingVertical: 10,
//               paddingHorizontal: 14,
//               borderRadius: 10,
//               backgroundColor: active ? "#111" : "#fff",
//               borderWidth: 1,
//               borderColor: active ? "#111" : "#ddd",
//             }}
//           >
//             <Text style={{ color: active ? "#fff" : "#111", fontWeight: "600" }}>{it.label}</Text>
//           </TouchableOpacity>
//         );
//       })}
//     </View>
//   );
// }
//
// export function GroupCreateScreen(props: { navigation: { goBack: () => void; navigate: (screen: string, params?: unknown) => void } }) {
//   const auth = useContext(AuthContext);
//   if (!auth) throw new Error("AuthProvider missing");
//   if (auth.state.status !== "signedIn") return null;
//
//   const token = auth.state.token;
//   const [submitting, setSubmitting] = useState(false);
//   const [name, setName] = useState("");
//   const [description, setDescription] = useState("");
//   const [joinType, setJoinType] = useState<GroupJoinType>("PUBLIC");
//
//   const canSubmit = name.trim().length > 0 && !submitting;
//
//   const onSubmit = useCallback(async () => {
//     if (!canSubmit) return;
//     try {
//       setSubmitting(true);
//       const group = await apiRequest<Group>({
//         path: "/api/groups",
//         method: "POST",
//         token,
//         body: {
//           name: name.trim(),
//           description: description.trim() ? description.trim() : undefined,
//           joinType,
//         },
//       });
//       Alert.alert("创建成功", joinType === "INVITE" && group.inviteCode ? `邀请码：${group.inviteCode}` : "已创建小组。");
//       props.navigation.navigate("GroupDetail", { groupId: group.id, group });
//     } catch (err: unknown) {
//       Alert.alert("创建失败", err instanceof Error ? err.message : "请稍后重试");
//     } finally {
//       setSubmitting(false);
//     }
//   }, [canSubmit, description, joinType, name, props.navigation, token]);
//
//   return (
//     <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
//       <Text style={{ fontSize: 18, fontWeight: "700" }}>创建小组</Text>
//
//       <View style={{ gap: 8 }}>
//         <Text style={{ fontWeight: "600" }}>小组名称</Text>
//         <TextInput
//           placeholder="例如：学习小组"
//           value={name}
//           onChangeText={setName}
//           style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 10, backgroundColor: "#fff" }}
//         />
//       </View>
//
//       <View style={{ gap: 8 }}>
//         <Text style={{ fontWeight: "600" }}>描述（可选）</Text>
//         <TextInput
//           placeholder="例如：互相监督打卡"
//           value={description}
//           onChangeText={setDescription}
//           style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 10, backgroundColor: "#fff" }}
//         />
//       </View>
//
//       <View style={{ gap: 8 }}>
//         <Text style={{ fontWeight: "600" }}>加入方式</Text>
//         <JoinTypePicker value={joinType} onChange={setJoinType} />
//         <Text style={{ color: "#666" }}>
//           {joinType === "PUBLIC" ? "公开加入：成员可通过 groupId 加入（演示用）。" : "邀请码：创建后生成邀请码，成员用邀请码加入。"}
//         </Text>
//       </View>
//
//       <View style={{ gap: 10 }}>
//         <Button title={submitting ? "创建中..." : "创建"} disabled={!canSubmit} onPress={onSubmit} />
//         <Button title="取消" onPress={() => props.navigation.goBack()} />
//       </View>
//     </ScrollView>
//   );
// }
//
