/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from "../types/context";
import { addAssignees, closePullRequestForAnIssue, getAssignedIssues, getAvailableOpenedPullRequests, isParentIssue } from "../utils/issue";
import { GitHubUser, IssueType, Label } from "../types";
import { getTimeLabelsAssigned } from "./shared/get-time-labels-assigned";
import { calculateDurations } from "../utils/shared";
import { generateAssignmentComment } from "./shared/generate-assignment-comment";
import structuredMetadata from "./shared/structured-metadata";
import { assignTableComment } from "./shared/table";
import { checkTaskStale } from "./shared/check-task-stale";
import { getMultiplierInfoToDisplay } from "./shared/get-multiplier-info";

export async function userStartStop(context: Context): Promise<{ output: string | null }> {
  const { payload, logger, config } = context;
  const { issue, comment, sender, repository } = JSON.parse(payload as unknown as string) as Context<"issue_comment.created">["payload"];
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

async function start(context: Context, issue: any, sender: { id: number; login: string }) {
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
  const priceLabel = labels.find((label: Label) => label.name.startsWith("Price: "));

  let duration: number | null = null;

  if (!priceLabel) {
    throw logger.error(`Skipping '/start' since no price label is set to calculate the duration`);
  }

  const timeLabelsAssigned = getTimeLabelsAssigned(context, issue.labels, config);
  if (timeLabelsAssigned) {
    duration = calculateDurations(timeLabelsAssigned).shift() || null;
  }

  const { id, login } = sender;
  const toCreate = { duration, priceLabel };

  const assignmentComment = await generateAssignmentComment(context, issue.created_at, id, duration);
  const metadata = structuredMetadata.create<typeof toCreate>("Assignment", toCreate);

  // add assignee

  if (!assignees.map((i: GitHubUser) => i.login).includes(login)) {
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

async function stop(context: Context, issue: any, sender: { id: number; login: string }, repo: any) {
  const { logger } = context;
  const issueNumber = issue.number;

  // is it an issue?
  if (!issue) {
    logger.info(`Skipping '/stop' because of no issue instance`);
    return { output: null };
  }

  // is there an assignee?
  const assignees = issue.assignees ?? [];
  if (assignees.length == 0) {
    logger.error("No assignees found for issue", { issueNumber });
    return { output: null };
  }

  // should unassign?

  const shouldUnassign = assignees[0]?.login.toLowerCase() == sender.login.toLowerCase();

  if (!shouldUnassign) {
    logger.error("You are not assigned to this task", { issueNumber, user: sender.login });
    return { output: null };
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

  return { output: null };
}
