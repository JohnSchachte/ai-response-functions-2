// /slack-samples/deno-hello-world/functions/greeting_function.ts
import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const postUserRating = DefineFunction({
  callback_id: "post_rating",
  title: "Posts User AI Feedback",
  description: "Posts the user rating to the AI backend endpoints for storage in db",
  source_file: "functions/post_rating_function.ts",
  input_parameters: {
    properties: {
        feedback: {
            type: Schema.types.string,
            description: "binary response to the AI response (thumbs up or thumbs down) or 'No AI Response'.",
        },
        comment: {
            type: Schema.types.string,
            description: "optional additional context of why the agent felt the way they did about the AI response",
        },
        isPostSuccess: {
            type: Schema.types.boolean,
            description: "Flag to indicate if the post was successful for the message thread in the claimer's thread. If false, then skip.",
        },
        answerId: {
          type: Schema.types.string,
          description: "Id of the answer produced by the AI response job",
        }
    },
    required: ["feedback","isPostSuccess"],
  }
});

export default SlackFunction(
  postUserRating,
  async ({ inputs, env }) => { // Make this function async

    const {AUTH_TOKEN,IS_PROD} = env;

    let ENDPOINT;
    IS_PROD == "true" ? ENDPOINT = env.PROD_ENDPOINT : ENDPOINT = env.ENDPOINT;
    
    // Log the env and inputs to the console ONLY locally
    console.log(`inputs: ${JSON.stringify(inputs)}`);

    // check if upstream steps were successful
    if (inputs.answerId == null) {
      console.log("Skipping post rating function because no answerId was provided.");
      return { outputs: {} };
    }
    

    let emoji;
    if(inputs.feedback == "Good") emoji = "thumbup";
    else if(inputs.feedback == "Bad") emoji = "thumbdown";
    else emoji = inputs.feedback;
    
    const comment = inputs.comment, answerId = inputs.answerId;

    const postData = JSON.stringify({
      emoji: emoji,
      comment: comment
    })
  
    console.log(`body: ${postData}`);

    try{
      /* example of a fetch call to the endpoint
      curl --location '{{base}}/answers/:answerId/owner-vote' \ --header 'Content-Type: application/json' \ --header 'Authorization: {{token}}' \ --data '{ "emoji": "thumbup||thumbdown", "comment": "My comment text or null" }'
      */
      // Use async/await syntax for the fetch call
      const response = await fetch(`${ENDPOINT}/${answerId}/owner-vote`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': AUTH_TOKEN,
          },
          body: postData
      });

      if (!response.ok) {
          console.error('HTTP error', response.status, await response.text());
          return { outputs: {} };
      }
      console.log("Successfully posted user rating to AI response job with id: ", answerId);
      return { outputs: {} };

    }catch(f){
      console.log("Error in fetch call");
      console.error(f);
      return { outputs: {} };
  }
});
