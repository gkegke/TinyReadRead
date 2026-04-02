import ky from "ky";
import { Mic2, RefreshCw } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "../../../shared/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../../shared/components/ui/select";
import {
	useRegenerateChunksMutation,
	useUpdateProjectSettingsMutation,
} from "../../../shared/hooks/useMutations";
import {
	useProjectChunks,
	useProjects,
} from "../../../shared/hooks/useQueries";
import { useUIStore } from "../../../shared/store/useUIStore";

export const VoiceSelector: React.FC = () => {
	const { activeProjectId, hiddenChapters } = useUIStore();
	const { data: projects = [] } = useProjects();
	const { data: chunks = [] } = useProjectChunks(activeProjectId);
	const { mutate: updateSettings } = useUpdateProjectSettingsMutation();
	const { mutate: regenerateChunks, isPending: isResetting } =
		useRegenerateChunksMutation();

	const [voices, setVoices] = useState<string[]>([]);

	const project = projects.find((p) => p.id === activeProjectId);
	const currentVoice = project?.voice_id || "Jasper";

	useEffect(() => {
		ky.get("/api/voices")
			.json<{ voices: string[] }>()
			.then((res) => {
				setVoices(res.voices);
			})
			.catch((err) => console.error("Failed to fetch voices", err));
	}, []);

	const handleVoiceChange = (voiceId: string) => {
		if (!activeProjectId) return;
		updateSettings({
			projectId: activeProjectId,
			updates: { voiceId },
		});
	};

	/**
	 * [UX PRINCIPLE] Scoped Global Action.
	 * Filter out chunks that belong to hidden chapters before sending to backend.
	 */
	const handleRegenerateVisible = () => {
		if (!activeProjectId) return;

		let currentChapterId = "start";
		const visibleChunkIds = chunks
			.filter((c) => {
				if (c.role === "heading") currentChapterId = c.id;
				return !hiddenChapters[currentChapterId];
			})
			.map((c) => c.id);

		if (visibleChunkIds.length === 0) return;

		const msg =
			hiddenChapters && Object.values(hiddenChapters).some((v) => v)
				? `Regenerate all ${visibleChunkIds.length} visible blocks? (Hidden chapters ignored)`
				: `Regenerate all ${visibleChunkIds.length} blocks?`;

		if (window.confirm(msg)) {
			regenerateChunks({
				projectId: activeProjectId,
				chunkIds: visibleChunkIds,
				purgeFiles: true,
			});
		}
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-1 bg-secondary/50 rounded-md px-2 h-8 border border-border/50">
				<Mic2 className="w-3 h-3 text-muted-foreground" />
				<Select value={currentVoice} onValueChange={handleVoiceChange}>
					<SelectTrigger className="w-full border-none bg-transparent h-7 text-[10px] font-bold uppercase focus:ring-0">
						<SelectValue>{currentVoice}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{voices.map((v) => (
							<SelectItem key={v} value={v} className="text-xs">
								{v}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<Button
				variant="ghost"
				size="sm"
				onClick={handleRegenerateVisible}
				disabled={isResetting || chunks.length === 0}
				className="w-full h-7 text-[9px] font-black tracking-widest text-muted-foreground hover:text-primary"
			>
				<RefreshCw
					className={`w-3 h-3 mr-2 ${isResetting ? "animate-spin" : ""}`}
				/>
				REGENERATE VISIBLE BLOCKS
			</Button>
		</div>
	);
};
