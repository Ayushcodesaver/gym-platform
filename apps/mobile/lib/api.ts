import { useAuth, useClerk } from "@clerk/clerk-expo";
import { createApiClient, type ApiClient } from "@gym/api-client";

/**
 * Hook-scoped API client (React hooks can't be called inside plain functions).
 * Every request carries the Clerk session token; the backend derives identity —
 * no client-provided user/gym/role fields anywhere.
 */
export function useApi(): ApiClient {
  const { getToken } = useAuth();
  return createApiClient(
    process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
    getToken,
  );
}

export { useClerk };
