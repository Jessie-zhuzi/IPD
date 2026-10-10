import React, { useContext, useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";

import { AuthContext } from "../auth/AuthContext";

export function RegisterScreen(props: { navigation: { goBack: () => void } }) {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");
  const { register } = auth;

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = displayName.trim();
  const trimmedEmail = email.trim();
  const validName = trimmedName.length > 0;
  const validEmail = /.+@.+/.test(trimmedEmail);
  const validPassword = password.length >= 6;
  const canSubmit = validName && validEmail && validPassword && !submitting;

  async function onRegister() {
    if (!validName) {
      Alert.alert("Please enter your nickname.");
      return;
    }
    if (!validEmail) {
      Alert.alert("Please enter the correct email address.");
      return;
    }
    if (!validPassword) {
      Alert.alert("The password must be at least 6 characters long.");
      return;
    }
    try {
      setSubmitting(true);
      await register(trimmedEmail, password, trimmedName);
    } catch (err: unknown) {
      Alert.alert("fail to register\n", err instanceof Error ? err.message : "Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>create an account</Text>
      <TextInput
        placeholder="nickname"
        value={displayName}
        onChangeText={setDisplayName}
        style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 8 }}
      />
      {!validName && displayName.length > 0 ? <Text style={{ color: "#d00" }}>The nickname cannot be empty.</Text> : null}
      <TextInput
        autoCapitalize="none"
        placeholder="mailbox"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 8 }}
      />
      {!validEmail && trimmedEmail.length > 0 ? <Text style={{ color: "#d00" }}>Incorrect email format</Text> : null}
      <TextInput
        placeholder="Password (at least 6 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 8 }}
      />
      {!validPassword && password.length > 0 ? <Text style={{ color: "#d00" }}>The password must be at least 6 characters long.</Text> : null}
      <Button title={submitting ? "Registration in progress..." : "register\n"} onPress={onRegister} disabled={!canSubmit} />
      <Button title="Do you have an account? Log in now." onPress={() => props.navigation.goBack()} />
    </View>
  );
}
