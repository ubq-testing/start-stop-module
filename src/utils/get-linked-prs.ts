import { Context } from "../types/context";

interface GetLinkedParams {
  owner: string;
  repository: string;
  issue?: number;
  pull?: number;
}

interface GetLinkedResults {
  organization: string;
  repository: string;
  number: number;
  href: string;
}

export async function getLinkedPullRequests(context: Context, { owner, repository, issue }: GetLinkedParams): Promise<GetLinkedResults[]> {
  if (!issue) {
    throw new Error("Issue is not defined");
  }
  const { data: timeline } = await context.octokit.issues.listEventsForTimeline({
    owner,
    repo: repository,
    issue_number: issue,
  });

  const LINKED_PRS = timeline.filter(
    (event) =>
      event.event === "cross-referenced" && "source" in event && !!event.source.issue && "repository" in event.source.issue && !!event.source.issue.repository
  );

  return LINKED_PRS.map((pr) => {
    if (pr && "source" in pr && "issue" in pr.source && !!pr.source.issue && "repository" in pr.source.issue && !!pr.source.issue.repository) {
      return {
        organization: pr.source.issue.repository?.full_name.split("/")[0],
        repository: pr.source.issue.repository?.full_name.split("/")[1],
        number: pr.source.issue.number,
        href: pr.source.issue.html_url,
      };
    } else {
      return null;
    }
  }).filter((pr) => pr !== null) as GetLinkedResults[];
}
