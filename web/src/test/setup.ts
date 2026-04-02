import { beforeEach, vi } from "vitest";

/**
 * [STABILITY] Mock LocalStorage for Zustand Persistence
 */
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value.toString();
		},
		clear: () => {
			store = {};
		},
		removeItem: (key: string) => {
			delete store[key];
		},
	};
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

/**
 * [CRITICAL] Mock HTML5 Audio Element for Store Testing
 */
class MockAudio {
	src: string = "";
	playbackRate: number = 1.0;
	paused: boolean = true;
	play = vi.fn().mockResolvedValue(undefined);
	pause = vi.fn();
	// Callbacks
	onplay: (() => void) | null = null;
	onpause: (() => void) | null = null;
	onended: (() => void) | null = null;
}

// @ts-ignore
global.Audio = MockAudio;

beforeEach(() => {
	vi.clearAllMocks();
	window.localStorage.clear();
});
