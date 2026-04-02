import { LayoutPanelLeft, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../shared/components/ui/button";
import { useImportTextMutation } from "../../../shared/hooks/useMutations";
import { useProjectChunks } from "../../../shared/hooks/useQueries";
import { cn } from "../../../shared/lib/utils";
import { useAudioStore } from "../../../shared/store/useAudioStore";
import { useUIStore } from "../../../shared/store/useUIStore";
import { ChunkItem } from "./ChunkItem";
import { InsertionPoint } from "./InsertionPoint";

export function Timeline() {
	const { activeChunkId, isPlaying } = useAudioStore();
	const {
		activeProjectId,
		hiddenChapters,
		scrollToChunkId,
		setScrollToChunkId,
	} = useUIStore();

	const { data: chunks = [], isLoading } = useProjectChunks(activeProjectId);
	const { mutate: importText, isPending: isImporting } =
		useImportTextMutation();
	const [emptyStateText, setEmptyStateText] = useState("");
	const emptyStateRef = useRef<HTMLTextAreaElement>(null);

	// [UX] Automatic focus for empty state
	useEffect(() => {
		if (chunks.length === 0 && !isLoading) {
			emptyStateRef.current?.focus();
		}
	}, [chunks.length, isLoading]);

	useEffect(() => {
		if (scrollToChunkId) {
			document
				.getElementById(`chunk-${scrollToChunkId}`)
				?.scrollIntoView({ behavior: "smooth", block: "center" });
			setScrollToChunkId(null);
		}
	}, [scrollToChunkId, setScrollToChunkId]);

	useEffect(() => {
		if (activeChunkId) {
			document
				.getElementById(`chunk-${activeChunkId}`)
				?.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}, [activeChunkId]);

	const visibleChunks = useMemo(() => {
		const result = [];
		let currentChapterId = "start";
		for (const chunk of chunks) {
			if (chunk.role === "heading") currentChapterId = chunk.id;
			if (chunk.role === "heading" || !hiddenChapters[currentChapterId]) {
				result.push(chunk);
			}
		}
		return result;
	}, [chunks, hiddenChapters]);

	if (!activeProjectId) {
		return (
			<div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-40">
				<LayoutPanelLeft className="w-16 h-16 mb-6 text-muted-foreground/50" />
				<h2 className="text-xs font-black uppercase tracking-widest">
					No Active Session
				</h2>
				<p className="text-[10px] mt-2 max-w-[200px]">
					Select or create a project from the sidebar to begin.
				</p>
			</div>
		);
	}

	if (isLoading)
		return (
			<div className="h-full flex flex-col items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin mb-4 text-primary/40" />
				<span className="text-[10px] font-black uppercase tracking-widest opacity-40">
					Synchronizing...
				</span>
			</div>
		);

	// [FEATURE] Enhanced Empty State for projects with no content
	if (chunks.length === 0) {
		return (
			<div className="h-full max-w-2xl mx-auto flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
				<div className="w-full bg-secondary/20 border border-border/50 rounded-[2rem] p-8 space-y-6 shadow-2xl">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
							<Sparkles className="w-5 h-5 text-primary" />
						</div>
						<div>
							<h2 className="text-sm font-black uppercase tracking-tight">
								Studio is Ready
							</h2>
							<p className="text-[10px] text-muted-foreground uppercase font-bold">
								Paste text below to generate chunks
							</p>
						</div>
					</div>

					<textarea
						ref={emptyStateRef}
						value={emptyStateText}
						onChange={(e) => setEmptyStateText(e.target.value)}
						placeholder="Type or paste your manuscript here..."
						className="w-full h-48 bg-transparent border-none outline-none resize-none text-xl font-serif leading-relaxed"
					/>

					<div className="flex justify-between items-center pt-4 border-t border-border/50">
						<p className="text-[9px] text-muted-foreground font-medium max-w-[240px]">
							Chunks are created automatically based on paragraphs and headings
							(#).
						</p>
						<Button
							disabled={!emptyStateText.trim() || isImporting}
							onClick={() => {
								importText({
									text: emptyStateText,
									projectId: activeProjectId,
								});
								setEmptyStateText("");
							}}
							className="rounded-full px-6 h-11"
						>
							{isImporting ? (
								<Loader2 className="w-4 h-4 animate-spin mr-2" />
							) : (
								<Send className="w-4 h-4 mr-2" />
							)}
							Begin Processing
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full w-full bg-background/30 overflow-y-auto scroll-smooth pb-40">
			<div className="max-w-4xl mx-auto w-full px-8 pt-20 space-y-2">
				{visibleChunks.map((chunk) => {
					const actualIndex = chunks.findIndex((c) => c.id === chunk.id);
					const isChunkPlaying = activeChunkId === chunk.id && isPlaying;

					return (
						<div
							key={chunk.id}
							id={`chunk-${chunk.id}`}
							className={cn(
								"chunk-item-container",
								isChunkPlaying && "is-playing",
							)}
						>
							<InsertionPoint
								projectId={activeProjectId}
								afterOrderIndex={actualIndex - 1}
							/>
							<ChunkItem chunk={chunk} index={actualIndex} />
						</div>
					);
				})}
				<InsertionPoint
					projectId={activeProjectId}
					afterOrderIndex={chunks.length - 1}
				/>
			</div>
		</div>
	);
}
