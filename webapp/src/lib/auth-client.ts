import { createAuthClient } from "better-auth/react";
import { resolveBackendUrl } from "@/lib/api";

export const authClient = createAuthClient({
  baseURL: resolveBackendUrl(),
  fetchOptions: {
    credentials: "include",
  },
});

// Export the useSession hook for React components
export const { useSession, signOut } = authClient;
