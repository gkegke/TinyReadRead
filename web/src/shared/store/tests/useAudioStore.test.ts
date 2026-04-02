import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../lib/queryClient";
import { useAudioStore } from "../useAudioStore";
import { useUIStore } from "../useUIStore";

describe("useAudioStore", () => {
	beforeEach(() => {
		useAudioStore.getState().stopAll();
		useUIStore.setState({ activeProjectId: null });
	});

	it("should update activeChunkId and play when skipToChunk is called", async () => {
		const store = useAudioStore.getState();
		await store.skipToChunk("test-id");
		expect(useAudioStore.getState().activeChunkId).toBe("test-id");
	});

	it("should update playbackRate globally", () => {
		const store = useAudioStore.getState();
		store.setPlaybackRate(1.5);
		expect(useAudioStore.getState().playbackRate).toBe(1.5);
	});

	it("should find and play the next generated chunk when current ends", () => {
		const projectId = "project-1";
		const mockChunks = [
			{ id: "c1", status: "generated" },
			{ id: "c2", status: "generated" },
		];

		useUIStore.setState({ activeProjectId: projectId });

		vi.spyOn(queryClient, "getQueryData").mockReturnValue(mockChunks);

		const store = useAudioStore.getState();
		useAudioStore.setState({ activeChunkId: "c1" });

		store.playNext();

		expect(useAudioStore.getState().activeChunkId).toBe("c2");
	});
});
