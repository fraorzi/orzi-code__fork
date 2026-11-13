import { describe, expect, it } from "vitest";
import { providerUsageResetPayloadSchema } from "@/shared/contracts";
import { ipcProcedureMap } from "./procedureMap";
import { REMOTE_PROCEDURE_SPECS } from "../remote/procedures";

describe("native reset transport", () => {
  it("routes mutations to the supervisor with an operate permission", () => {
    expect(ipcProcedureMap.consumeProviderUsageReset.transport).toBe("supervisor");
    expect(REMOTE_PROCEDURE_SPECS.consumeProviderUsageReset.scope).toBe("session:operate");
    expect(
      ipcProcedureMap.consumeProviderUsageReset.parseArgs({
        providerId: "test",
        grantId: "saved",
        requestId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({
      providerId: "test",
      grantId: "saved",
      requestId: "11111111-1111-4111-8111-111111111111",
    });
  });
  it("rejects ambiguous or malformed redemption requests", () => {
    for (const request of [
      {},
      { providerId: "test", grantId: "saved", requestId: "" },
      { providerId: "", grantId: "saved", requestId: "11111111-1111-4111-8111-111111111111" },
    ]) {
      expect(providerUsageResetPayloadSchema.safeParse(request).success).toBe(false);
    }
  });
});
