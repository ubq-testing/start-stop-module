import { EmitterWebhookEvent as WebhookEvent, EmitterWebhookEventName as WebhookEventName } from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";
import { StartStopSettings } from "./plugin-input";
import { createAdapters } from "../adapters";
import { Env } from "./env";
import { Logs } from "../adapters/supabase/helpers/logs";

export type SupportedEvents = "issue_comment.created" | "workflow_dispatch";

export interface Context<T extends WebhookEventName = SupportedEvents> {
  eventName: T;
  payload: WebhookEvent<T>["payload"];
  octokit: InstanceType<typeof Octokit>;
  adapters: ReturnType<typeof createAdapters>;
  config: StartStopSettings;
  env: Env;
  logger: Logs;
}
