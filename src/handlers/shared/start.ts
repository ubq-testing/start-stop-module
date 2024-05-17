import { Context, IssueType, Label, GitHubUser } from "../../types";
import { isParentIssue, getAvailableOpenedPullRequests, getAssignedIssues, addAssignees, addCommentToIssue } from "../../utils/issue";
import { calculateDurations } from "../../utils/shared";
import { checkTaskStale } from "./check-task-stale";
import { generateAssignmentComment } from "./generate-assignment-comment";
import { getMultiplierInfoToDisplay } from "./get-multiplier-info";
import { getTimeLabelsAssigned } from "./get-time-labels-assigned";
import structuredMetadata from "./structured-metadata";
import { assignTableComment } from "./table";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function start(context: Context, issue: any, sender: { id: number; login: string }) {
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

  await addCommentToIssue(
    context,
    [
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
    ].join("\n") as string
  );
}
