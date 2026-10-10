import React from "react";
import { Button, Text, View } from "react-native";

type Variant = "loading" | "empty" | "error";

function titleFor(variant: Variant) {
  if (variant === "loading") return "loading";
  if (variant === "empty") return "no data";
  return "wrong";
}

export function StatusBlock(props: { variant: Variant; message: string; onRetry?: () => void }) {
  return (
    <View
      style={{
        padding: 14,
        borderWidth: 1,
        borderColor: "#eee",
        borderRadius: 12,
        backgroundColor: "#fff",
        gap: 8,
      }}
    >
      <Text style={{ fontWeight: "700" }}>{titleFor(props.variant)}</Text>
      <Text style={{ color: "#666" }}>{props.message}</Text>
      {props.onRetry ? <Button title="retry" onPress={props.onRetry} /> : null}
    </View>
  );
}

