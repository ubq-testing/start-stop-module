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
});

export type StartStopSettings = StaticDecode<typeof startStopSchema>;
