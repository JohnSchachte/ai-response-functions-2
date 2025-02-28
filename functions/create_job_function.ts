// /slack-samples/deno-hello-world/functions/greeting_function.ts
import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
/*
curl --location 'https://aiv-api-development.shift4payments.com/gpt-rag/api/integration/v1/agents/internal-support-escalation-workflow/jobs' \
--header 'Content-Type: application/json' \
--header 'Authorization: ' \
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
export const createAIResponseJobDef = DefineFunction({
  callback_id: "create_job",
  title: "Create AI Response Job",
  description: "NEW Create AI Response Job",
  source_file: "functions/create_job_function.ts",
  input_parameters: {
    properties: {
        submitterSlackId: {
          type: Schema.types.string,
          description: "Submitter's Slack Id"
        },
        submitterSlackName: {
          type: Schema.types.string,
          description: "Submitter's Slack Display Name"
        },
        submitterSlackEmail: {
          type: Schema.types.string,
          description: "Submitter's Slack Email"
        },
        externalRef: {
            type: Schema.types.string,
            description: "Spreadsheet URL for Google Sheets Backend for the workflow",
        },
        ticketLink: {
            type: Schema.types.string,
            description: "Link to the ticket in the support system",
        },
        mid: {
            type: Schema.types.string,
            description: "Merchant ID",
        },
        dba: {
            type: Schema.types.string,
            description: "Doing Business As",
        },
        callerType: {
            type: Schema.types.string,
            description: "Caller Type",
        },
        softwareType: {
            type: Schema.types.string,
            description: "Software Type",
        },
        escalationType: {
            type: Schema.types.string,
            description: "Escalation Type",
        },
        escalationReason: {
            type: Schema.types.string,
            description: "Escalation Reason",
        },
        merchantReason: {
            type: Schema.types.string,
            description: "Merchant Reason",
        },
        additionalContext: {
            type: Schema.types.string,
            description: "Additional Context",
        }
    },
    required: ["submitterSlackId","submitterSlackName","submitterSlackEmail","externalRef", "ticketLink", "mid", "dba", "callerType", "softwareType", "escalationType", "escalationReason", "merchantReason", "additionalContext"],
  },
  output_parameters: {
    properties: {
      jobId: {
        type: Schema.types.string,
        description: "JobId to poll job later",
      },
      failure: {
        type: Schema.types.boolean,
        description: "Failure flag",
      },      
      aivUserId: {
        type: Schema.types.string,
        description: "User Id that AI team wants me to keep putting in the header.",
      }
    },
    required: ["jobId","failure","aivUserId"],
  },
});

export default SlackFunction(
  createAIResponseJobDef,
  async ({ inputs, env }) => {
    console.log('started create job. see if this logs..')

    const {AUTH_TOKEN,IS_PROD} = env;

    let ENDPOINT;
    IS_PROD == "true" ? ENDPOINT = env.PROD_ENDPOINT : ENDPOINT = env.ENDPOINT;

    // transform CS's workflow caller type from "Yes" and "No" to POS Agent Assist workflow caller types
    inputs.callerType = inputs.callerType == "Yes" ? "Owner" : inputs.callerType;
    inputs.callerType = inputs.callerType == "No" ? "Unauthorized User" : inputs.callerType;
    
    // Log the env and inputs to the console ONLY locally
    console.log(`inputs: ${JSON.stringify(inputs)}`);
    console.log(`body: ${JSON.stringify({
      supportEscalationContext: inputs,
    })}`);

    let aivUserId;
    try {
      // 1. Make the fetch call
      const postUserResponse = await fetch(`${ENDPOINT}users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
        body: JSON.stringify({
          externalId: inputs.submitterSlackId,
          name: inputs.submitterSlackName,
          email: inputs.submitterSlackEmail,
        }),
      });
      
      // 2. Check for a non-2xx response
      if (!postUserResponse.ok) {
        console.error('HTTP error', postUserResponse.status, await postUserResponse.text());
        return {
          outputs: { jobId: '', failure: true, aivUserId:'' }
        };
      }

      // 3. Parse out the user ID
      const userData = await postUserResponse.json();
      // The key here depends on the API response structure:
      // e.g., userData.id or userData.userId or something else
      aivUserId = userData.id; 
    } catch (f) {
      console.log("Error in fetch call for posting user");
      console.error(f);
      return {
        outputs: { jobId: '', failure: true,aivUserId:'' }
      };
    }


    try{
      // Use async/await syntax for the fetch call
      const response = await fetch(`${ENDPOINT}jobs`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': AUTH_TOKEN,
              'X-User-Id': aivUserId
          },
          body: JSON.stringify({
              supportEscalationContext: inputs,
          }),
      });

      if (!response.ok) {
          console.error('HTTP error', response.status, await response.text());
          return {
              outputs: { jobId: '', failure: true, aivUserId: '' }
          };
      }

      const data = await response.json(); // Wait for the JSON response to be resolved



      // jobId is now available here after the await statements
      const jobId = data.id;

      console.log("Successfully created job with id: ", jobId);
  
      // Return outputs directly within the async function after the value has been resolved
      return { outputs: { jobId, failure: false, aivUserId} };
    }catch(f){
      console.log("Error in fetch call");
      console.error(f);
      return {
        outputs: { jobId: '', failure: true, aivUserId:'' }
      };
  }
});
