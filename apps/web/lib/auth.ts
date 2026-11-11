import { auth, currentUser } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase/server";
import { ERROR_CODES, ROLE_PERMISSIONS, type Permission, type Role } from "@gym/constants";
import type { UserProfile } from "@gym/types";

export interface AuthContext {
  clerkUserId: string;
  role: Role;
  /** Tenant scope resolved from the Clerk session — NEVER from client input. */
  gymId: string;
  profile: UserProfile;
  can: (permission: Permission) => boolean;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const unauthorized = () =>
  new HttpError(401, ERROR_CODES.AUTHENTICATION_ERROR, "Sign in required");
const forbidden = (what = "permission") =>
  new HttpError(403, ERROR_CODES.AUTHORIZATION_ERROR, `You do not have ${what}`);

/**
 * Resolves the authenticated Clerk user → application profile → gym tenant + role.
 * Throws 401/403 if the caller has no valid session, no profile, no gym, or lacks
 * the required permission. This is the single authorization gate for every API route.
 */
export async function requireAuth(permission?: Permission): Promise<AuthContext> {
  const { userId, orgId } = auth();
  if (!userId) throw unauthorized();

  const db = getServiceClient();
  const { data: profile, error } = await db
    .from("user_profiles")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();
  if (error || !profile) throw unauthorized();
  if ((profile as UserProfile).role === "member") {
    throw forbidden("staff access");
  }
  if (!(profile as UserProfile).gym_id) throw forbidden("a gym organization");
  if (orgId) {
    // Session must be within the gym's organization (multi-org users, PRD §4)
    const { data: gym } = await db
      .from("gyms")
      .select("clerk_organization_id")
      .eq("id", (profile as UserProfile).gym_id as string)
      .single();
    if (gym && gym.clerk_organization_id !== orgId) throw forbidden("this organization");
  }

  const role = (profile as UserProfile).role as Role;
  const can = (p: Permission) => ROLE_PERMISSIONS[role as Exclude<Role, "member">]?.includes(p) ?? false;
  if (permission && !can(permission)) throw forbidden(`the "${permission}" permission`);

  return {
    clerkUserId: userId,
    role,
    gymId: (profile as UserProfile).gym_id as string,
    profile: profile as UserProfile,
    can,
  };
}

export async function getMemberProfile(clerkUserId: string): Promise<UserProfile | null> {
  const db = getServiceClient();
  const { data } = await db
    .from("user_profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  return (data as UserProfile) ?? null;
}

export async function requireClerkUser(): Promise<string> {
  const user = await currentUser();
  if (!user) throw unauthorized();
  return user.id;
}

export { ERROR_CODES };
