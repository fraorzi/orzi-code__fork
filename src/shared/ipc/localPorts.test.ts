import { expect, it } from "vitest";
import { ipcProcedureMap } from "./procedureMap";
import { isRemoteProcedure } from "../remote/procedures";

it("adds desktop port controls without exposing process signals to paired remote clients", () => {
  expect(ipcProcedureMap.listLocalPorts.parseArgs()).toEqual({});
  expect(isRemoteProcedure("listLocalPorts")).toBe(false);
  expect(isRemoteProcedure("stopLocalPort")).toBe(false);
  expect(() =>
    ipcProcedureMap.stopLocalPort.parseArgs({ pid: -1, startedAt: "", port: 70000 }),
  ).toThrow(/too_small/);
  expect(
    ipcProcedureMap.stopLocalPort.parseArgs({ pid: 42, startedAt: "identity", port: 3000 }),
  ).toEqual({ pid: 42, startedAt: "identity", port: 3000 });
});
