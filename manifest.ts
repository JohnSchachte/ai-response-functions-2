import { Manifest } from "deno-slack-sdk/mod.ts";

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "AI Response Escalations",
  description: "Functions for AI Responses to Escalations",
  icon: "assets/Shift4 Icon - RBG.png",
  workflows: [],
  outgoingDomains: ["aiv-api-development.shift4payments.com"],
  datastores: [],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "datastore:read",
    "datastore:write",
  ],
});
