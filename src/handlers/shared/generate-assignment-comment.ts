import { Context } from "../../types/context";

const options: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  timeZone: "UTC",
  timeZoneName: "short",
};

export async function generateAssignmentComment(context: Context, issueCreatedAt: string, senderId: number, duration: number | null = null) {
  const startTime = new Date().getTime();
  let endTime: null | Date = null;
  let deadline: null | string = null;
  if (duration) {
    endTime = new Date(startTime + duration * 1000);
    deadline = endTime.toLocaleString("en-US", options);
  }

  if (!issueCreatedAt) {
    throw context.logger.fatal("Issue creation time is not defined");
  }

  return {
    daysElapsedSinceTaskCreation: Math.floor((startTime - new Date(issueCreatedAt).getTime()) / 1000 / 60 / 60 / 24),
    deadline,
    registeredWallet: (await context.adapters.supabase.wallet.getWalletByUserId(senderId)) || "Please set your wallet address to use `/wallet 0x0000...0000`",
    tips: `<h6>Tips:</h6>
    <ul>
    <li>Use <code>/wallet 0x0000...0000</code> if you want to update your registered payment wallet address.</li>
    <li>Be sure to open a draft pull request as soon as possible to communicate updates on your progress.</li>
    <li>Be sure to provide timely updates to us when requested, or you will be automatically unassigned from the task.</li>
    <ul>`,
  };
}
