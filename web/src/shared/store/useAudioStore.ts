import { create } from "zustand";
import { persist } from "zustand/middleware";
import { queryClient } from "../lib/queryClient";
import type { Chunk } from "../types/schema";
import { useUIStore } from "./useUIStore";

const audioEl = new Audio();

interface AudioState {
	activeChunkId: string | null;
	isPlaying: boolean;
	playbackRate: number;
	togglePlay: () => void;
	stopAll: () => void;
	skipToChunk: (id: string) => Promise<void>;
	playNext: () => void;
	setPlaybackRate: (rate: number) => void;
}

export const useAudioStore = create<AudioState>()(
	persist(
		(set, get) => {
			audioEl.onplay = () => set({ isPlaying: true });
			audioEl.onpause = () => set({ isPlaying: false });
			audioEl.onended = () => {
				set({ isPlaying: false });
				get().playNext();
			};

			return {
				activeChunkId: null,
				isPlaying: false,
				playbackRate: 1.0,

				setPlaybackRate: (rate) => {
					audioEl.playbackRate = rate;
					set({ playbackRate: rate });
				},

				togglePlay: () => {
					if (!get().activeChunkId) return;
					audioEl.paused
						? audioEl.play().catch(console.error)
						: audioEl.pause();
				},

				stopAll: () => {
					audioEl.pause();
					audioEl.src = "";
					set({ activeChunkId: null, isPlaying: false });
				},

				skipToChunk: async (id: string) => {
					set({ activeChunkId: id, isPlaying: false });
					const sourceUrl = `/api/audio/${id}`;
					if (audioEl.src !== window.location.origin + sourceUrl) {
						audioEl.src = sourceUrl;
					}
					audioEl.playbackRate = get().playbackRate;
					try {
						await audioEl.play();
					} catch {
						set({ isPlaying: false });
					}
				},

				playNext: () => {
					const { activeChunkId } = get();
					const projectId = useUIStore.getState().activeProjectId;
					if (!projectId || !activeChunkId) return;

					const chunks =
						queryClient.getQueryData<Chunk[]>(["chunks", projectId]) || [];
					const idx = chunks.findIndex((c) => c.id === activeChunkId);

					if (idx !== -1 && idx < chunks.length - 1) {
						const next = chunks[idx + 1];
						if (next.status === "generated") get().skipToChunk(next.id);
						else set({ isPlaying: false });
					} else {
						get().stopAll();
					}
				},
			};
		},
		{
			name: "trr-audio-settings-v2",
			partialize: (state) => ({ playbackRate: state.playbackRate }),
		},
	),
);
