// import React, { useCallback, useContext, useState } from "react";
// import { Alert, Button, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
//
// import { apiRequest } from "../api/client";
// import { AuthContext } from "../auth/AuthContext";
//
// type JoinMode = "GROUP_ID" | "INVITE_CODE";
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
// function JoinModePicker(props: { value: JoinMode; onChange: (v: JoinMode) => void }) {
//   const items: Array<{ key: JoinMode; label: string }> = [
//     { key: "INVITE_CODE", label: "邀请码" },
//     { key: "GROUP_ID", label: "groupId" },
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
// export function GroupJoinScreen(props: { navigation: { goBack: () => void; navigate: (screen: string, params?: unknown) => void } }) {
//   const auth = useContext(AuthContext);
//   if (!auth) throw new Error("AuthProvider missing");
//   if (auth.state.status !== "signedIn") return null;
//
//   const token = auth.state.token;
//   const [mode, setMode] = useState<JoinMode>("INVITE_CODE");
//   const [value, setValue] = useState("");
//   const [submitting, setSubmitting] = useState(false);
//
//   const canSubmit = value.trim().length > 0 && !submitting;
//
//   const onSubmit = useCallback(async () => {
//     if (!canSubmit) return;
//     try {
//       setSubmitting(true);
//       const group = await apiRequest<Group>({
//         path: "/api/groups/join",
//         method: "POST",
//         token,
//         body: mode === "INVITE_CODE" ? { inviteCode: value.trim().toUpperCase() } : { groupId: value.trim() },
//       });
//       Alert.alert("加入成功", `已加入：${group.name}`);
//       props.navigation.navigate("GroupDetail", { groupId: group.id, group });
//     } catch (err: unknown) {
//       Alert.alert("加入失败", err instanceof Error ? err.message : "请稍后重试");
//     } finally {
//       setSubmitting(false);
//     }
//   }, [canSubmit, mode, props.navigation, token, value]);
//
//   return (
//     <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
//       <Text style={{ fontSize: 18, fontWeight: "700" }}>加入小组</Text>
//
//       <View style={{ gap: 8 }}>
//         <Text style={{ fontWeight: "600" }}>加入方式</Text>
//         <JoinModePicker value={mode} onChange={setMode} />
//       </View>
//
//       <View style={{ gap: 8 }}>
//         <Text style={{ fontWeight: "600" }}>{mode === "INVITE_CODE" ? "邀请码" : "groupId"}</Text>
//         <TextInput
//           autoCapitalize={mode === "INVITE_CODE" ? "characters" : "none"}
//           placeholder={mode === "INVITE_CODE" ? "例如：AB12CD" : "例如：cuid..."}
//           value={value}
//           onChangeText={setValue}
//           style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 10, backgroundColor: "#fff" }}
//         />
//         <Text style={{ color: "#666" }}>
//           {mode === "INVITE_CODE" ? "若小组是邀请码模式，请输入邀请码。" : "公开小组（PUBLIC）可用 groupId 加入（演示用）。"}
//         </Text>
//       </View>
//
//       <View style={{ gap: 10 }}>
//         <Button title={submitting ? "加入中..." : "加入"} disabled={!canSubmit} onPress={onSubmit} />
//         <Button title="取消" onPress={() => props.navigation.goBack()} />
//       </View>
//     </ScrollView>
//   );
// }
//
