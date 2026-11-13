import { expect, it } from "vitest";
import { protectTransportPort, readTransportPorts } from "./transportPorts";

it("keeps a shared transport protected until its last registration closes", () => {
  const first = protectTransportPort("http://127.0.0.1:61321");
  const second = protectTransportPort("http://127.0.0.1:61321");
  try {
    expect(readTransportPorts()).toContain(61321);
    first();
    first();
    expect(readTransportPorts()).toContain(61321);
  } finally {
    first();
    second();
  }
  expect(readTransportPorts()).not.toContain(61321);
});
