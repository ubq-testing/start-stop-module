import { Context } from "../../types";
import { addCommentToIssue, closePullRequestForAnIssue } from "../../utils/issue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function stop(context: Context, issue: any, sender: { id: number; login: string }, repo: any) {
  const { logger } = context;
  const issueNumber = issue.number;

  // is it an issue?
  if (!issue) {
    logger.info(`Skipping '/stop' because of no issue instance`);
    return;
  }

  // is there an assignee?
  const assignees = issue.assignees ?? [];
  if (assignees.length == 0) {
    logger.error("No assignees found for issue", { issueNumber });
    return;
  }

  // should unassign?

  const shouldUnassign = assignees[0]?.login.toLowerCase() == sender.login.toLowerCase();

  if (!shouldUnassign) {
    logger.error("You are not assigned to this task", { issueNumber, user: sender.login });
    return;
  }

  // close PR

  await closePullRequestForAnIssue(context, issueNumber, repo);

  const {
    name,
    owner: { login },
  } = repo;

  // remove assignee

  await context.octokit.rest.issues.removeAssignees({
    owner: login,
    repo: name,
    issue_number: issueNumber,
    assignees: [sender.login],
  });

  logger.info("You have been unassigned from the task", {
    issueNumber,
    user: sender.login,
  });

  addCommentToIssue(context, "````diff\n+ You have been unassigned from this task.\n````").catch(console.error);
}
