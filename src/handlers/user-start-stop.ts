import { Context } from "../types/context";
import { isParentIssue } from "./shared/handle-parent-issue";
import { addAssignees, getAssignedIssues, getAvailableOpenedPullRequests } from "../utils/issue";
import { GitHubIssue, GitHubRepository, IssueType } from "../types";
import { getTimeLabelsAssigned } from "./shared/get-time-labels-assigned";
import { calculateDurations } from "../utils/shared";
import { generateAssignmentComment } from "./shared/generate-assignment-comment";
import structuredMetadata from "./shared/structured-metadata";
import { assignTableComment } from "./shared/table";
import { checkTaskStale } from "./shared/check-task-stale";
import { getMultiplierInfoToDisplay } from "./shared/get-multiplier-info";
import { closePullRequestForAnIssue } from "./shared/assign";

export async function userStartStop(context: Context): Promise<{ output: string | null }> {
  const { payload, logger, config } = context;
  const { issue, comment, sender, repository } = JSON.parse(payload) as Context<"issue_comment.created">["payload"];
  const directive = comment.body.split(" ")[0].replace("/", "");
  const { disabledCommands } = config;
  const isCommandDisabled = disabledCommands.some((command: string) => command === directive);

  if (isCommandDisabled) {
    throw logger.error(`The '/${directive}' command is disabled for this repository.`);
  }

  if (directive === "stop") {
    return await stop(context, issue, sender, repository);
  } else if (directive === "start") {
    return await start(context, issue, sender);
  }
  return { output: null };
}

async function start(context: Context, issue: GitHubIssue, sender: { id: number; login: string }) {
  const { logger, config } = context;
  const { maxConcurrentTasks } = config.miscellaneous;
  const { taskStaleTimeoutDuration } = config.timers;

  // is it a child issue?

  if (issue.body && isParentIssue(issue.body)) {
    throw logger.error("Please select a child issue from the specification checklist to work on. The '/start' command is disabled on parent issues.");
  }

  // check max assigned issues

  const openedPullRequests = await getAvailableOpenedPullRequests(context, sender.login);
  logger.info(`Opened Pull Requests with approved reviews or with no reviews but over 24 hours have passed: ${JSON.stringify(openedPullRequests)}`);

  const assignedIssues = await getAssignedIssues(context, sender.login);
  logger.info("Max issue allowed is", maxConcurrentTasks);

  // check for max and enforce max

  if (assignedIssues.length - openedPullRequests.length >= maxConcurrentTasks) {
    throw logger.error("Too many assigned issues, you have reached your max limit", {
      maxConcurrentTasks,
    });
  }

  // is it assignable?

  if (issue.state === IssueType.CLOSED) {
    throw logger.error(`Skipping '/start' since the issue is closed`);
  }

  const assignees = (issue?.assignees ?? []).filter(Boolean);
  if (assignees.length !== 0) {
    throw logger.error(`Skipping '/start' since the issue is already assigned`);
  }

  // get labels

  const labels = issue.labels;
  const priceLabel = labels.find((label) => label.name.startsWith("Price: "));

  let duration: number | null = null;

  if (!priceLabel) {
    throw logger.error(`Skipping '/start' since no price label is set to calculate the duration`);
  }

  const timeLabelsAssigned = getTimeLabelsAssigned(context, issue.labels, config);
  if (timeLabelsAssigned) {
    duration = calculateDurations(timeLabelsAssigned).shift() || null;
  }

  const { id, login } = sender;

  const assignmentComment = await generateAssignmentComment(context, issue.created_at, id, duration);
  const metadata = structuredMetadata.create("Assignment", { duration, priceLabel });

  // add assignee

  if (!assignees.map((i) => i.login).includes(login)) {
    logger.info("Adding the assignee", { assignee: login });
    await addAssignees(context, issue.number, [login]);
  }

  const isTaskStale = checkTaskStale(taskStaleTimeoutDuration, issue.created_at);
  const { multiplierAmount, multiplierReason, totalPriceOfTask } = await getMultiplierInfoToDisplay(context, issue.labels);

  return {
    output: [
      assignTableComment({
        multiplierAmount,
        multiplierReason,
        totalPriceOfTask,
        isTaskStale,
        daysElapsedSinceTaskCreation: assignmentComment.daysElapsedSinceTaskCreation,
        taskDeadline: assignmentComment.deadline,
        registeredWallet: assignmentComment.registeredWallet,
      }),
      assignmentComment.tips,
      metadata,
    ].join("\n"),
  };
}

async function stop(context: Context, issue: GitHubIssue, sender: { id: number; login: string }, repo: GitHubRepository) {
  const { logger } = context;
  const issueNumber = issue.number;

  // is it an issue?
  if (!issue) {
    return logger.info(`Skipping '/stop' because of no issue instance`);
  }

  // is there an assignee?
  const assignees = issue.assignees ?? [];
  if (assignees.length == 0) {
    return logger.error("No assignees found for issue", { issueNumber });
  }

  // should unassign?

  const shouldUnassign = assignees[0]?.login.toLowerCase() == sender.login.toLowerCase();

  if (!shouldUnassign) {
    return logger.error("You are not assigned to this task", { issueNumber, user: sender.login });
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

  return logger.info("You have been unassigned from the task", {
    issueNumber,
    user: sender.login,
  });
}
