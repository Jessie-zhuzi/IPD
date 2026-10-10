import type { ImageSourcePropType } from "react-native";

import adaptiveIcon from "../../assets/adaptive-icon.png";
import favicon from "../../assets/favicon.png";
import icon from "../../assets/icon.png";
import splashIcon from "../../assets/splash-icon.png";

const byKey: Record<string, ImageSourcePropType> = {
  avatar_default: icon,
  avatar_bee: adaptiveIcon,
  avatar_rocket: splashIcon,
  badge_bronze: favicon,
  badge_silver: icon,
  badge_7day: adaptiveIcon,
};

export function getAssetImageSource(assetKey: string | null | undefined): ImageSourcePropType {
  if (!assetKey) return byKey.avatar_default;
  return byKey[assetKey] ?? byKey.avatar_default;
}
