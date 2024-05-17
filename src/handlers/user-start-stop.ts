import { Context } from "../types";
import { start } from "./shared/start";
import { stop } from "./shared/stop";

export async function userStartStop(context: Context): Promise<{ output: string | null }> {
  const { payload, logger, config } = context;
  const { issue, comment, sender, repository } = payload as Context<"issue_comment.created">["payload"];
  const directive = comment.body.split(" ")[0].replace("/", "");
  const { disabledCommands } = config;
  const isCommandDisabled = disabledCommands.some((command: string) => command === directive);

  if (isCommandDisabled) {
    throw logger.error(`The '/${directive}' command is disabled for this repository.`);
  }

  if (directive === "stop") {
    await stop(context, issue, sender, repository);
  } else if (directive === "start") {
    await start(context, issue, sender);
  }
  return { output: null };
}
