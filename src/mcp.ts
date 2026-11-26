#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BRAIN_INSTRUCTIONS, registerBrain } from "./brain-tools.ts";
import { registerIngest } from "./ingest-tools.ts";
import { registerPermits } from "./permit-tools.ts";

const server = new McpServer({ name: "permit-mcp", version: "0.1.0" }, { instructions: BRAIN_INSTRUCTIONS });

registerPermits(server, { writes: true, connectHint: "tell the user to run `permit login` in their terminal." });
registerBrain(server);
registerIngest(server);

await server.connect(new StdioServerTransport());
