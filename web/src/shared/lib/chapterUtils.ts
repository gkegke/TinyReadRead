import type { Chunk } from "../types/schema";

export interface Chapter {
	id: string;
	title: string;
	chunks: Chunk[];
}

/**
 * [REFACTOR] Deterministic Chapter Derivation.
 * Transforms a linear list of chunks into a hierarchical Chapter structure.
 * A new chapter starts whenever a chunk has the role 'heading'.
 */
export function deriveChapters(chunks: Chunk[]): Chapter[] {
	const result: Chapter[] = [];
	let currentChapter: Chapter = { id: "start", title: "Beginning", chunks: [] };

	for (const c of chunks) {
		if (c.role === "heading") {
			// If the current "in-progress" chapter has content, push it before starting new one
			if (currentChapter.chunks.length > 0 || currentChapter.id !== "start") {
				result.push(currentChapter);
			}
			currentChapter = { id: c.id, title: c.text_content, chunks: [c] };
		} else {
			currentChapter.chunks.push(c);
		}
	}

	if (currentChapter.chunks.length > 0) {
		result.push(currentChapter);
	}

	return result;
}
