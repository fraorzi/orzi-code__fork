// Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-06.
import { toast } from "@heroui/react";
import { friendlyError } from "@/shared/messages";
import { readBridge } from "@/renderer/bridge";

export function openExternalWithFeedback(url: string): void {
  void readBridge()
    .openExternalNative(url)
    .catch((error: unknown) => {
      toast.danger(friendlyError(error));
    });
}
