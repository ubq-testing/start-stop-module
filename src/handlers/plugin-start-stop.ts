import { GitHubIssue } from "../types";
import { Context } from "../types/context";
import { start } from "./shared/start";
import { stop } from "./shared/stop";

/**
 *
 * This means the plugin is being invoked either as part of a chain of plugins
 * via workflow_run.
 *
 * Times you'd expect this to be called to unassign someone?:
 *
 * - from inactivity plugin (hunter is beyond deadline for task)
 * - from an issue being closed with a hunter assigned as part of a chain maybe?
 * - from the GitHub UI firing the same assign.(un)assigned event, in this case,
 *   they've already been (un)assigned so close their PR accordingly if applicable
 *
 * Times this would be call to assign someone?:
 *
 * - /assign command
 * - automatic issue assignment/designation plugin maybe?
 */

export async function pluginStartStop(context: Context): Promise<{ output: string | null }> {
  const { payload, config } = context;
  const { issue, repository, sender } = JSON.parse(payload as unknown as string);
  const { directive, xpAmount } = config;

  let data: { output: string | null } = { output: null };

  // Should the directive be "assign" and "unassign" instead
  // as it's more clear what's happening from a plugin invoker perspective?
  if (directive === "start") {
    data = await start(context, issue, sender);
  }

  if (directive === "stop") {
    data = await stop(context, issue, sender, repository);
  }

  if (xpAmount) await xpHandler(xpAmount, issue);

  context.logger.error(`Unsupported directive: ${directive}`);

  return data;
}

async function xpHandler(xpAmount: number, issue: GitHubIssue) {
  // This is a placeholder for future updates that will handle XP
  console.log(`XP amount: ${xpAmount}`);
  console.log(`Issue: ${issue}`);
}
