// /slack-samples/deno-hello-world/functions/greeting_function.ts
import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const deleteUserRating = DefineFunction({
  callback_id: "delete_rating",
  title: "Delete User AI Feedback",
  description: "Delete the user rating to the AI backend endpoints for storage in db",
  source_file: "functions/delete_rating_function.ts",
  input_parameters: {
    properties: {
        answerId: {
          type: Schema.types.string,
          description: "Id of the answer produced by the AI response job",
        }
    },
    required: [],
  }
});

export default SlackFunction(
  deleteUserRating,
  async ({ inputs, env }) => { // Make this function async

    // get the endpoint and AUTH_TOKEN from the env object
    
    const {AUTH_TOKEN,IS_PROD} = env;

    let ENDPOINT;
    IS_PROD == "true" ? ENDPOINT = env.PROD_ANSWER_ENDPOINT : ENDPOINT = env.ANSWER_ENDPOINT;
    
    
    // Log the inputs to the console
    console.log(`inputs: ${JSON.stringify(inputs)}`);

    // check if upstream steps were successful
    if (inputs.answerId == null) {
      console.log("Skipping deletion rating function because no answerId was provided.");
      return { outputs: {} };
    }
    const answerId = inputs.answerId;
    
    try{
      /* example of a fetch call to the endpoint
        curl --location --request DELETE 'https://aiv-api-development.shift4payments.com/gpt-rag/api/integration/v1/agents/internal-support-escalation-workflow/answers/:answerId/owner-vote' \
        --header 'Authorization: xxxx'
      */
      // Use async/await syntax for the fetch call
      const response = await fetch(`${ENDPOINT}/${answerId}/owner-vote`, {
          method: 'DELETE',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': AUTH_TOKEN,
          }
      });

      if (!response.ok) {
          console.error('HTTP error', response.status, await response.text());
          return { outputs: {} };
      }
      console.log("Successfully deleted user rating to AI response job with id: ", answerId);
      return { outputs: {} };

    }catch(f){
      console.log("Error in fetch call");
      console.error(f);
      return { outputs: {} };
  }
});
