import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export const authClient = createAuthClient({
  baseURL: backendUrl,
  plugins: [emailOTPClient()],
  fetchOptions: {
    credentials: "include",
  },
});

// Export the useSession hook for React components
export const { useSession, signOut } = authClient;
