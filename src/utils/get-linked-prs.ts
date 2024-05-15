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

export async function getLinkedIssues({ owner, repository, pull }: GetLinkedParams) {
  const { data } = await axios.get(`https://github.com/${owner}/${repository}/pull/${pull}`);
  const dom = parse(data);
  const devForm = dom.querySelector("[data-target='create-branch.developmentForm']") as HTMLElement;
  const linkedIssues = devForm.querySelectorAll(".my-1");

  if (linkedIssues.length === 0) {
    return null;
  }

  const issueUrl = linkedIssues[0].querySelector("a")?.attrs?.href || null;
  return issueUrl;
}

export async function getLinkedPullRequests(context: Context, { owner, repository, issue }: GetLinkedParams): Promise<GetLinkedResults[]> {
  const logger = context.logger;
  const collection = [] as GetLinkedResults[];
  const { data } = await axios.get(`https://github.com/${owner}/${repository}/issues/${issue}`);
  const dom = parse(data);
  const devForm = dom.querySelector("[data-target='create-branch.developmentForm']") as HTMLElement;
  const linkedList = devForm.querySelectorAll(".my-1");
  if (linkedList.length === 0) {
    context.logger.info(`No linked pull requests found`);
    return [];
  }

  for (const linked of linkedList) {
    const relativeHref = linked.querySelector("a")?.attrs?.href;
    if (!relativeHref) continue;
    const parts = relativeHref.split("/");

    // check if array size is at least 4
    if (parts.length < 4) continue;

    // extract the organization name and repo name from the link:(e.g. "
    const organization = parts[parts.length - 4];
    const repository = parts[parts.length - 3];
    const number = Number(parts[parts.length - 1]);
    const href = `https://github.com${relativeHref}`;

    if (`${organization}/${repository}` !== `${owner}/${repository}`) {
      logger.info("Skipping linked pull request from another repository", href);
      continue;
    }

    collection.push({ organization, repository, number, href });
  }

  return collection;
}
