import ky from "ky";
import type { Chunk } from "../../../shared/types/schema";

class ChunkRepositoryImpl {
	async updateText(chunkId: string, text: string): Promise<Chunk> {
		return ky
			.patch(`/api/chunks/${chunkId}`, { json: { text_content: text } })
			.json<Chunk>();
	}

	async reorderChunk(chunkId: string, targetIndex: number) {
		return ky
			.post(`/api/chunks/${chunkId}/reorder`, {
				json: { target_index: targetIndex },
			})
			.json();
	}

	async deleteChunks(chunkIds: string[]) {
		for (const id of chunkIds) {
			await ky.delete(`/api/chunks/${id}`);
		}
	}

	async insertBlock(
		projectId: string,
		text: string,
		_afterOrderIndex: number,
		_role: string,
	) {
		// [Note] Role and index are currently handled implicitly by the backend /import logic.
		// Params prefixed with _ to acknowledge they are passed but not currently used in the request body.
		return ky
			.post(`/api/projects/${projectId}/import`, {
				json: { text },
			})
			.json();
	}
}

export const ChunkRepository = new ChunkRepositoryImpl();
