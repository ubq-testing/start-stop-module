import { SupabaseClient } from "@supabase/supabase-js";
import { GitHubRepository } from "../../../types/payload";

import { Database } from "../types/database";
import { Super } from "./supabase";
import { Context } from "../../../types/context";

type LabelRow = Database["public"]["Tables"]["labels"]["Row"];

export class Label extends Super {
  constructor(supabase: SupabaseClient<Database>, context: Context) {
    super(supabase, context);
  }

  async saveLabelChange({
    previousLabel,
    currentLabel,
    authorized,
    repository,
  }: {
    previousLabel: string;
    currentLabel: string;
    authorized: boolean;
    repository: GitHubRepository;
  }): Promise<null> {
    const { data, error } = await this.supabase.from("labels").insert({
      label_from: previousLabel,
      label_to: currentLabel,
      authorized: authorized,
      node_id: repository.node_id,
      node_type: "Repository",
      node_url: repository.html_url,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  async getLabelChanges(repositoryNodeId: string) {
    const locationId = await this._getRepositoryLocationId(repositoryNodeId);
    if (!locationId) {
      return null;
    }
    const unauthorizedLabelChanges = await this._getUnauthorizedLabelChanges(locationId);
    return unauthorizedLabelChanges;
  }

  async approveLabelChange(id: number): Promise<null> {
    const { data, error } = await this.supabase.from("labels").update({ authorized: true }).eq("id", id);
    if (error) throw new Error(error.message);
    return data;
  }

  private async _getUnauthorizedLabelChanges(locationId: number): Promise<LabelRow[]> {
    // Get label changes that are not authorized in the repository
    const { data, error } = await this.supabase.from("labels").select("*").eq("location_id", locationId).eq("authorized", false);

    if (error) throw new Error(error.message);

    return data;
  }

  private async _getRepositoryLocationId(nodeId: string) {
    const runtime = Runtime.getState();
    // Get the location_id for the repository from the locations table
    const { data: locationData, error: locationError } = await this.supabase.from("locations").select("id").eq("node_id", nodeId).maybeSingle();

    if (locationError) throw new Error(locationError.message);
    if (!locationData) {
      runtime.logger.error("Repository location ID not found in database.");
      return null;
    }

    const locationId = locationData.id;
    return locationId;
  }
}
