import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const postAIResponseDef = DefineFunction({
  callback_id: "post_job_context",
  title: "Post AI Response to Slack Thread",
  description: "POST AI Response to Slack Thread",
  source_file: "functions/post_job_function.ts",
  input_parameters: {
        properties: {
            aivUserId: {
              type: Schema.types.string,
              description: "User Id that AI team wants me to keep putting in the header.",
            },
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
            },
            additionalContext: {
              type: Schema.types.string,
              description: "Additional Context",
            },
            endpointIndicator: {
              type: Schema.types.string,
              description: "A string indicator to use with environment object to get the correct endpoint"
            },
            stringIsCreatedFailure: {
              type: Schema.types.string,
              description: "Used when isCreatedFailure is null"
            }
        },
        required: ["aivUserId","jobId","messageContext","endpointIndicator"],
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
            },
            answerId: {
              type: Schema.types.string,
              description: "Id of the answer produced by the AI response job",
            },
            aiAnswer : {
              type: Schema.types.string,
              description: "AI Answer",
            }
        },
        required: ["jobId","isSuccess","messageContext"],
    }
});

export default SlackFunction(
  postAIResponseDef,
  async ({ inputs, env, client }) => {

    console.log("Running postAIResponseDef function");
    console.log("Inputs: ", inputs);

    const isDev = false; // Set to true to enable DMs to yourself instead of posting to the original thread

    // get the endpoint and AUTH_TOKEN from the env object
    const { AUTH_TOKEN, IS_PROD } = env;

    const ENDPOINT = env[inputs.endpointIndicator];

    
    // const ENDPOINT = IS_PROD === "true" ? env.PROD_ENDPOINT : env.ENDPOINT;
    const waitTime = IS_PROD === "true" ? 20000 : 5000

    const { jobId, messageContext, isCreatedFailure, additionalContext } = inputs;

    // Check if Job was created earlier in the workflow or if there was an error
    if (isCreatedFailure || inputs.stringIsCreatedFailure == "true") {
      console.log("Job was not created successfully. Exiting");
      return {
        outputs: { jobId, isSuccess: false, messageContext }
      };
    }

    console.log("Job was created successfully. Proceeding to attempt to fetch data from endpoint");

    // NEW: We'll make up to 3 attempts, each separated by 20 seconds if needed.
    let attemptCount = 0;
    let data; 
    while (attemptCount < 3) {
      attemptCount++;
      console.log(`Attempt #${attemptCount} to fetch job status for jobId: ${jobId}`);

      try {
        // 1) Make the request
        const response = await fetch(`${ENDPOINT}jobs/${jobId}?answerFormat=slack`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': AUTH_TOKEN,
            'X-User-Id': inputs.aivUserId
          }
        });

        // 2) Check response
        if (!response.ok) {
          console.error('HTTP error', response.status, await response.text());
          return {
            outputs: { jobId, isSuccess: false, messageContext }
          };
        }

        data = await response.json();
        console.log("Successfully retrieved from endpoint. Data: ", data);

        const { status } = data;

        // 3) If it’s still “processing” or “precessing”, wait 20s (unless this is the last attempt)
        //    Slack function max execution time is ~50s, so we have time for only ~2 pauses.
        if (status === "processing" || status === "precessing") {
          console.log(`Backend is still processing (status: ${status}).`);
          if (attemptCount < 3) {
            console.log(`Waiting ${waitTime} seconds before next attempt...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue; // go to next iteration
          } else {
            // This is the 3rd attempt and still processing; give up
            console.log("Reached maximum attempts. Exiting with no resolution.");
            return {
              outputs: { jobId, isSuccess: false, messageContext, aiAnswer: "Processing Timeout" }
            };
          }
        }
        
        // 4) If job is “failed”, exit
        if (status === "failed") {
          console.log("Job has failed. Exiting.");
          return {
            outputs: { jobId, isSuccess: false, messageContext, aiAnswer: status }
          };
        }
        
        // 5) If job is “completed” or anything other than “processing” or “failed”, break out of the loop
        console.log("Job status is:", status);
        break;

      } catch (err) {
        console.log("Error in fetch call", err);
        // Usually, if you had an error in the fetch, you can decide whether to attempt again
        // or just fail. Since it’s likely a system error, we can just fail here:
        return {
          outputs: { jobId, isSuccess: false, messageContext, aiAnswer: "Error in fetching answer" }
        };
      }
    }

    // By the time we’re out of the loop, either:
    // - We have `data` from a successful fetch with `status` = "completed"
    // - We returned from the loop if we timed out or an error happened

    // 6) Proceed with the normal “post message to Slack” logic
    try {
      const { answer } = data;
      const { hasResolution, content } = answer;
      const answerId = answer.id;

      if (!hasResolution) {
        console.log("Answer not found. Exiting");
        return {
          outputs: { 
            jobId, 
            isSuccess: false, 
            messageContext, 
            answerId, 
            aiAnswer: "No Resolution" 
          }
        };
      }

      console.log("Job has completed successfully. Posting message to thread");
      console.log("AI content: ", content);

      // Post message to thread via Slack API using the messageThreadId
      try {
        let msgResponse;
        const fallbackText = "AI Response for Priority Request";
        const cautionText = "Please proceed with caution: the following text was generated by an AI model trained on Knowledge Base articles";

        if (isDev) {
          // In dev mode, post directly to your Slack user ID
          msgResponse = await client.apiCall("chat.postMessage", {
            channel: "U027M00S74H",
            text: fallbackText,
            blocks: [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "original text from the agent about the escalation\n" + additionalContext
                }
              },
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": `*${cautionText}*: \n${content}`
                }
              }
            ],
            mrkdwn: true
          });
          console.log("Message posted to me in dev mode. Response: ", msgResponse);

        } else {
          // Normal operation: post into the thread from the user’s escalation message
          msgResponse = await client.apiCall("chat.postMessage", {
            channel: messageContext.channel_id,
            thread_ts: messageContext.message_ts,
            text: fallbackText,
            blocks: [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "*Original Context from Submitter:*\n" + additionalContext
                }
              },
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": `*${cautionText}*: \n${content}`
                }
              }
            ],
            mrkdwn: true
          });
          console.log("Message posted into thread not in dev mode. Response: ", msgResponse);
        }

        // Return success outputs
        console.log("Returning outputs", JSON.stringify({ 
          outputs: { 
            jobId, 
            isSuccess: true, 
            messageContext, 
            answerId, 
            aiAnswer: content 
          } 
        }));

        return { 
          outputs: { 
            jobId, 
            isSuccess: true, 
            messageContext, 
            answerId, 
            aiAnswer: content 
          } 
        };

      } catch (f) {
        console.log("Error in posting message to thread");
        console.error(f);
        return {
          outputs: { 
            jobId, 
            isSuccess: false, 
            messageContext, 
            aiAnswer: content 
          }
        };
      }

    } catch (f) {
      // Any unexpected error in the final chunk
      console.log("Error handling final response data:", f);
      return {
        outputs: { 
          jobId, 
          isSuccess: false, 
          messageContext, 
          aiAnswer: "Error in final data handling" 
        }
      };
    }
  }
);
