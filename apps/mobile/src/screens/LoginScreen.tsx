import React, { useContext, useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";

import { AuthContext } from "../auth/AuthContext";

export function LoginScreen(props: { navigation: { navigate: (screen: string) => void } }) {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");
  const { login } = auth;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedEmail = email.trim();
  const validEmail = /.+@.+/.test(trimmedEmail);
  const validPassword = password.length >= 6;
  const canSubmit = validEmail && validPassword && !submitting;

  async function onLogin() {
    if (!validEmail) {
      Alert.alert("Please enter the correct email address");
      return;
    }
    if (!validPassword) {
      Alert.alert("The password should be at least six characters long");
      return;
    }
    try {
      setSubmitting(true);
      await login(trimmedEmail, password);
    } catch (err: unknown) {
      Alert.alert("login failure", err instanceof Error ? err.message : "Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>HabitHive</Text>
      <TextInput
        autoCapitalize="none"
        placeholder="mailbox"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 8 }}
      />
      {!validEmail && trimmedEmail.length > 0 ? <Text style={{ color: "#d00" }}>The email address format is incorrect</Text> : null}
      <TextInput
        placeholder="password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 8 }}
      />
      {!validPassword && password.length > 0 ? <Text style={{ color: "#d00" }}>The password should be at least six characters long</Text> : null}
      <Button title={submitting ? "being logging in\n..." : "log in"} onPress={onLogin} disabled={!canSubmit} />
      <Button title="No account? Register" onPress={() => props.navigation.navigate("Register")} />
    </View>
  );
}
