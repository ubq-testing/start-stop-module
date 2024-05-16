import { Label } from "../../types";
import { Context } from "../../types/context";
import { taskPaymentMetaData } from "./analytics";
import { getUserMultiplier } from "./get-user-multiplier";

export async function getMultiplierInfoToDisplay(context: Context, senderId: number, repoId: number, labels: Label[]) {
  const userMultiplier = await getUserMultiplier(context, senderId, repoId);
  const value = userMultiplier?.value || null;
  const reason = userMultiplier?.reason || null;

  let totalPriceOfTask: string | null = null;

  if (value && value != 1) {
    const task = taskPaymentMetaData(context, labels);

    if (task.priceLabel) {
      const price = parsePrice(task.priceLabel);
      price.number *= value;
      totalPriceOfTask = `${price.number} ${price.currency}`;
    } else {
      totalPriceOfTask = "Permit generation disabled because price label is not set.";
    }
  }

  return {
    multiplierAmount: value,
    multiplierReason: reason,
    totalPriceOfTask: totalPriceOfTask,
  };
}

function parsePrice(priceString: string) {
  const match = priceString.match(/Price: ([\d.]+) (\w+)/);
  if (!match) {
    throw new Error("Invalid price string");
  }

  const number = parseFloat(match[1]);
  const currency = match[3];

  return { number, currency };
}
