import { Database } from "../types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { Super } from "./supabase";
import { Context } from "../../../types/context";
import { addCommentToIssue } from "../../../utils/issue";

export class Wallet extends Super {
  constructor(supabase: SupabaseClient<Database>, context: Context) {
    super(supabase, context);
  }

  async getWalletByUserId(userId: number) {
    const { data, error } = await this.supabase.from("users").select("wallets(*)").eq("id", userId).single();
    if (error && error.code === "PGRST116") {
      /** @TODO /wallet command? */
      await addCommentToIssue(this.context, "Please set your wallet address with the `/wallet` command.");
      throw new Error("Wallet not set");
    } else if (error) {
      console.error("Failed to fetch wallet", { userId, error });
      throw error;
    }

    console.info("Successfully fetched wallet", { userId, address: data.wallets?.address });
    return data.wallets?.address;
  }

  async upsertWallet(userId: number, address: string) {
    const { error: walletError, data } = await this.supabase.from("wallets").upsert([{ address }]).select().single();

    if (walletError) {
      console.error("Failed to upsert wallet", { userId, address, walletError });
      throw walletError;
    }

    const { error: userError } = await this.supabase.from("users").upsert([{ id: userId, wallet_id: data.id }]);

    if (userError) {
      console.error("Failed to upsert user with new wallet", { userId, address, userError });
      throw userError;
    }

    console.info("Successfully upsert wallet", { userId, address });
  }
}
