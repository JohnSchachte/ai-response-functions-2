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
    "isOwnerVerified": "Technical Support",
    "softwareType": "CRM",
    "escalationType": "Urgent",
    "escalationReason": "System Down",
    "merchantReason": "Unable to process payments",
    "additionalContext": "How to void a payment on Skytab POS"
  }
}'
*/
export const createAIResponseJobCSDef = DefineFunction({
  callback_id: "create_job_CS",
  title: "Create CS AI Response Job",
  description: "NEW Create AI Response Job",
  source_file: "functions/create_job_CS_function.ts",
  input_parameters: {
    properties: {
        submitterSlackUserId:{
          type: Schema.types.string,
          description: "Submitter's Slack User Id"
        },
        submitterSlackName: {
          type: Schema.types.string,
          description: "Submitter's Slack User Display Name"
        },
        submitterSlackEmail: {
          type: Schema.types.string,
          description: "Submitter's Slack Email"
        },
        linkToResource: {
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
        isOwnerVerified: {
            type: Schema.types.string,
            description: "Yes or No dropdown option",
        },
        scenario: {
            type: Schema.types.string,
            description: "Similar escalation type",
        },
        additionalNotes: {
            type: Schema.types.string,
            description: "Additional Context",
        },
        contactName: {
            type: Schema.types.string,
            description: "Name of merchant (free form answers from agents)",
        }
    },
    required: ["linkToResource", "ticketLink", "mid", "dba", "isOwnerVerified", "additionalNotes"],
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
  createAIResponseJobCSDef,
  async ({ inputs, env }) => {

    if(!inputs.additionalNotes){
      return {
        outputs: { jobId: '', failure: true,aivUserId:'' }
      };
    }

    const {AUTH_TOKEN,IS_PROD} = env;

    let ENDPOINT;
    IS_PROD == "true" ? ENDPOINT = env.CS_PROD_ENDPOINT : ENDPOINT = env.CS_ENDPOINT
    console.log("Endpoint used: " + ENDPOINT);

    
    let aivUserId;
    const submitterSlackUserId = inputs.submitterSlackUserId;
    const submitterSlackName = inputs.submitterSlackName;
    const submitterSlackEmail = inputs.submitterSlackEmail;


    try {
      // 1. Make the fetch call
      const postUserResponse = await fetch(`${ENDPOINT}users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
        body: JSON.stringify({
          externalId: submitterSlackUserId,
          name: submitterSlackName,
          email: submitterSlackEmail,
        }),
      });
      delete inputs["submitterSlackUserId"];
      delete inputs["submitterSlackName"];
      delete inputs["submitterSlackEmail"];
      
      // 2. Check for a non-2xx response
      if (!postUserResponse.ok) {
        console.error('HTTP error for Post User', postUserResponse.status, await postUserResponse.text());
        return {
          outputs: { jobId: '', failure: true, aivUserId:'' }
        };
      }

      // 3. Parse out the user ID
      const userData = await postUserResponse.json();
      // The key here depends on the API response structure:
      // e.g., userData.id or userData.userId or something else
      aivUserId = userData.id;
      console.log(`User id: ${aivUserId}`)
    } catch (f) {
      console.log("Error in fetch call for posting user");
      console.error(f);
      return {
        outputs: { jobId: '', failure: true,aivUserId:'' }
      };
    }


    try{

      type InputsWithBoolean = Record<string, string | boolean>;

      // Make a shallow copy
      const context: InputsWithBoolean = { ...inputs };
  
      // Transform isOwnerVerified from string to boolean (shallow copy will let us modify it)
      if (context.isOwnerVerified === "Yes") {
        context.isOwnerVerified = true;
      } else {
        context.isOwnerVerified = false;
      }
      
      // Log the env and inputs to the console ONLY locally
      console.log(`inputs: ${JSON.stringify(inputs)}`);
      console.log(`body: ${JSON.stringify({
        context: context
      })}`);
  

      // Use async/await syntax for the fetch call
      const response = await fetch(`${ENDPOINT}jobs`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': AUTH_TOKEN,
              'X-User-Id': aivUserId
          },
          body: JSON.stringify({
              context: context,
          }),
      });

      if (!response.ok) {
          console.error('HTTP error in Creating Job', response.status, await response.text());
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