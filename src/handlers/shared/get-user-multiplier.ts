import { Context } from "../../types/context";

export async function getUserMultiplier(context: Context, userId: number, repoId: number) {
  const user = context.adapters.supabase.user;
  return await user.getMultiplier(userId, repoId);
}
