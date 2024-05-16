import { Context } from "../types/context";

export async function checkUserPermissionForRepoAndOrg(context: Context, username: string): Promise<boolean> {
  const hasPermissionForRepo = await checkUserPermissionForRepo(context, username);
  const hasPermissionForOrg = await checkUserPermissionForOrg(context, username);
  const userPermission = await isUserAdminOrBillingManager(context, username);

  return hasPermissionForOrg || hasPermissionForRepo || userPermission === "admin";
}

async function checkUserPermissionForRepo(context: Context, username: string): Promise<boolean> {
  const payload = JSON.parse(context.payload as unknown as string);
  try {
    const res = await context.octokit.rest.repos.checkCollaborator({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      username,
    });

    return res.status === 204;
  } catch (e: unknown) {
    context.logger.fatal("Checking if user permission for repo failed!", e);
    return false;
  }
}

async function checkUserPermissionForOrg(context: Context, username: string): Promise<boolean> {
  const payload = JSON.parse(context.payload as unknown as string);
  if (!payload.organization) return false;

  try {
    await context.octokit.rest.orgs.checkMembershipForUser({
      org: payload.organization.login,
      username,
    });
    // skipping status check due to type error of checkMembershipForUser function of octokit
    return true;
  } catch (e: unknown) {
    context.logger.fatal("Checking if user permission for org failed!", e);
    return false;
  }
}

export async function isUserAdminOrBillingManager(context: Context, username: string): Promise<"admin" | "billing_manager" | false> {
  const payload = JSON.parse(context.payload as unknown as string);
  const isAdmin = await checkIfIsAdmin();
  if (isAdmin) return "admin";

  const isBillingManager = await checkIfIsBillingManager();
  if (isBillingManager) return "billing_manager";

  return false;

  async function checkIfIsAdmin() {
    const response = await context.octokit.rest.repos.getCollaboratorPermissionLevel({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      username,
    });

    return response.data.permission === "admin";
  }

  async function checkIfIsBillingManager() {
    if (!payload.organization) throw context.logger.fatal(`No organization found in payload!`);
    const { data: membership } = await context.octokit.rest.orgs.getMembershipForUser({
      org: payload.organization.login,
      username: payload.repository.owner.login,
    });

    console.trace(membership);
    return membership.role === "billing_manager";
  }
}
