import type { SessionNotification } from "@agentclientprotocol/sdk";

/**
 * Recognize provider failure text, including partially streamed text.
 * "failure" allows one retry before activity; "fatal" fails without retrying.
 */
export type AcpPromptFailureClassifier = (
  text: string,
) => "incomplete" | "failure" | "fatal" | undefined;

/** Retry once without replaying user rows or any work the agent has already started. */
export class AcpPromptRecovery {
  private buffered: SessionNotification[] = [];
  private text = "";
  private activity = false;

  constructor(
    private readonly classify: AcpPromptFailureClassifier,
    private readonly forward: (notification: SessionNotification) => void,
  ) {}

  accept(notification: SessionNotification): void {
    const update = notification.update;
    if (update.sessionUpdate === "agent_message_chunk") {
      if (update.content.type === "text") {
        this.text += update.content.text;
        if (this.classify(this.text)) {
          this.buffered.push(notification);
          return;
        }
      }
      this.activity = true;
    } else if (
      update.sessionUpdate === "agent_thought_chunk" ||
      update.sessionUpdate === "tool_call" ||
      update.sessionUpdate === "tool_call_update" ||
      update.sessionUpdate === "plan"
    ) {
      this.activity = true;
    }
    if (this.activity) this.flush();
    this.forward(notification);
  }

  markActivity(): void {
    this.activity = true;
    this.flush();
  }

  async run<T extends { stopReason: string }>(
    send: () => Promise<T>,
    canRetry: () => boolean,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      let result: T | undefined;
      let failure: unknown;
      try {
        result = await send();
      } catch (error) {
        failure = error;
      }
      const message = failure instanceof Error ? failure.message : this.text;
      const diagnosis = this.classify(message);
      const diagnosedFailure =
        (diagnosis === "failure" || diagnosis === "fatal") &&
        (!result || result.stopReason === "end_turn");
      if (diagnosedFailure && canRetry()) {
        this.buffered = [];
        this.text = "";
        if (diagnosis === "failure" && !this.activity && attempt === 0) continue;
        throw new Error(message);
      }
      this.flush();
      if (!result) throw failure;
      return result;
    }
  }

  private flush(): void {
    for (const notification of this.buffered.splice(0)) this.forward(notification);
    this.text = "";
  }
}
