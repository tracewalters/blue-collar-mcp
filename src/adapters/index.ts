import { registerAdapter } from "../adapter.ts";
import { demoAdapter } from "./demo.ts";
import { planned, PLANNED_PLATFORMS } from "./planned.ts";

registerAdapter(demoAdapter);
for (const p of PLANNED_PLATFORMS) registerAdapter(planned(p));
