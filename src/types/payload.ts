// https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads

import { Static, Type } from "@sinclair/typebox";
import { labelSchema } from "./label";
import { LogReturn } from "../adapters/supabase/helpers/logs";

export enum UserType {
  User = "User",
  Bot = "Bot",
  Organization = "Organization",
}

export enum IssueType {
  OPEN = "open",
  CLOSED = "closed",
  // ALL = "all",
}

export enum StateReason {
  COMPLETED = "completed",
  NOT_PLANNED = "not_planned", // these are all used at runtime, not necessarily in the code.
  REOPENED = "reopened",
}

const userSchema = Type.Object({
  login: Type.String(),
  id: Type.Number(),
  node_id: Type.String(),
  avatar_url: Type.String(),
  gravatar_id: Type.Union([Type.Null(), Type.String()]),
  url: Type.String(),
  html_url: Type.String(),
  followers_url: Type.String(),
  following_url: Type.String(),
  gists_url: Type.String(),
  starred_url: Type.String(),
  subscriptions_url: Type.String(),
  organizations_url: Type.String(),
  repos_url: Type.String(),
  events_url: Type.String(),
  received_events_url: Type.String(),
  type: Type.Enum(UserType),
  site_admin: Type.Boolean(),
});

export type GitHubUser = Static<typeof userSchema>;
export enum AuthorAssociation {
  OWNER = "OWNER",
  COLLABORATOR = "COLLABORATOR",
  MEMBER = "MEMBER",
  CONTRIBUTOR = "CONTRIBUTOR",
  FIRST_TIMER = "FIRST_TIMER",
  FIRST_TIME_CONTRIBUTOR = "FIRST_TIME_CONTRIBUTOR",
  NONE = "NONE",
}

const issueSchema = Type.Object({
  assignee: Type.Union([Type.Null(), userSchema]),
  assignees: Type.Array(Type.Union([Type.Null(), userSchema])),
  author_association: Type.Enum(AuthorAssociation),
  body: Type.String(),
  closed_at: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  comments_url: Type.String(),
  comments: Type.Number(),
  created_at: Type.String({ format: "date-time" }),
  events_url: Type.String(),
  html_url: Type.String(),
  id: Type.Number(),
  labels_url: Type.String(),
  labels: Type.Array(labelSchema),
  locked: Type.Boolean(),
  node_id: Type.String(),
  number: Type.Number(),
  repository_url: Type.String(),
  state_reason: Type.Union([Type.Enum(StateReason), Type.Null()]),
  state: Type.Enum(IssueType),
  title: Type.String(),
  updated_at: Type.String({ format: "date-time" }),
  url: Type.String(),
  user: userSchema,
});

export type GitHubIssue = Static<typeof issueSchema>;

const repositorySchema = Type.Object({
  allow_forking: Type.Boolean(),
  archive_url: Type.String(),
  archived: Type.Boolean(),
  assignees_url: Type.String(),
  blobs_url: Type.String(),
  branches_url: Type.String(),
  clone_url: Type.String(),
  collaborators_url: Type.String(),
  comments_url: Type.String(),
  commits_url: Type.String(),
  compare_url: Type.String(),
  contents_url: Type.String(),
  contributors_url: Type.String(),
  created_at: Type.String({ format: "date-time" }),
  default_branch: Type.String(),
  deployments_url: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  disabled: Type.Boolean(),
  downloads_url: Type.String(),
  events_url: Type.String(),
  fork: Type.Boolean(),
  forks_count: Type.Number(),
  forks_url: Type.String(),
  forks: Type.Number(),
  full_name: Type.String(),
  git_commits_url: Type.String(),
  git_refs_url: Type.String(),
  git_tags_url: Type.String(),
  git_url: Type.String(),
  has_downloads: Type.Boolean(),
  has_issues: Type.Boolean(),
  has_pages: Type.Boolean(),
  has_projects: Type.Boolean(),
  has_wiki: Type.Boolean(),
  hooks_url: Type.String(),
  html_url: Type.String(),
  id: Type.Number(),
  is_template: Type.Boolean(),
  issue_comment_url: Type.String(),
  issue_events_url: Type.String(),
  issues_url: Type.String(),
  keys_url: Type.String(),
  labels_url: Type.String(),
  language: Type.Any(),
  languages_url: Type.String(),
  license: Type.Any(),
  merges_url: Type.String(),
  milestones_url: Type.String(),
  name: Type.String(),
  node_id: Type.String(),
  notifications_url: Type.String(),
  open_issues_count: Type.Number(),
  open_issues: Type.Number(),
  owner: userSchema,
  private: Type.Boolean(),
  pulls_url: Type.String(),
  pushed_at: Type.String({ format: "date-time" }),
  releases_url: Type.String(),
  size: Type.Number(),
  ssh_url: Type.String(),
  stargazers_count: Type.Number(),
  stargazers_url: Type.String(),
  statuses_url: Type.String(),
  subscribers_url: Type.String(),
  subscription_url: Type.String(),
  svn_url: Type.String(),
  tags_url: Type.String(),
  teams_url: Type.String(),
  topics: Type.Array(Type.Any()),
  trees_url: Type.String(),
  updated_at: Type.String({ format: "date-time" }),
  url: Type.String(),
  visibility: Type.String(),
  watchers_count: Type.Number(),
  watchers: Type.Number(),
  web_commit_signoff_required: Type.Boolean(),
});

export type GitHubRepository = Static<typeof repositorySchema>;

const organizationSchema = Type.Object({
  login: Type.String(),
  id: Type.Number(),
  node_id: Type.String(),
  url: Type.String(),
  repos_url: Type.String(),
  events_url: Type.String(),
  hooks_url: Type.String(),
  issues_url: Type.String(),
  members_url: Type.String(),
  public_members_url: Type.String(),
  avatar_url: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
});

const installationSchema = Type.Object({
  id: Type.Number(),
  node_id: Type.String(),
});

const commentSchema = Type.Object({
  author_association: Type.String(),
  body_html: Type.Optional(Type.String()),
  body_text: Type.Optional(Type.String()),
  body: Type.String(),
  created_at: Type.String({ format: "date-time" }),
  html_url: Type.String(),
  id: Type.Number(),
  issue_url: Type.String(),
  node_id: Type.String(),
  updated_at: Type.String({ format: "date-time" }),
  url: Type.String(),
  user: userSchema,
  reactions: Type.Object({
    url: Type.String(),
    total_count: Type.Number(),
    "+1": Type.Number(),
    "-1": Type.Number(),
    laugh: Type.Number(),
    hooray: Type.Number(),
    confused: Type.Number(),
    heart: Type.Number(),
    rocket: Type.Number(),
    eyes: Type.Number(),
  }),
});

const changesSchema = Type.Object({
  body: Type.Optional(
    Type.Object({
      from: Type.String(),
    })
  ),
  name: Type.Optional(
    Type.Object({
      from: Type.String(),
    })
  ),
});

export const payloadSchema = Type.Object({
  action: Type.String(),
  issue: Type.Optional(issueSchema),
  label: Type.Optional(labelSchema),
  comment: Type.Optional(commentSchema),
  sender: userSchema,
  repository: repositorySchema,
  organization: Type.Optional(organizationSchema),
  installation: Type.Optional(installationSchema),
  repositories_added: Type.Optional(Type.Array(repositorySchema)),
  changes: Type.Optional(changesSchema),
});

export type GitHubPayload = Static<typeof payloadSchema>;

export type HandlerReturnValuesNoVoid = null | string | LogReturn;
