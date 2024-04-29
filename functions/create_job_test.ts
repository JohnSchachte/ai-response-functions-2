import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { assertEquals } from "https://deno.land/std@0.153.0/testing/asserts.ts";
import SampleFunction from "./create_job_function.ts";
import * as mf from "mock-fetch/mod.ts";

const { createContext } = SlackFunctionTester("create_job");

// Replaces globalThis.fetch with the mocked copy
mf.install();


/*
curl --location 'https://aiv-api-development.shift4payments.com/gpt-rag/api/integration/v1/agents/internal-support-escalation-workflow/jobs' \
--header 'Content-Type: application/json' \
--header 'Authorization:' \
--data '{
  "supportEscalationContext": {
    "externalRef": "--google-sheet-external-ref--",
    "ticketLink": "https://support.example.com/tickets/12345",
    "mid": "123456789",
    "dba": "Example DBA",
    "callerType": "Technical Support",
    "softwareType": "CRM",
    "escalationType": "Urgent",
    "escalationReason": "System Down",
    "merchantReason": "Unable to process payments",
    "additionalContext": "How to void a payment on Skytab POS"
  }
}'
*/
Deno.test("Create Job Test", async () => {
  const inputs = { formEndCompleted: "1", externalRef: "123", ticketLink: "https://support.example.com/tickets/12345", mid: "123456789", dba: "Example DBA", callerType: "Technical Support", softwareType: "CRM", escalationType: "Urgent", escalationReason: "System Down", merchantReason: "Unable to process payments", additionalContext: "How to void a payment on Skytab POS"};
  const { outputs, error } = await SampleFunction(createContext({ inputs }));

  assertEquals(error, undefined);
  assertEquals(
    outputs?.jobId,
    ":wave: <@U01234567> submitted the following message: \n\n>Hello, World!",
  );
});
