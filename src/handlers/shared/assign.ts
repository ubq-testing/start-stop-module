import { GitHubIssue, GitHubRepository } from "../../types";
import { Context } from "../../types/context";
import { Label } from "../../types/label";
import { getLinkedPullRequests } from "../../utils/get-linked-prs";
import { closePullRequest } from "../../utils/issue";
import { calculateDurations, calculateLabelValue } from "../../utils/shared";

export async function assignCommandHandler(context: Context, issue: GitHubIssue, sender: { id: number; login: string }, repo: GitHubRepository) {
  const { config, logger } = context;

  if (!issue) {
    return logger.fatal("Issue is not defined");
  }

  const assignees = issue.assignees;

  // If no valid assignees exist, log a debug message and return
  if (assignees.length === 0) {
    return logger.error("No assignees");
  }

  // Flatten assignees into a string
  const flattenedAssignees = assignees.reduce((acc, assignee) => `${acc} @${assignee?.login}`, "");

  // Extract labels from payload
  const labels = issue.labels;

  // If no labels exist, log a debug message and return
  if (!labels) {
    return logger.error(`No labels to calculate timeline`);
  }

  // Filter out labels that match the time labels defined in the config
  const timeLabelsAssigned: Label[] = labels.filter((assignedLabel) =>
    typeof assignedLabel === "string" || typeof assignedLabel === "object" ? config.labels.time.some((label) => label === assignedLabel.name) : false
  );

  if (timeLabelsAssigned.length == 0) {
    return logger.debug("No labels to calculate timeline");
  }

  // Sort labels by weight and select the one with the smallest weight
  const sortedLabels = timeLabelsAssigned
    .sort((a, b) => {
      const fullLabelA = labels.find((label) => label.name === a.name)?.name;
      const fullLabelB = labels.find((label) => label.name === b.name)?.name;

      if (!fullLabelA || !fullLabelB) {
        return 0; // return a default value
      }

      return calculateLabelValue(fullLabelA) - calculateLabelValue(fullLabelB);
    })
    .map((label) => labels.find((fullLabel) => fullLabel.name === label.name));

  // Filter out undefined values
  const validSortedLabels = sortedLabels.filter((label) => label !== undefined);

  // Calculate the duration for the target label
  const labelDuration = calculateDurations(validSortedLabels as Label[]);
  const shortestDurationLabel = labelDuration[0];

  // Calculate the end date based on the current date and the label duration
  const currentDate = new Date();
  const endDate = new Date(currentDate.getTime() + shortestDurationLabel * 1000);

  // Format the commit message
  const commitMessage = `${flattenedAssignees} the deadline is at ${endDate.toISOString()}`;
  logger.debug("Creating an issue comment", { commitMessage });

  // Add the commit message as a comment to the issue
  // await addCommentToIssue(commitMessage, payload.issue?.number);
  return logger.info(commitMessage);
}

export async function closePullRequestForAnIssue(context: Context, issueNumber: number, repository: GitHubRepository) {
  const logger = context.logger;
  if (!issueNumber) {
    throw logger.fatal("Issue is not defined");
  }

  const linkedPullRequests = await getLinkedPullRequests(context, {
    owner: repository.owner.login,
    repository: repository.name,
    issue: issueNumber,
  });

  if (!linkedPullRequests.length) {
    return logger.info(`No linked pull requests to close`);
  }

  logger.info(`Opened prs`, linkedPullRequests);
  let comment = `These linked pull requests are closed: `;
  for (let i = 0; i < linkedPullRequests.length; i++) {
    await closePullRequest(context, linkedPullRequests[i].number);
    comment += ` <a href="${linkedPullRequests[i].href}">#${linkedPullRequests[i].number}</a> `;
  }
  return logger.info(comment);
  // await addCommentToIssue(comment, payload.issue.number);
}
