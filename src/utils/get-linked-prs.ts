import axios from "axios";
import { HTMLElement, parse } from "node-html-parser";
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
  const results = [];

  const { data: timeline } = await context.octokit.issues.listEventsForTimeline({
    owner,
    repo: repository,
    issue_number: issue,
  });

  const linkedPRS = timeline.filter((event) => event.event === "cross-referenced" && "pull_request" in event.source.issue);
  console.log("linkedPRSlinkedPRS: ", linkedPRS);

  return results;
}
