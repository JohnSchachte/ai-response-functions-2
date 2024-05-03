import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const postAIResponseDef = DefineFunction({
  callback_id: "post_job_context",
  title: "Post AI Response to Slack Thread",
  description: "POST AI Response to Slack Thread",
  source_file: "functions/post_job_function.ts",
  input_parameters: {
        properties: {
            jobId: {
                type: Schema.types.string,
                description: "Id to request from backend",
            },
            messageContext: {
                type: Schema.slack.types.message_context,
                description: "Message Thread ID to reply to",
            },
            isCreatedFailure: {
              type: Schema.types.boolean,
              description: "Flag to indicate if job was created successfully"
            }
        },
        required: ["jobId","messageContext","isCreatedFailure"],
    },
    output_parameters: {
        properties: {
            jobId: {
                type: Schema.types.string,
                description: "JobId to poll job and retrieve AI Response",
            },
            isSuccess: {
                type: Schema.types.boolean,
                description: "Success flag",
            },
            messageContext: {
                type: Schema.slack.types.message_context,
                description: "Thread of message that was posted to",
            }
        },
        required: ["jobId","isSuccess","messageContext"],
    }
});

export default SlackFunction(
    postAIResponseDef,
  async ({ inputs, env, client }) => { // Make this function async
    console.log("Running postAIResponseDef function");
    console.log("Inputs: ", inputs);
    const startTime = Date.now(); // Get the current time in milliseconds to track how long function has been running
    startTime - Date.now(); // added because Deno is strict about unused variables

    // get the endpoint and AUTH_TOKEN from the env object
    const {ENDPOINT, AUTH_TOKEN} = env;
    const {jobId, messageContext,isCreatedFailure} = inputs; // let for testing purposes

    // Check if Job was created earlier in the workflow or if there was an error
    if(isCreatedFailure){
      console.log("Job was not created successfully. Exiting");
      return {
        outputs: { jobId, isSuccess: false, messageContext}
      };
    }

    console.log("Job was created successfully. Proceeding to attempt to fetch data from endpoint");

    try{
      // Use async/await syntax for the fetch call
      // TODO add jobId as a parameter to the endpoint
      const response = await fetch(`${ENDPOINT}/${jobId}`, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': AUTH_TOKEN,
        }
      });

      /* example of response:
        {
          "id": "6e5bc445-8fdf-44b9-ae78-52b912ca461f",
          "status": "completed",
          "answer": {
              "id": "00ae4ad5-8684-40c0-90c2-4ed3ffddcb6b",
              "content": "To void a payment on SkyTab POS, navigate to the Order > Completed and select the ticket. Then, select Void Payment, choose the payment from the list, and select Void. After voiding, the ticket reopens and moves to the Open tab on the Tickets grid. Finally, select the ticket and tap Payment Summary, the voided payment should be red. <hr/> Source(s): [Void a Payment on SkyTab POS](https://shift4.zendesk.com/hc/en-us/articles/13226119692179-Void-a-Payment-on-SkyTab-POS)",
              "hasResolution": true
          }
        }
      */

      const data = await response.json(); // Wait for the JSON response
      
      console.log("Successfully retrieved from endpoint. Data: ",data);
      
      const {status, answer} = data;

      if(status === "failed"){
        console.log("Job has failed. Exiting");
        console.log("status: ",status);
        console.log("answer: ",answer);
        return {
          outputs: { jobId, isSuccess: false, messageContext}
        };
      }

      const {hasResolution, content} = answer;
      if(!hasResolution){
        console.log("Answer not found. Exiting");
        console.log("hasResolution: ",hasResolution);
        console.log("context: ",content);
        return { 
          outputs: {
            jobId, isSuccess: false, messageContext
          } 
        };
      }

      if(status == "pending"){
        console.log("Job is still pending. Exiting");
        return { 
          outputs: {
            jobId, isSuccess: false, messageContext
          } 
        };
      }


      console.log("Job has completed successfully. Posting message to thread");
      console.log("context: ", content);
      
      // Post message to thread via Slack API using the messageThreadId
      // Use the context from the response to post the message
      // Use the messageThreadId to post the message to the correct thread
      // Use the AUTH_TOKEN from the env object
      try{
        const msgResponse = await client.apiCall("chat.postMessage", {
          channel: messageContext.channel_id,
          thread_ts: messageContext.message_ts,
          text: "Fallback text for notifications", // This text is displayed in notifications and clients that do not support blocks.
          blocks: [
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": content
              }
            }
          ],
          mrkdwn: true // This ensures Markdown is processed in the message text.
        });
        

        console.log("Message posted to thread. Response: ",msgResponse);
        
        // Return outputs directly within the async function after the value has been resolved
        return { outputs: { jobId, isSuccess: true, messageContext} };
      }catch(f){
        console.log("Error in posting message to thread");
        console.error(f);
        return {
          outputs: { jobId, isSuccess: false, messageContext}
        };
      }
    }catch(f){
      console.log("Error in fetch call");
      console.error(f);
      return {
        outputs: { jobId, isSuccess: false, messageContext}
      };
  }
});
