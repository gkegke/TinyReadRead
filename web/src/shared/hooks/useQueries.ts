import { useQuery } from "@tanstack/react-query";
import ky from "ky";
import { useMemo } from "react";
import { EMPTY_CHUNKS } from "../store/useUIStore";
import type { Chunk, Project, SystemModel } from "../types/schema";

export const useProjectChunks = (projectId: string | null) => {
	const query = useQuery({
		queryKey: ["chunks", projectId],
		queryFn: async () => {
			return await ky.get(`/api/projects/${projectId}/chunks`).json<Chunk[]>();
		},
		enabled: !!projectId,
		// [UX: REDUCED POLLING NOISE]
		// 3 seconds is the "sweet spot" for local-first apps to feel responsive
		// without saturating the browser's request queue.
		refetchInterval: (query) => {
			const chunks = query.state.data || [];
			const hasWork = chunks.some(
				(c) => c.status === "pending" || c.status === "processing",
			);
			return hasWork ? 3000 : false;
		},
	});

	return {
		data: query.data ?? EMPTY_CHUNKS,
		isLoading: query.isLoading,
	};
};

export const useProjects = () => {
	return useQuery({
		queryKey: ["projects"],
		queryFn: () => ky.get("/api/projects").json<Project[]>(),
	});
};

export const useProject = (projectId: string | null) => {
	return useQuery({
		queryKey: ["project", projectId],
		queryFn: () => ky.get(`/api/projects/${projectId}`).json<Project>(),
		enabled: !!projectId,
		retry: false,
		// [CRITICAL: STABILITY] Prevent UI "flicker" on StudioPage.
		// Keeping the project metadata fresh for 30s reduces redundant validation calls.
		staleTime: 30000,
	});
};

export const useDetailedJobStatus = (projectId: string | null) => {
	const { data: chunks = [] } = useProjectChunks(projectId);

	return useMemo(() => {
		const pending = chunks.filter((c) => c.status === "pending").length;
		const processing = chunks.filter((c) => c.status === "processing");

		return {
			activeCount: processing.length,
			pendingCount: pending,
			currentJobText: processing[0]?.text_content?.slice(0, 30) || "",
		};
	}, [chunks]);
};

export const useSystemModels = () => {
	return useQuery({
		queryKey: ["system", "models"],
		queryFn: () => ky.get("/api/system/models").json<SystemModel[]>(),
		// Poll frequently if any model is currently downloading
		refetchInterval: (query) => {
			const models = query.state.data || [];
			return models.some((m) => m.status === "downloading") ? 2000 : 10000;
		},
	});
};
