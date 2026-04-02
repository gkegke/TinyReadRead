import {
	AlertCircle,
	ArrowRightLeft,
	Check,
	Loader2,
	PauseCircle,
	PenTool,
	PlayCircle,
	RefreshCw,
	Settings2,
	Trash2,
} from "lucide-react";
import type React from "react";
import { memo, useEffect, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../../shared/components/ui/dropdown-menu";
import {
	useDeleteChunksMutation,
	useRegenerateChunksMutation,
	useReorderChunkMutation,
	useUpdateChunkTextMutation,
} from "../../../shared/hooks/useMutations";
import { cn } from "../../../shared/lib/utils";
import { useAudioStore } from "../../../shared/store/useAudioStore";
import { useUIStore } from "../../../shared/store/useUIStore";
import type { Chunk } from "../../../shared/types/schema";
import { StudioBlockEditor } from "./StudioBlockEditor";

interface ChunkItemProps {
	chunk: Chunk;
	index: number;
}

export const ChunkItem = memo(({ chunk, index }: ChunkItemProps) => {
	const {
		activeChunkId,
		isPlaying: isGlobalAudioPlaying,
		togglePlay,
		skipToChunk,
	} = useAudioStore();
	const { setScrollToChunkId } = useUIStore();

	const isCurrentActive = activeChunkId === chunk.id;
	const isPlaying = isCurrentActive && isGlobalAudioPlaying;
	const isProcessing =
		chunk.status === "processing" || chunk.status === "pending";
	const isFailed = chunk.status === "failed";

	const [isEditing, setIsEditing] = useState(false);
	const [isMoving, setIsMoving] = useState(false);
	const [localText, setLocalText] = useState(chunk.text_content);
	const [targetPos, setTargetPos] = useState((index + 1).toString());

	const { mutate: updateText, isPending: isUpdating } =
		useUpdateChunkTextMutation();
	const { mutate: regenerate } = useRegenerateChunksMutation();
	const { mutate: deleteChunk } = useDeleteChunksMutation();
	const { mutate: reorder, isPending: isReordering } =
		useReorderChunkMutation();

	useEffect(() => {
		if (!isEditing) {
			const prefix = chunk.role === "heading" ? "# " : "";
			setLocalText(prefix + chunk.text_content);
		}
	}, [chunk.text_content, chunk.role, isEditing]);

	const handlePlay = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (chunk.status !== "generated") return;
		if (isCurrentActive) {
			togglePlay();
			return;
		}
		if (chunk.id) skipToChunk(chunk.id);
	};

	const handleReorder = () => {
		const pos = parseInt(targetPos);
		if (Number.isNaN(pos) || pos === index + 1) {
			setIsMoving(false);
			return;
		}
		reorder(
			{ chunkId: chunk.id, projectId: chunk.project_id, targetIndex: pos },
			{
				onSuccess: () => {
					setIsMoving(false);
					// Trigger auto-scroll to the new position
					setScrollToChunkId(chunk.id);
				},
			},
		);
	};

	return (
		<div
			className={cn(
				"group/chunk relative pl-12 pr-12 py-8 transition-all duration-500 rounded-3xl border border-transparent overflow-hidden",
				isCurrentActive
					? "bg-primary/[0.04] shadow-[0_0_40px_rgba(var(--primary),0.02)]"
					: "hover:bg-secondary/5",
				isEditing &&
					"bg-background shadow-2xl scale-[1.02] z-20 border-primary/10",
				isFailed && "border-destructive/20 bg-destructive/[0.02]",
			)}
		>
			{isPlaying && (
				<div className="absolute inset-0 pointer-events-none opacity-20 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 animate-shimmer" />
			)}

			<button
				type="button"
				className="absolute left-0 top-0 bottom-0 w-12 flex flex-col items-center justify-center group/pos-zone cursor-pointer border-none bg-transparent"
				onClick={() => !isMoving && setIsMoving(true)}
				aria-label="Move chunk position"
			>
				<div className="absolute inset-y-4 left-2 w-1 bg-primary/0 group-hover/pos-zone:bg-primary/10 rounded-full transition-colors" />

				<div className="relative flex flex-col items-center gap-1">
					{isMoving ? (
						<form
							className="flex flex-col items-center gap-2 bg-background border rounded-lg p-1.5 shadow-2xl animate-in zoom-in-95 z-30"
							// Remove the onClick here
							onSubmit={(e) => {
								e.preventDefault();
								handleReorder();
							}}
						>
							<input
								type="number"
								value={targetPos}
								// Stop propagation here
								onClick={(e) => e.stopPropagation()}
								onChange={(e) => setTargetPos(e.target.value)}
								className="w-10 h-8 text-[10px] font-black text-center bg-secondary rounded focus:ring-1 ring-primary outline-none"
							/>
							<button
								type="submit"
								aria-label="Confirm Reorder"
								// Stop propagation here
								onClick={(e) => e.stopPropagation()}
								className="p-1 hover:text-green-600 transition-colors border-none bg-transparent cursor-pointer"
							>
								{isReordering ? (
									<Loader2 className="w-3 h-3 animate-spin" />
								) : (
									<Check className="w-3 h-3" />
								)}
							</button>
						</form>
					) : (
						<div className="flex flex-col items-center transition-all duration-300 group-hover/pos-zone:scale-110">
							<span className="text-[10px] font-mono font-black opacity-10 group-hover/pos-zone:opacity-100 group-hover/pos-zone:text-primary">
								#{index + 1}
							</span>
							<ArrowRightLeft className="w-3 h-3 opacity-0 group-hover/pos-zone:opacity-100 text-primary mt-1" />
						</div>
					)}
				</div>
			</button>

			<div className="relative z-10">
				{isEditing ? (
					<StudioBlockEditor
						text={localText}
						onChange={setLocalText}
						onSave={() =>
							updateText(
								{ id: chunk.id, text: localText },
								{ onSuccess: () => setIsEditing(false) },
							)
						}
						onCancel={() => setIsEditing(false)}
						isPending={isUpdating}
					/>
				) : (
					<>
						<p
							onDoubleClick={() => setIsEditing(true)}
							className={cn(
								"text-2xl font-serif leading-relaxed transition-colors duration-700 cursor-text",
								isPlaying ? "text-primary" : "text-foreground/90",
								chunk.role === "heading" && "font-black text-3xl font-sans",
								isFailed && "opacity-50",
							)}
						>
							{chunk.text_content}
						</p>
						{isFailed && (
							<div className="mt-2 flex items-center gap-2 text-destructive">
								<AlertCircle className="w-3 h-3" />
								<span className="text-[10px] font-bold uppercase tracking-tight">
									Synthesis Failed: {chunk.error_message || "Internal Error"}
								</span>
							</div>
						)}
					</>
				)}
			</div>

			{!isEditing && (
				<div className="mt-6 flex flex-col gap-4">
					<div className="h-8 flex items-center justify-between opacity-0 group-hover/chunk:opacity-100 transition-opacity">
						<div className="flex-1 mr-8">
							{isProcessing && (
								<div className="h-0.5 w-full bg-primary/20 animate-pulse rounded-full" />
							)}
						</div>
						<div className="flex items-center gap-4">
							<DropdownMenu>
								<DropdownMenuTrigger className="p-2 hover:bg-secondary rounded-lg transition-colors">
									<Settings2 className="w-4 h-4 text-muted-foreground" />
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<DropdownMenuItem onClick={() => setIsEditing(true)}>
										<PenTool className="w-3.5 h-3.5 mr-2" /> Edit Content
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setIsMoving(true)}>
										<ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Move
										Position
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											regenerate({
												projectId: chunk.project_id,
												chunkIds: [chunk.id],
											})
										}
									>
										<RefreshCw className="w-3.5 h-3.5 mr-2" /> Force Regenerate
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
										onClick={() =>
											deleteChunk({
												projectId: chunk.project_id,
												chunkIds: [chunk.id],
											})
										}
									>
										<Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Block
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							<button
								type="button"
								onClick={handlePlay}
								className={cn(
									"text-primary transition-all active:scale-95",
									chunk.status !== "generated" &&
										"opacity-20 cursor-not-allowed",
								)}
							>
								{chunk.status === "processing" ? (
									<Loader2 className="w-9 h-9 animate-spin text-muted-foreground" />
								) : isPlaying ? (
									<PauseCircle className="w-9 h-9" />
								) : (
									<PlayCircle className="w-9 h-9" />
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
});
