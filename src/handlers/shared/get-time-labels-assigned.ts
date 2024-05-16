import { Context } from "../../types/context";
import { Label } from "../../types/label";

export function getTimeLabelsAssigned(context: Context, labels: Label[], config: Context["config"]) {
  const logger = context.logger;
  if (!labels?.length) {
    logger.error("Skipping '/start' since no labels are set to calculate the timeline", { labels });
    return;
  }
  const timeLabelsDefined = config.labels.time;
  const timeLabelsAssigned: Label[] = [];
  for (const _label of labels) {
    const _labelType = typeof _label;
    let _labelName;

    if (_labelType === "string") {
      _labelName = _label.toString();
    } else if (_labelType === "object") {
      _labelName = _label.name;
    } else {
      _labelName = "unknown";
    }

    const timeLabel = timeLabelsDefined.find((label: string) => label === _labelName);
    if (timeLabel) {
      timeLabelsAssigned.push(_label);
    }
  }
  return timeLabelsAssigned;
}
