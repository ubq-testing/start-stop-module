import { Label } from "../../types";
import { Context } from "../../types/context";
import { calculateLabelValue } from "../../utils/shared";

//  Checks the issue whether it's an open task for public self assignment
export function taskPaymentMetaData(
  context: Context,
  labels: Label[]
): {
  eligibleForPayment: boolean;
  timeLabel: string | null;
  priorityLabel: string | null;
  priceLabel: string | null;
} {
  const { labels: configLabels } = context.config;

  const timeLabels = configLabels.time.filter((configLabel) => labels.map((i) => i.name).includes(configLabel));
  const priorityLabels = configLabels.priority.filter((configLabel) => labels.map((i) => i.name).includes(configLabel));

  const isTask = timeLabels.length > 0 && priorityLabels.length > 0;

  const minTimeLabel = timeLabels.length > 0 ? timeLabels.reduce((a, b) => (calculateLabelValue(a) < calculateLabelValue(b) ? a : b)) : null;

  const minPriorityLabel = priorityLabels.length > 0 ? priorityLabels.reduce((a, b) => (calculateLabelValue(a) < calculateLabelValue(b) ? a : b)) : null;

  const priceLabel = labels.find((label) => label.name.includes("Price"))?.name || null;

  return {
    eligibleForPayment: isTask,
    timeLabel: minTimeLabel,
    priorityLabel: minPriorityLabel,
    priceLabel,
  };
}
