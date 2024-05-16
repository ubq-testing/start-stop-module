import { Context } from "../types/context";
import { isParentIssue } from "./shared/handle-parent-issue";
import { addAssignees, getAssignedIssues, getAvailableOpenedPullRequests } from "../utils/issue";
import { IssueType } from "../types";
import { getTimeLabelsAssigned } from "./shared/get-time-labels-assigned";
import { calculateDurations } from "../utils/shared";
import { generateAssignmentComment } from "./shared/generate-assignment-comment";
import structuredMetadata from "./shared/structured-metadata";
import { assignTableComment } from "./shared/table";
import { checkTaskStale } from "./shared/check-task-stale";
import { getMultiplierInfoToDisplay } from "./shared/get-multiplier-info";

export async function userStartStop(context: Context, command: string): Promise<object> {
  const { logger, config, payload } = context;
  const { maxConcurrentTasks } = config.miscellaneous;
  const { taskStaleTimeoutDuration } = config.timers;
  let directive = command.split(" ")[0].replace("/", "");

  if (directive === "stop") {
    // todo
    return {};
  } else if (directive !== "start") {
    // todo
    throw logger.error(`Invalid command: ${directive}`);
  }

  // is command disabled?

  const { disabledCommands } = config;
  const isCommandDisabled = disabledCommands.some((command: string) => command === directive);

  if (isCommandDisabled) {
    throw logger.error(`The '/${directive}' command is disabled for this repository.`);
  }

  if ("issue" in payload === false) {
    throw logger.error(`Skipping '/${directive}' because of no issue instance`);
  }

  const issue = payload.issue;
  // is it a child issue?

  if (issue.body && isParentIssue(issue.body)) {
    throw logger.error("Please select a child issue from the specification checklist to work on. The '/start' command is disabled on parent issues.");
  }

  // check max assigned issues
  const openedPullRequests = await getAvailableOpenedPullRequests(context, payload.sender.login);
  logger.info(`Opened Pull Requests with approved reviews or with no reviews but over 24 hours have passed: ${JSON.stringify(openedPullRequests)}`);

  const assignedIssues = await getAssignedIssues(context, payload.sender.login);
  logger.info("Max issue allowed is", maxConcurrentTasks);

  // check for max and enforce max
  if (assignedIssues.length - openedPullRequests.length >= maxConcurrentTasks) {
    throw logger.error("Too many assigned issues, you have reached your max limit", {
      maxConcurrentTasks,
    });
  }

  // is it assignable?

  if (issue.state === IssueType.CLOSED) {
    throw logger.error(`Skipping '/${directive}' since the issue is closed`);
  }

  const assignees = (issue?.assignees ?? []).filter(Boolean);
  if (assignees.length !== 0) {
    throw logger.error(`Skipping '/${directive}' since the issue is already assigned`);
  }

  // get labels

  const labels = issue.labels;
  const priceLabel = labels.find((label) => label.name.startsWith("Price: "));

  let duration: number | null = null;

  if (!priceLabel) {
    throw logger.error(`Skipping '/${directive}' since no price label is set to calculate the duration`);
  }

  const timeLabelsAssigned = getTimeLabelsAssigned(context, payload, config);
  if (timeLabelsAssigned) {
    duration = calculateDurations(timeLabelsAssigned).shift() || null;
  }

  const { id, login } = payload.sender;

  const comment = await generateAssignmentComment(context, issue.created_at, id, duration);
  const metadata = structuredMetadata.create("Assignment", { duration, priceLabel });

  // add assignee
  if (!assignees.map((i) => i.login).includes(login)) {
    logger.info("Adding the assignee", { assignee: login });
    await addAssignees(context, issue.number, [login]);
  }

  // is it stale?
  const isTaskStale = checkTaskStale(taskStaleTimeoutDuration, issue.created_at);

  // get multiplier infos
  const { multiplierAmount, multiplierReason, totalPriceOfTask } = await getMultiplierInfoToDisplay(
    context,
    payload.sender.id,
    payload.repository.id,
    issue.labels
  );

  return {
    output: [
      assignTableComment({
        multiplierAmount,
        multiplierReason,
        totalPriceOfTask,
        isTaskStale,
        daysElapsedSinceTaskCreation: comment.daysElapsedSinceTaskCreation,
        taskDeadline: comment.deadline,
        registeredWallet: comment.registeredWallet,
      }),
      comment.tips,
      metadata,
    ].join("\n"),
  };
}
