import * as github from "@actions/github";
import { Octokit } from "@octokit/rest";
import { Value } from "@sinclair/typebox/value";
import { createClient } from "@supabase/supabase-js";
import { createAdapters } from "./adapters";
import { Database } from "./adapters/supabase/types/database";
import { Context } from "./types/context";
import { envSchema } from "./types/env";
import { startStopSchema, PluginInputs } from "./types/plugin-input";
import { userStartStop } from "./handlers/user-start-stop";
import { pluginStartStop } from "./handlers/plugin-start-stop";

export async function startStopBounty() {
  const payload = github.context.payload.inputs;

  const env = Value.Decode(envSchema, process.env);
  const settings = Value.Decode(startStopSchema, JSON.parse(payload.settings));

  const inputs: PluginInputs = {
    stateId: payload.stateId,
    eventName: payload.eventName,
    eventPayload: payload.eventPayload,
    settings,
    authToken: env.SUPABASE_KEY,
    ref: payload.ref,
  };

  const octokit = new Octokit({ auth: inputs.authToken });
  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_KEY);

  const context: Context = {
    eventName: inputs.eventName,
    payload: inputs.eventPayload,
    config: inputs.settings,
    octokit,
    env,
    logger: {
      debug(message: unknown, ...optionalParams: unknown[]) {
        console.debug(message, ...optionalParams);
      },
      info(message: unknown, ...optionalParams: unknown[]) {
        console.log(message, ...optionalParams);
      },
      warn(message: unknown, ...optionalParams: unknown[]) {
        console.warn(message, ...optionalParams);
      },
      error(message: unknown, ...optionalParams: unknown[]) {
        console.error(message, ...optionalParams);
      },
      fatal(message: unknown, ...optionalParams: unknown[]) {
        console.error(message, ...optionalParams);
      },
    },
    adapters: {} as ReturnType<typeof createAdapters>,
  };

  context.adapters = createAdapters(supabase, context);

  let output: object = {};

  if (context.eventName === "issue_comment.created") {
    output = await userStartStop(context, octokit);
  } else {
    output = await pluginStartStop(context, octokit);
  }

  await returnDataToKernel(env.GITHUB_TOKEN, inputs.stateId, output);

  return null;
}

async function returnDataToKernel(repoToken: string, stateId: string, output: object) {
  const octokit = new Octokit({ auth: repoToken });
  await octokit.repos.createDispatchEvent({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    event_type: "return_data_to_ubiquibot_kernel",
    client_payload: {
      state_id: stateId,
      output: JSON.stringify(output),
    },
  });
}
