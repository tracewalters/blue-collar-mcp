#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BRAIN_INSTRUCTIONS, registerBrain } from "./brain/tools.ts";
import { registerIngest } from "./brain/ingest-tools.ts";
import { registerPermits } from "./permit-tools.ts";

const brainOn = Boolean(process.env.BCMCP_BRAIN); // company brain is parked: opt-in
const server = new McpServer({ name: "permit-mcp", version: "0.1.0" }, {
  instructions: "Permits for residential contractors. Use the permit tools for any question about permits, inspections or deadlines. Keep replies under 6 short lines. Never ask for portal passwords in chat." + (brainOn ? " " + BRAIN_INSTRUCTIONS : ""),
});

registerPermits(server, { writes: true, connectHint: "tell the user to run `permit login` in their terminal." });
if (brainOn) { registerBrain(server); registerIngest(server); }

await server.connect(new StdioServerTransport());
