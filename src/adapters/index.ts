import { registerAdapter } from "../adapter.ts";
import { demoAdapter } from "./demo.ts";
import { shapePhx } from "./shape-phx.ts";
import { planned, PLANNED_PLATFORMS } from "./planned.ts";

registerAdapter(demoAdapter);
registerAdapter(shapePhx);
for (const p of PLANNED_PLATFORMS) registerAdapter(planned(p));
