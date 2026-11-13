import type { UsageResetResult } from "@poracode/agents-usage";
import type {
  ProviderUsageResetPayload,
  ProviderUsageResetResponse,
  UsageSnapshot,
} from "@/shared/contracts";

interface ResetOperations {
  consume(request: ProviderUsageResetPayload): Promise<UsageResetResult>;
  refresh(providerId: string): Promise<UsageSnapshot | undefined>;
}

/** Serialize account mutations, coalesce identical requests, and refresh from the provider. */
export class UsageResetCoordinator {
  private readonly unconfirmed = new Map<string, string>();
  private readonly inFlight = new Map<
    string,
    { request: ProviderUsageResetPayload; promise: Promise<ProviderUsageResetResponse> }
  >();
  constructor(private readonly operations: ResetOperations) {}

  consume(request: ProviderUsageResetPayload): Promise<ProviderUsageResetResponse> {
    const existing = this.inFlight.get(request.providerId);
    if (existing)
      return existing.request.requestId === request.requestId &&
        existing.request.grantId === request.grantId
        ? existing.promise
        : Promise.resolve({ outcome: "busy" });
    const promise = this.run(request).finally(() => this.inFlight.delete(request.providerId));
    this.inFlight.set(request.providerId, { request, promise });
    return promise;
  }

  private async run(request: ProviderUsageResetPayload): Promise<ProviderUsageResetResponse> {
    const key = JSON.stringify([request.providerId, request.grantId]);
    const requestId = this.unconfirmed.get(key) ?? request.requestId;
    let result: UsageResetResult;
    try {
      result = await this.operations.consume({ ...request, requestId });
    } catch {
      result = { outcome: "unknown" };
    }
    // Closing a popover must not turn a lost response into a second redemption.
    if (result.outcome === "unknown") this.unconfirmed.set(key, requestId);
    else this.unconfirmed.delete(key);
    if (result.outcome === "unsupported") return result;
    try {
      const snapshot = await this.operations.refresh(request.providerId);
      return { ...result, ...(snapshot ? { snapshot } : {}) };
    } catch {
      return result;
    }
  }
}
