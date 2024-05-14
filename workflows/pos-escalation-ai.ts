import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { createAIResponseJobDef } from "../functions/create_job_function.ts";
import { postAIResponseDef } from "../functions/post_job_function.ts";
import { postUserRating } from "../functions/post_rating_function.ts";
import { deleteUserRating } from "../functions/delete_rating_function.ts";

/**
 * A workflow is a set of steps that are executed in order.
 * Each step in a workflow is a function.
 * https://api.slack.com/automation/workflows
 *
 * This workflow uses interactivity. Learn more at:
 * https://api.slack.com/automation/forms#add-interactivity
 */
const CreateAiTestWorkflow = DefineWorkflow({
  callback_id: "create_job_workflow",
  title: "Create Job workflow",
  description: "Create Job Workflow workflow",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
      channel: {
        type: Schema.slack.types.channel_id,
      },
      user: {
        type: Schema.slack.types.user_id,
      },
    },
    required: ["interactivity", "channel", "user"],
  },
});

/**
 * For collecting input from users, we recommend the
 * OpenForm Slack function as a first step.
 * https://api.slack.com/automation/functions#open-a-form
 */
const inputForm = CreateAiTestWorkflow.addStep(
  Schema.slack.functions.OpenForm,
  {
    title: "input form",
    interactivity: CreateAiTestWorkflow.inputs.interactivity,
    submit_label: "input form",
    fields: {
        elements: [
            {
                name: "externalRef",
                title: "externalRef",
                type: Schema.types.string
            },
            {
                name: "ticketLink",
                title: "ticketLink",
                type: Schema.types.string,
            },
            {
                name: "mid",
                title: "mid",
                type: Schema.types.number
            },
            {
                name: "dba",
                title: "dba",
                type: Schema.types.string
            },
            {
                name: "callerType",
                title: "callerType",
                type: Schema.types.string
            },
            {
                name: "softwareType",
                title: "softwareType",
                type: Schema.types.string
            },
            {
                name: "escalationType",
                title: "escalationType",
                type: Schema.types.string
            },
            {
                name: "escalationReason",
                title: "escalationReason",
                type: Schema.types.string
            },
            {
                name: "merchantReason",
                title: "merchantReason",
                type: Schema.types.string
            },
            {
                name: "additionalContext",
                title: "additionalContext",
                type: Schema.types.string
            },
        ],
      required: ["externalRef", "ticketLink", "mid", "dba", "callerType", "softwareType", "escalationType", "escalationReason", "merchantReason", "additionalContext"],
    },
  },
);

/**
 * Custom functions are reusable building blocks
 * of automation deployed to Slack infrastructure. They
 * accept inputs, perform calculations, and provide
 * outputs, just like typical programmatic functions.
 * https://api.slack.com/automation/functions/custom
 */
const createAIResponseJobStep = CreateAiTestWorkflow.addStep(createAIResponseJobDef, {
  externalRef: inputForm.outputs.fields.externalRef,
  ticketLink: inputForm.outputs.fields.ticketLink,
  mid: inputForm.outputs.fields.mid,
  dba: inputForm.outputs.fields.dba,
  callerType: inputForm.outputs.fields.callerType,
  softwareType: inputForm.outputs.fields.softwareType,
  escalationType: inputForm.outputs.fields.escalationType,
  escalationReason: inputForm.outputs.fields.escalationReason,
  merchantReason: inputForm.outputs.fields.merchantReason,
  additionalContext: inputForm.outputs.fields.additionalContext,
});

/**
 * SendMessage is a Slack function. These are
 * Slack-native actions, like creating a channel or sending
 * a message and can be used alongside custom functions in a workflow.
 * https://api.slack.com/automation/functions
 */
const sendJobIdMessage = CreateAiTestWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: CreateAiTestWorkflow.inputs.channel,
  message: createAIResponseJobStep.outputs.jobId,
});

CreateAiTestWorkflow.addStep(postAIResponseDef, {
  jobId: "123",
  isCreatedFailure: true,
  messageContext: sendJobIdMessage.outputs.message_context, // Ensure this is the correct output from the previous SendMessage step
});

CreateAiTestWorkflow.addStep(postUserRating, {
  feedback: "good",
  comment: "Great AI Response",
  isPostSuccess: true,
  answerId: "123"
});

CreateAiTestWorkflow.addStep(deleteUserRating, {
  answerId: "123"
});

export default CreateAiTestWorkflow;
