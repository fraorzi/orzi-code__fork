import { APP_CONTROLS_MCP_INSTRUCTIONS } from "../instructions";
import type { ToolDomain } from "./types";

export const instructionTools: ToolDomain = {
  specs: [
    {
      name: "read_instructions",
      description:
        "Read this server's workspace and Terminal instructions before using its other tools.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ],
  handlers: { read_instructions: () => ({ instructions: APP_CONTROLS_MCP_INSTRUCTIONS }) },
};
