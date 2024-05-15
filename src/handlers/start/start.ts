import { Context } from "../../types/context";
import { addAssignees, getAssignedIssues, getAvailableOpenedPullRequests } from "../../utils/issue";
import { calculateDurations } from "../../utils/shared";

import { checkTaskStale } from "../shared/check-task-stale";
import { generateAssignmentComment } from "../shared/generate-assignment-comment";
import { getMultiplierInfoToDisplay } from "../shared/get-multiplier-info";
import { getTimeLabelsAssigned } from "../shared/get-time-labels-assigned";
import { isParentIssue } from "../shared/handle-parent-issue";
import structuredMetadata from "../shared/structured-metadata";
import { assignTableComment } from "../shared/table";

export async function start(context: Context, body: string) {
  const logger = context.logger;
  const config = context.config;
  const payload = context.payload;
  const issue = payload.issue;
  const {
    miscellaneous: { maxConcurrentTasks },
    timers: { taskStaleTimeoutDuration },
    disabledCommands,
  } = context.config;

  const isStartDisabled = disabledCommands.some((command: string) => command === "start");

  logger.info("Received '/start' command", { sender: payload.sender.login, body });

  if (!issue) {
    throw logger.error(`Skipping '/start' because of no issue instance`);
  }

  if (isStartDisabled) {
    throw logger.error("The `/assign` command is disabled for this repository.");
  }

  if (issue.body && isParentIssue(issue.body)) {
    throw logger.error("Please select a child issue from the specification checklist to work on. The '/start' command is disabled on parent issues.");
  }

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

  if (issue.state == IssueType.CLOSED) {
    throw logger.error("Skipping '/start' since the issue is closed");
  }
  const assignees: GitHubUser[] = (payload.issue?.assignees ?? []).filter(Boolean) as GitHubUser[];

  if (assignees.length !== 0) {
    throw logger.error("Skipping '/start' since the issue is already assigned");
  }

  // ==== preamble checks completed ==== //

  const labels = issue.labels;
  const priceLabel = labels.find((label) => label.name.startsWith("Price: "));

  let duration: number | null = null;
  if (!priceLabel) {
    throw logger.error("No price label is set, so this is not ready to be self assigned yet.", priceLabel);
  } else {
    const timeLabelsAssigned = getTimeLabelsAssigned(context, payload, config);
    if (timeLabelsAssigned) {
      duration = calculateDurations(timeLabelsAssigned).shift() || null;
    }
  }

  const comment = await generateAssignmentComment(context, payload, duration);
  const metadata = structuredMetadata.create("Assignment", { duration, priceLabel });

  if (!assignees.map((i) => i.login).includes(payload.sender.login)) {
    logger.info("Adding the assignee", { assignee: payload.sender.login });
    await addAssignees(context, issue.number, [payload.sender.login]);
  }

  const isTaskStale = checkTaskStale(taskStaleTimeoutDuration, issue);

  // double check whether the assign message has been already posted or not
  logger.info("Creating an issue comment", { comment });

  const { multiplierAmount, multiplierReason, totalPriceOfTask } = await getMultiplierInfoToDisplay(context, payload.sender.id, payload.repository.id, issue);
  return [
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
  ].join("\n");
}
