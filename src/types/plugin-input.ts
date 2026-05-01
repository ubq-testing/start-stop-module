import { EmitterWebhookEvent as WebhookEvent, EmitterWebhookEventName as WebhookEventName } from "@octokit/webhooks";
import { SupportedEvents } from "./context";
import { StaticDecode, Type as T } from "@sinclair/typebox";

export interface PluginInputs<T extends WebhookEventName = SupportedEvents> {
  stateId: string;
  eventName: T;
  eventPayload: WebhookEvent<T>["payload"];
  settings: StartStopSettings;
  authToken: string;
  ref: string;
}

export const startRequirementSchema = T.Object({
  enabled: T.Boolean({ default: false }),
  gatedLabels: T.Array(T.String(), { default: [] }),
  minimumAccountAgeDays: T.Number({ default: 0 }),
  minimumMergedPrs: T.Number({ default: 0 }),
  minimumRelevantRepositories: T.Number({ default: 0 }),
  relevantRepositoryTopics: T.Array(T.String(), { default: [] }),
  bypassUsers: T.Array(T.String(), { default: [] }),
});

export const startStopSchema = T.Object({
  disabledCommands: T.Array(T.String()),
  labels: T.Object({
    time: T.Array(T.String()),
    priority: T.Array(T.String()),
  }),
  timers: T.Object({
    reviewDelayTolerance: T.Number(),
    taskStaleTimeoutDuration: T.Number(),
  }),
  miscellaneous: T.Object({
    maxConcurrentTasks: T.Number(),
  }),
  startRequirements: T.Optional(startRequirementSchema),
});

export type StartStopSettings = StaticDecode<typeof startStopSchema>;
