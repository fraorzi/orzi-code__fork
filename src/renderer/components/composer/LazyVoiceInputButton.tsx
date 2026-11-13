import { lazy } from "react";

export const LazyVoiceInputButton = lazy(async () => ({
  default: (await import("./VoiceInputButton")).VoiceInputButton,
}));
