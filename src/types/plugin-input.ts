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
  directive: T.Union([T.Literal("start"), T.Literal("stop")]),
});

export type StartStopSettings = StaticDecode<typeof startStopSchema>;
