import React from "react";
import { Image, type ImageStyle } from "react-native";

import { getAssetImageSource } from "../assets/assetImages";

export function AssetIcon(props: { assetKey?: string | null; size?: number; rounded?: boolean; style?: ImageStyle }) {
  const size = props.size ?? 44;
  const rounded = props.rounded ?? true;
  return (
    <Image
      source={getAssetImageSource(props.assetKey)}
      style={[
        { width: size, height: size, borderRadius: rounded ? size / 2 : 10, backgroundColor: "#f0f0f0" },
        props.style,
      ]}
    />
  );
}

