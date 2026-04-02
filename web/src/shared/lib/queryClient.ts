import { QueryClient } from "@tanstack/react-query";

/**
 * [ARCHITECTURE] Singleton QueryClient
 * Exported so that non-component services (Zustand, AudioServices) can
 * read and manipulate the Server State cache directly without requiring hooks.
 */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5, // 5 minutes
			retry: 1,
		},
	},
});
