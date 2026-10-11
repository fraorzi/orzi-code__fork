import { readBridge } from "@/renderer/bridge";
import { bindingForPlatform, formatKeybinding } from "@/renderer/commands/keybindingMatcher";
import { useKeybindingStore } from "@/renderer/commands/keybindingStore";

export function shortcutForCommand(
  commandId: string,
  keybindings: readonly { command: string }[],
): string {
  const platform = readBridge().platform;
  const binding = keybindings.find((item) => item.command === commandId);
  if (!binding) return "";
  return formatKeybinding(bindingForPlatform(binding, platform), platform);
}

export function useCommandShortcutLabel(commandId: string): string {
  const keybindings = useKeybindingStore((state) => state.keybindings);
  return shortcutForCommand(commandId, keybindings);
}
