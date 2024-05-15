import { Context } from "../../types/context";
import { closePullRequestForAnIssue } from "../shared/assign";

export async function stop(context: Context, body: string) {
  const logger = context.logger;
  if (!body.startsWith("/stop")) {
    return logger.fatal("Skipping to unassign", { body });
  }

  const payload = context.payload;
  logger.info("Running '/stop' command handler", { sender: payload.sender.login });
  const issue = payload.issue;
  if (!issue) {
    return logger.info(`Skipping '/stop' because of no issue instance`);
  }

  const issueNumber = issue.number;
  const assignees = payload.issue?.assignees ?? [];

  if (assignees.length == 0) {
    return logger.error("No assignees found for issue", { issueNumber });
  }
  const shouldUnassign = assignees[0]?.login.toLowerCase() == payload.sender.login.toLowerCase();
  logger.debug("Unassigning sender", {
    sender: payload.sender.login.toLowerCase(),
    assignee: assignees[0]?.login.toLowerCase(),
    shouldUnassign,
  });

  if (shouldUnassign) {
    await closePullRequestForAnIssue(context);
    const { login } = payload.repository.owner;
    const { name: repo } = payload.repository;
    await context.event.octokit.rest.issues.removeAssignees({
      owner: login,
      repo: repo,
      issue_number: issueNumber,
      assignees: [payload.sender.login],
    });
    return logger.ok("You have been unassigned from the task", {
      issueNumber,
      user: payload.sender.login,
    });
  }
  return logger.error("You are not assigned to this task", { issueNumber, user: payload.sender.login });
}
