import { Database } from "../types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { Super } from "./supabase";
import { Context } from "../../../types/context";

export type UserRow = Database["public"]["Tables"]["users"]["Row"];

export class User extends Super {
  locationResponse: LocationResponse | undefined;

  user_id: string | undefined;
  comment_id: string | undefined;
  issue_id: string | undefined;
  repository_id: string | undefined;
  node_id: string | undefined;
  node_type: string | undefined;

  constructor(supabase: SupabaseClient<Database>, context: Context) {
    super(supabase, context);
  }

  async getUserById(userId: number) {
    const { data, error } = await this.supabase.from("users").select("*").eq("id", userId).single();
    if (error) {
      console.error(FAILED_TO_GET_USER, { userId, error });
      throw error;
    }

    console.log(SUCCESSFULLY_FETCHED_USER, { userId, ...data });
    return data;
  }

  async getUserIdByWallet(wallet: string) {
    const { data, error } = await this.supabase.from("wallets").select("id").eq("address", wallet).single();
    if (error) {
      console.error(FAILED_TO_GET_USER, { wallet, error });
      throw error;
    }

    console.log(SUCCESSFULLY_FETCHED_USER, { wallet, userId: data?.id });
    return data?.id.toString();
  }

  async upsertUser(userId: number, username: string) {
    const { error } = await this.supabase.from("users").upsert({ id: userId, username }).select();
    if (error) {
      console.error("Failed to upsert user", { userId, username, error });
      throw error;
    }

    console.log("Successfully upserted user", { userId, username });
  }

  async deleteUser(userId: number) {
    const { error } = await this.supabase.from("users").delete().eq("user_id", userId);
    if (error) {
      console.error("Failed to delete user", { userId, error });
      throw error;
    }

    console.log("Successfully deleted user", { userId });
  }

  public async getMultiplier(userId: number, repositoryId: number) {
    const locationData = await this.getLocationsFromRepo(repositoryId);
    if (locationData && locationData.length > 0) {
      const accessData = await this._getAccessData(locationData, userId);
      if (accessData) {
        return {
          value: accessData.multiplier || null,
          reason: accessData.multiplier_reason || null,
        };
      }
    }
    return null;
  }

  private async _getAccessData(locationData: { id: number }[], userId: number) {
    const locationIdsInCurrentRepository = locationData.map((location) => location.id);

    const { data: accessData, error: accessError } = await this.supabase
      .from("access")
      .select("multiplier, multiplier_reason")
      .in("location_id", locationIdsInCurrentRepository)
      .eq("user_id", userId)
      .order("id", { ascending: false }) // get the latest one
      .maybeSingle();
    if (accessError) throw this.context.logger.fatal("Error getting access data", accessError);
    return accessData;
  }

  public async getLocationsFromRepo(repositoryId: number) {
    const { data: locationData, error } = await this.supabase.from("locations").select("id").eq("repository_id", repositoryId);

    if (error) throw this.context.logger.fatal("Error getting location data", new Error(error.message));
    return locationData;
  }
}

const FAILED_TO_GET_USER = "Failed to get user";
const SUCCESSFULLY_FETCHED_USER = "Successfully fetched user";

interface LocationResponse {
  data: {
    node: {
      id: "IC_kwDOH92Z-c5oA5cs";
      author: {
        login: "molecula451";
        id: "MDQ6VXNlcjQxNTUyNjYz";
      };
      issue: {
        id: "I_kwDOH92Z-c5yRpyq";
        number: 846;
        repository: {
          id: "R_kgDOH92Z-Q";
          name: "ubiquibot";
          owner: {
            id: "MDEyOk9yZ2FuaXphdGlvbjc2NDEyNzE3";
            login: "ubiquity";
          };
        };
      };
    };
  };
}
