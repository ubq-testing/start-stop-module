import { SupabaseClient } from "@supabase/supabase-js";
import { GitHubComment } from "../../../types/payload";
import { Database } from "../types/database";
import { UserRow } from "./user";
import { Super } from "./supabase";
import { Context } from "../../../types/context";
type AccessRow = Database["public"]["Tables"]["access"]["Row"];
type AccessInsert = Database["public"]["Tables"]["access"]["Insert"];
type UserWithAccess = (UserRow & { access: AccessRow | null })[];

type AccessData = {
  user_id: number;
  multiplier: number;
  multiplier_reason: string;
  node_id: string;
  node_type: string;
  node_url: string;
};
type GitHubNodeType = Database["public"]["Enums"]["github_node_type"];
export type GitHubNode = {
  // will leave support for id and type until more research is completed to confirm that it can be removed
  node_id?: string;
  node_type?: GitHubNodeType;
  // use HTML URL so that administrators can easily audit the location of the node
  node_url: string;
};

export class Access extends Super {
  constructor(supabase: SupabaseClient<Database>, context: Context) {
    super(supabase, context);
  }

  private async _getUserWithAccess(id: number): Promise<UserWithAccess> {
    const { data, error } = await this.supabase.from("access").select("*, users(*)").filter("id", "eq", id);

    if (error) {
      this.runtime.logger.fatal(error.message, error);
      throw new Error(error.message);
    }
    return data;
  }

  public async getAccess(id: number): Promise<AccessRow | null> {
    const userWithAccess = await this._getUserWithAccess(id);
    if (userWithAccess[0]?.access === undefined) {
      this.runtime.logger.debug("Access is undefined");
      return null;
    }
    if (userWithAccess[0]?.access === null) throw new Error("Access is null");
    return userWithAccess[0].access;
  }

  public async setAccess(labels: string[], node: GitHubNode, userId?: number): Promise<null> {
    const { data, error } = await this.supabase.from("access").upsert({
      labels: labels,
      ...node,
      user_id: userId,
    } as AccessInsert);
    if (error) throw new Error(error.message);
    return data;
  }

  async upsertMultiplier(userId: number, multiplier: number, reason: string, comment: GitHubComment) {
    try {
      const accessData: AccessData = {
        user_id: userId,
        multiplier: multiplier,
        multiplier_reason: reason,
        node_id: comment.node_id,
        node_type: "IssueComment",
        node_url: comment.html_url,
      };

      const { data, error } = await this.supabase.from("access").upsert(accessData, { onConflict: "location_id" });

      if (error) throw new Error(error.message);
      if (!data) throw new Error("Multiplier not upserted");
    } catch (error) {
      console.error("An error occurred while upserting multiplier:", error);
    }
  }
}
