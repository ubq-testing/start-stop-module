import { Database } from "../types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { Super } from "./supabase";
import { Context } from "../../../types/context";

export class Wallet extends Super {
  constructor(supabase: SupabaseClient<Database>, context: Context) {
    super(supabase, context);
  }

  async getWalletByUserId(userId: number) {
    const { data, error } = await this.supabase.from("users").select("wallets(*)").eq("id", userId).single();
    if ((error && !data) || !data.wallets?.address) {
      /** @TODO /wallet command? */
      this.context.logger.error("Please set your wallet address with the /wallet command", { userId }, true);
      throw error;
    }

    this.context.logger.info("Successfully fetched wallet", { userId, address: data.wallets?.address });
    return data.wallets?.address;
  }

  async upsertWallet(userId: number, address: string) {
    const { error: walletError, data } = await this.supabase.from("wallets").upsert([{ address }]).select().single();

    if (walletError) {
      this.context.logger.error("Failed to upsert wallet", { userId, address, walletError });
      throw walletError;
    }

    const { error: userError } = await this.supabase.from("users").upsert([{ id: userId, wallet_id: data.id }]);

    if (userError) {
      this.context.logger.error("Failed to upsert user with new wallet", { userId, address, userError });
      throw userError;
    }

    this.context.logger.info("Successfully upsert wallet", { userId, address });
  }
}
