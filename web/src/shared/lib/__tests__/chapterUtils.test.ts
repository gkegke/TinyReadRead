import { describe, expect, it } from "vitest";
import type { Chunk } from "../../types/schema";
import { deriveChapters } from "../chapterUtils";

describe("chapterUtils", () => {
	it('should group paragraphs into a default "Beginning" chapter', () => {
		const chunks = [
			{ id: "1", role: "paragraph", text_content: "P1" } as Chunk,
			{ id: "2", role: "paragraph", text_content: "P2" } as Chunk,
		];
		const result = deriveChapters(chunks);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Beginning");
		expect(result[0].chunks).toHaveLength(2);
	});

	it("should split chapters on heading role", () => {
		const chunks = [
			{ id: "1", role: "heading", text_content: "Chapter 1" } as Chunk,
			{ id: "2", role: "paragraph", text_content: "P1" } as Chunk,
			{ id: "3", role: "heading", text_content: "Chapter 2" } as Chunk,
		];
		const result = deriveChapters(chunks);
		expect(result).toHaveLength(2);
		expect(result[0].title).toBe("Chapter 1");
		expect(result[1].title).toBe("Chapter 2");
		expect(result[1].chunks).toHaveLength(1);
	});
});
