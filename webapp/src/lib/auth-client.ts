import { createAuthClient } from "better-auth/react";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export const authClient = createAuthClient({
  baseURL: backendUrl,
  fetchOptions: {
    credentials: "include",
  },
});

// Export the useSession hook for React components
export const { useSession, signOut } = authClient;
