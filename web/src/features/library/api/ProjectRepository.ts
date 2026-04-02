import ky from "ky";
import type { Project } from "../../../shared/types/schema";

class ProjectRepositoryImpl {
	async fetchAll(): Promise<Project[]> {
		return ky.get("/api/projects").json<Project[]>();
	}

	async createProject(name: string): Promise<Project> {
		return ky.post("/api/projects", { json: { name } }).json<Project>();
	}

	async importRawText(projectId: string, text: string) {
		return ky
			.post(`/api/projects/${projectId}/import`, { json: { text } })
			.json();
	}

	async resetChunks(
		projectId: string,
		chunkIds?: string[],
		purgeFiles = false,
	) {
		return ky
			.post(`/api/projects/${projectId}/reset-chunks`, {
				json: {
					chunk_ids: chunkIds || null,
					purge_files: purgeFiles,
				},
			})
			.json();
	}

	async deleteProject(projectId: string) {
		return ky.delete(`/api/projects/${projectId}`).json();
	}

	async updateSettings(projectId: string, updates: Partial<Project>) {
		return ky.patch(`/api/projects/${projectId}`, { json: updates }).json();
	}
}

export const ProjectRepository = new ProjectRepositoryImpl();
