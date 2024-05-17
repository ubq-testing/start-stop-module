import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../types/context";
import { User } from "./supabase/helpers/user";
import { Super } from "./supabase/helpers/supabase";
import { Database } from "./supabase/types/database";
import { Logs } from "./supabase/helpers/logs";

export function createAdapters(supabaseClient: SupabaseClient<Database>, context: Context) {
  return {
    supabase: {
      user: new User(supabaseClient, context),
      super: new Super(supabaseClient, context),
      logger: new Logs(supabaseClient, 3, "ERROR", context),
    },
  };
}
