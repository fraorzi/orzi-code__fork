import {
  stopLocalPortSchema,
  type LocalPortsResult,
  type StopLocalPort,
  type StopLocalPortResult,
} from "../../localPorts";
import { defineNoArgProcedure, definePayloadProcedure } from "../core";

// Desktop-only additive IPC. No persisted data or remote protocol changes.
export const localPortProcedures = {
  listLocalPorts: defineNoArgProcedure<LocalPortsResult, "supervisor">(
    "listLocalPorts",
    "supervisor",
  ),
  stopLocalPort: definePayloadProcedure<StopLocalPort, StopLocalPortResult, "supervisor">(
    "stopLocalPort",
    "supervisor",
    stopLocalPortSchema,
  ),
} as const;
