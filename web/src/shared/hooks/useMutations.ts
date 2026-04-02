import { useMutation, useQueryClient } from "@tanstack/react-query";
import ky from "ky";
import { ProjectRepository } from "../../features/library/api/ProjectRepository";
import { ChunkRepository } from "../../features/studio/api/ChunkRepository";
import type { Chunk } from "../types/schema";

export const useCreateProjectMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (name: string) => ProjectRepository.createProject(name),
		onSuccess: (newProject) => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
			return newProject;
		},
	});
};

export const useImportTextMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ text, projectId }: { text: string; projectId: string }) =>
			ProjectRepository.importRawText(projectId, text),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["chunks", variables.projectId],
			});
		},
	});
};

export const useInsertBlockMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			text,
			projectId,
			afterOrderIndex,
			role,
		}: {
			text: string;
			projectId: string;
			afterOrderIndex: number;
			role: string;
		}) => ChunkRepository.insertBlock(projectId, text, afterOrderIndex, role),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["chunks", variables.projectId],
			});
		},
	});
};

export const useUpdateChunkTextMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, text }: { id: string; text: string }) =>
			ChunkRepository.updateText(id, text),

		onSuccess: (data: Chunk) => {
			queryClient.invalidateQueries({ queryKey: ["chunks", data.project_id] });
		},
	});
};

export const useRegenerateChunksMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			projectId,
			chunkIds,
			purgeFiles = true,
		}: {
			projectId: string;
			chunkIds?: string[];
			purgeFiles?: boolean;
		}) => {
			await ProjectRepository.resetChunks(projectId, chunkIds, purgeFiles);
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["chunks", variables.projectId],
			});
		},
	});
};

export const useUpdateProjectSettingsMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			projectId,
			updates,
		}: {
			projectId: string;
			updates: { name?: string; voiceId?: string; speed?: number };
		}) => {
			return ky
				.patch(`/api/projects/${projectId}`, {
					json: {
						name: updates.name,
						voice_id: updates.voiceId,
						speed: updates.speed,
					},
				})
				.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
		},
	});
};

export const useDeleteChunksMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ chunkIds }: { projectId: string; chunkIds: string[] }) =>
			ChunkRepository.deleteChunks(chunkIds),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["chunks", variables.projectId],
			});
		},
	});
};

export const useDeleteProjectMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => ProjectRepository.deleteProject(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
		},
	});
};

export const useReorderChunkMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			chunkId,
			targetIndex,
		}: {
			chunkId: string;
			projectId: string;
			targetIndex: number;
		}) => ChunkRepository.reorderChunk(chunkId, targetIndex),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["chunks", variables.projectId],
			});
		},
	});
};
