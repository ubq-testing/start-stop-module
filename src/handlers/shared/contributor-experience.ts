import { Context } from "../../types";

type LabelLike = {
  name: string;
};

export type RepositoryEvidence = {
  name: string;
  topics?: string[];
  languages?: string[];
};

export type ContributorExperienceEvidence = {
  accountAgeDays: number;
  mergedPullRequests: number;
  relevantRepositories: RepositoryEvidence[];
};

export type StartRequirementSettings = {
  enabled: boolean;
  gatedLabels: string[];
  minimumAccountAgeDays: number;
  minimumMergedPrs: number;
  minimumRelevantRepositories: number;
  relevantRepositoryTopics: string[];
  bypassUsers: string[];
};

export type ContributorExperienceResult = {
  passed: boolean;
  missingRequirements: string[];
};

export type ExperienceGateDecision = ContributorExperienceResult & {
  required: boolean;
  bypassed: boolean;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function isExperienceGateRequired(labels: LabelLike[], config?: StartRequirementSettings) {
  if (!config?.enabled || config.gatedLabels.length === 0) {
    return false;
  }

  const gatedLabels = new Set(config.gatedLabels.map(normalize));
  return labels.some((label) => gatedLabels.has(normalize(label.name)));
}

function hasRelevantSignal(repository: RepositoryEvidence, config: StartRequirementSettings) {
  const requiredSignals = new Set(config.relevantRepositoryTopics.map(normalize));
  const repositorySignals = [...(repository.topics ?? []), ...(repository.languages ?? [])].map(normalize);

  return repositorySignals.some((signal) => requiredSignals.has(signal));
}

export function evaluateContributorExperience(evidence: ContributorExperienceEvidence, config: StartRequirementSettings): ContributorExperienceResult {
  const missingRequirements: string[] = [];
  const relevantRepositoryCount = evidence.relevantRepositories.filter((repository) => hasRelevantSignal(repository, config)).length;

  if (evidence.accountAgeDays < config.minimumAccountAgeDays) {
    missingRequirements.push(`GitHub account must be at least ${config.minimumAccountAgeDays} days old`);
  }

  if (evidence.mergedPullRequests < config.minimumMergedPrs) {
    missingRequirements.push(`Contributor must have at least ${config.minimumMergedPrs} merged pull requests`);
  }

  if (relevantRepositoryCount < config.minimumRelevantRepositories) {
    missingRequirements.push(`Contributor must have at least ${config.minimumRelevantRepositories} public repositories with relevant topics or languages`);
  }

  return {
    passed: missingRequirements.length === 0,
    missingRequirements,
  };
}

export function getExperienceGateDecision(
  labels: LabelLike[],
  config: StartRequirementSettings | undefined,
  username: string,
  evidence: ContributorExperienceEvidence
): ExperienceGateDecision {
  const required = isExperienceGateRequired(labels, config);
  if (!required || !config) {
    return { required, passed: true, bypassed: false, missingRequirements: [] };
  }

  if (config.bypassUsers.map(normalize).includes(normalize(username))) {
    return { required, passed: true, bypassed: true, missingRequirements: [] };
  }

  return { required, bypassed: false, ...evaluateContributorExperience(evidence, config) };
}

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export async function collectContributorExperienceEvidence(context: Context, username: string): Promise<ContributorExperienceEvidence> {
  const user = await context.octokit.rest.users.getByUsername({ username });
  const repositories = await context.octokit.paginate(context.octokit.rest.repos.listForUser, {
    username,
    per_page: 100,
    sort: "updated",
  });
  const mergedPullRequests = await context.octokit.rest.search.issuesAndPullRequests({
    q: `type:pr is:merged author:${username}`,
    per_page: 1,
  });

  return {
    accountAgeDays: daysSince(user.data.created_at),
    mergedPullRequests: mergedPullRequests.data.total_count,
    relevantRepositories: repositories.map((repository) => ({
      name: repository.name,
      topics: repository.topics ?? [],
      languages: repository.language ? [repository.language] : [],
    })),
  };
}

export function formatExperienceGateFailure(missingRequirements: string[]) {
  return [
    "```diff",
    "! This task requires prior experience before /start can assign it.",
    ...missingRequirements.map((requirement) => `- ${requirement}`),
    "```",
  ].join("\n");
}
