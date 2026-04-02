import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chunk } from "../types/schema";

export const EMPTY_CHUNKS: Chunk[] = [];

interface UIState {
	activeProjectId: string | null;
	scrollToChunkId: string | null;
	isInspectorOpen: boolean;
	isSidebarOpen: boolean;

	activeModelId: string;
	availableVoices: string[];
	hiddenChapters: Record<string, boolean>;

	setActiveProject: (id: string | null) => void;
	setScrollToChunkId: (id: string | null) => void;
	setInspectorOpen: (open: boolean) => void;
	setSidebarOpen: (open: boolean) => void;
	setActiveModelId: (id: string) => void;
	setVoices: (voices: { id: string; name: string }[]) => void;
	toggleChapterHidden: (chapterId: string) => void;
}

export const useUIStore = create<UIState>()(
	persist(
		(set) => ({
			activeProjectId: null,
			scrollToChunkId: null,
			isInspectorOpen: true,
			isSidebarOpen: true,

			activeModelId: "kitten-mini",
			availableVoices: [],
			hiddenChapters: {},

			setActiveProject: (id) => set({ activeProjectId: id }),
			setScrollToChunkId: (id) => set({ scrollToChunkId: id }),
			setInspectorOpen: (open) => set({ isInspectorOpen: open }),
			setSidebarOpen: (open) => set({ isSidebarOpen: open }),

			setActiveModelId: (id) => set({ activeModelId: id }),
			setVoices: (voices) =>
				set({ availableVoices: voices.map((v) => v.name) }),
			toggleChapterHidden: (chapterId) =>
				set((state) => ({
					hiddenChapters: {
						...state.hiddenChapters,
						[chapterId]: !state.hiddenChapters[chapterId],
					},
				})),
		}),
		{
			name: "trr-ui-v4",
			partialize: (state) => ({
				isInspectorOpen: state.isInspectorOpen,
				isSidebarOpen: state.isSidebarOpen,
				activeModelId: state.activeModelId,
				hiddenChapters: state.hiddenChapters,
			}),
		},
	),
);
