import { expect, it } from "vitest";
import { readTransportPorts } from "../base/transportPorts";
import { spawnOpenCodeServer } from "./sdkServer";

it("protects a real transport listener before readiness resolves and releases it on disposal", async () => {
  const server = spawnOpenCodeServer({
    command: process.execPath,
    args: [
      "-e",
      "const http=require('node:http');const s=http.createServer((q,r)=>r.end());s.listen(0,'127.0.0.1',()=>console.log('opencode server listening on http://127.0.0.1:'+s.address().port));",
    ],
  });
  let port = 0;
  try {
    port = Number(new URL(await server.baseUrl).port);
    expect(readTransportPorts()).toContain(port);
  } finally {
    await server.dispose();
  }
  expect(readTransportPorts()).not.toContain(port);
});
