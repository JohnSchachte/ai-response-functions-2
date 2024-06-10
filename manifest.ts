import { Manifest } from "deno-slack-sdk/mod.ts";
import CreateAiTestWorkflow from "./workflows/pos-escalation-ai.ts";

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "AI Response Escalations",
  description: "Functions for AI Responses to Escalations",
  icon: "assets/AI.png",
  workflows: [CreateAiTestWorkflow],
  outgoingDomains: ["aiv-api-development.shift4payments.com","aiv-api.shift4payments.com"],
  datastores: [],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "datastore:read",
    "datastore:write",
  ],
});
