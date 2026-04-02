import ky from "ky";
import {
	AlertCircle,
	AlignLeft,
	CheckCircle2,
	ChevronRight,
	CloudDownload,
	Cpu,
	Eye,
	EyeOff,
	HardDriveDownload,
	Layers,
	Loader2,
	PackageOpen,
	X,
	Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../shared/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../../shared/components/ui/select";
import { useRegenerateChunksMutation } from "../../../shared/hooks/useMutations";
import {
	useDetailedJobStatus,
	useProjectChunks,
	useSystemModels,
} from "../../../shared/hooks/useQueries";
import { deriveChapters } from "../../../shared/lib/chapterUtils";
import { cn } from "../../../shared/lib/utils";
import { useAudioStore } from "../../../shared/store/useAudioStore";
import { useUIStore } from "../../../shared/store/useUIStore";
import { ExportDialog } from "./ExportDialog";
import { VoiceSelector } from "./VoiceSelector";

export const ProjectInspector: React.FC = () => {
	// --- Store & State ---
	const {
		activeProjectId,
		isInspectorOpen,
		setInspectorOpen,
		activeModelId,
		setActiveModelId,
		hiddenChapters,
		toggleChapterHidden,
	} = useUIStore();

	const { playbackRate, setPlaybackRate } = useAudioStore();
	const { data: chunks = [] } = useProjectChunks(activeProjectId);
	const { data: systemModels = [] } = useSystemModels();
	const { mutate: regenerateChunks } = useRegenerateChunksMutation();
	const { activeCount, pendingCount } = useDetailedJobStatus(activeProjectId);

	const [startIdx, setStartIdx] = useState("");
	const [endIdx, setEndIdx] = useState("");
	const [selectedChapterId, setSelectedChapterId] = useState<string>("none");
	const [expandedChapterId, setExpandedChapterId] = useState<string | null>(
		null,
	);
	const hasInitializedRef = useRef(false);

	// --- Model Health Logic ---
	const currentModelStatus = systemModels.find((m) => m.id === activeModelId);
	const isModelReady = currentModelStatus?.is_downloaded;
	const isDownloading = currentModelStatus?.status === "downloading";

	// --- Derived Data ---
	const chapters = useMemo(() => deriveChapters(chunks), [chunks]);
	const hasChunks = chunks.length > 0;

	// --- Lifecycle Effects ---
	useEffect(() => {
		if (
			chapters.length > 0 &&
			!expandedChapterId &&
			!hasInitializedRef.current
		) {
			setExpandedChapterId(chapters[0].id);
			hasInitializedRef.current = true;
		}
	}, [chapters, expandedChapterId]);

	useEffect(() => {
		hasInitializedRef.current = false;
		setExpandedChapterId(null);
	}, [activeProjectId]);

	if (!activeProjectId) return null;

	// --- Handlers ---
	const handleDownloadModel = async () => {
		try {
			await ky.post(`/api/system/models/${activeModelId}/download`);
		} catch (e) {
			console.error("Failed to trigger download", e);
		}
	};

	const handleBulkGenerate = () => {
		if (!isModelReady) return;
		const s = startIdx === "" ? 0 : Math.max(0, parseInt(startIdx) - 1);
		const e =
			endIdx === ""
				? chunks.length - 1
				: Math.min(chunks.length - 1, parseInt(endIdx) - 1);

		const targetIds = chunks
			.slice(s, e + 1)
			.filter((c) => {
				const chunkIndex = chunks.indexOf(c);
				let contextId = "start";
				for (let i = 0; i <= chunkIndex; i++) {
					if (chunks[i].role === "heading") contextId = chunks[i].id;
				}
				return !hiddenChapters[contextId];
			})
			.map((c) => c.id);

		if (targetIds.length === 0) {
			alert("No visible blocks found in that range.");
			return;
		}

		if (
			window.confirm(
				`Regenerate ${targetIds.length} blocks? Current audio files will be deleted.`,
			)
		) {
			regenerateChunks({
				projectId: activeProjectId,
				chunkIds: targetIds,
				purgeFiles: true,
			});
		}
	};

	const handleChapterGenerate = () => {
		if (!isModelReady || selectedChapterId === "none") return;
		const chapter = chapters.find((ch) => ch.id === selectedChapterId);
		if (!chapter) return;

		if (
			window.confirm(
				`Regenerate all ${chapter.chunks.length} blocks in "${chapter.title}"?`,
			)
		) {
			regenerateChunks({
				projectId: activeProjectId,
				chunkIds: chapter.chunks.map((c) => c.id),
				purgeFiles: true,
			});
		}
	};

	return (
		<aside
			className={cn(
				"z-40 h-full flex flex-col bg-background border-l transition-all duration-300 overflow-hidden shrink-0",
				isInspectorOpen ? "w-80" : "w-0 border-none",
			)}
		>
			<div className="flex flex-col h-full w-80">
				{/* Header Section */}
				<div className="p-4 h-16 border-b flex items-center justify-between bg-secondary/10">
					<div className="flex items-center gap-2">
						<Layers className="w-4 h-4 text-primary" />
						<span className="text-[10px] font-black uppercase tracking-widest">
							Inspector
						</span>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="md:hidden"
						onClick={() => setInspectorOpen(false)}
					>
						<X className="w-4 h-4" />
					</Button>
				</div>

				{/* Model & Voice Configuration */}
				<div className="p-4 border-b space-y-4">
					<div className="space-y-3">
						<div className="flex flex-col gap-1.5">
							<span className="text-[9px] font-black uppercase text-muted-foreground ml-1">
								TTS Engine
							</span>
							<div className="flex items-center gap-1 bg-secondary/50 rounded-md px-2 h-10 border border-border/50">
								<Cpu className="w-3 h-3" />
								<Select value={activeModelId} onValueChange={setActiveModelId}>
									<SelectTrigger className="border-none bg-transparent h-8 text-[10px] font-bold uppercase focus:ring-0">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{systemModels.map((m) => (
											<SelectItem key={m.id} value={m.id} className="text-xs">
												<div className="flex items-center gap-2">
													{m.is_downloaded ? (
														<CheckCircle2 className="w-3 h-3 text-green-600" />
													) : (
														<CloudDownload className="w-3 h-3 text-muted-foreground" />
													)}
													{m.id.replace("kitten-", "").toUpperCase()}
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Model Health Action Area */}
						{!isModelReady && (
							<div
								className={cn(
									"border rounded-xl p-3 space-y-3 animate-in fade-in zoom-in-95",
									isDownloading
										? "bg-primary/[0.02] border-primary/10"
										: "bg-amber-500/[0.03] border-amber-500/20",
								)}
							>
								<div className="flex items-start gap-3">
									{isDownloading ? (
										<Loader2 className="w-4 h-4 text-primary animate-spin" />
									) : (
										<AlertCircle className="w-4 h-4 text-amber-500" />
									)}
									<div className="space-y-1">
										<p className="text-[10px] font-black uppercase tracking-tight">
											{isDownloading
												? "Downloading Engine..."
												: "Download Required"}
										</p>
										<p className="text-[9px] text-muted-foreground leading-tight">
											{isDownloading
												? "Synthesizer is coming online. Please wait..."
												: "Local weights not found. You must download this model to generate audio."}
										</p>
									</div>
								</div>
								{!isDownloading && (
									<Button
										type="button"
										onClick={handleDownloadModel}
										className="w-full h-8 text-[10px] font-black"
									>
										<HardDriveDownload className="w-3 h-3 mr-2" />
										FETCH MODEL (~80MB)
									</Button>
								)}
							</div>
						)}

						{/* Synthesis dependent controls */}
						<div
							className={cn(
								"space-y-3 transition-all duration-500",
								!isModelReady &&
									"opacity-40 pointer-events-none grayscale blur-[1px]",
							)}
						>
							<VoiceSelector />

							<div className="pt-1">
								<div className="flex items-center justify-between mb-2 px-1">
									<div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-foreground">
										<Zap className="w-2.5 h-2.5" /> Speech Pace
									</div>
									<span className="text-[9px] font-mono font-bold bg-primary/10 text-primary px-1.5 rounded">
										{playbackRate.toFixed(2)}x
									</span>
								</div>
								<input
									type="range"
									min="0.5"
									max="2.5"
									step="0.1"
									value={playbackRate}
									onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
									className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Bulk Action Controls */}
				{hasChunks && (
					<div
						className={cn(
							"px-4 py-4 border-b space-y-4 bg-secondary/5 transition-all",
							!isModelReady && "opacity-20 pointer-events-none grayscale",
						)}
					>
						<div className="space-y-2">
							<span className="text-[9px] font-black uppercase text-muted-foreground ml-1">
								Numeric Range (1-{chunks.length})
							</span>
							<div className="flex items-center gap-2">
								<input
									type="number"
									value={startIdx}
									onChange={(e) => setStartIdx(e.target.value)}
									placeholder="1"
									className="w-full h-8 text-xs bg-background border border-border rounded px-2"
								/>
								<ChevronRight className="w-3 h-3 text-muted-foreground" />
								<input
									type="number"
									value={endIdx}
									onChange={(e) => setEndIdx(e.target.value)}
									placeholder={chunks.length.toString()}
									className="w-full h-8 text-xs bg-background border border-border rounded px-2"
								/>
								<Button
									type="button"
									size="sm"
									onClick={handleBulkGenerate}
									className="h-8 px-4 text-[10px] font-black"
								>
									GO
								</Button>
							</div>
						</div>

						<div className="space-y-2">
							<span className="text-[9px] font-black uppercase text-muted-foreground ml-1">
								Chapter Action
							</span>
							<div className="flex items-center gap-2">
								<div className="flex-1">
									<Select
										value={selectedChapterId}
										onValueChange={setSelectedChapterId}
									>
										<SelectTrigger className="h-8 text-[10px] bg-background">
											<SelectValue placeholder="Select Chapter" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none" className="text-xs">
												Select Chapter...
											</SelectItem>
											{chapters.map((ch) => (
												<SelectItem
													key={ch.id}
													value={ch.id}
													className="text-xs"
												>
													{ch.title.slice(0, 24)}...
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<Button
									type="button"
									size="sm"
									variant="secondary"
									onClick={handleChapterGenerate}
									disabled={selectedChapterId === "none"}
									className="h-8 px-4 text-[10px] font-black border"
								>
									GEN
								</Button>
							</div>
						</div>
					</div>
				)}

				{/* Project Outline Section */}
				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					<div className="flex items-center justify-between opacity-80 mb-2">
						<div className="flex items-center gap-2">
							<AlignLeft className="w-4 h-4" />
							<span className="text-[10px] font-black uppercase tracking-widest">
								Outline
							</span>
						</div>
						<span
							className={cn(
								"text-[8px] px-2 py-0.5 rounded-full font-bold uppercase",
								activeCount > 0
									? "bg-green-500/10 text-green-600 animate-pulse"
									: "bg-secondary text-muted-foreground",
							)}
						>
							{activeCount > 0
								? "processing"
								: pendingCount > 0
									? "queued"
									: "idle"}
						</span>
					</div>

					{!hasChunks ? (
						<div className="flex flex-col items-center justify-center py-10 text-center opacity-20">
							<PackageOpen className="w-10 h-10 mb-2" />
							<span className="text-[10px] font-black uppercase">
								No Content
							</span>
						</div>
					) : (
						chapters.map((chapter) => {
							const generatedCount = chapter.chunks.filter(
								(c) => c.status === "generated",
							).length;
							const isExpanded = expandedChapterId === chapter.id;
							const isHidden = hiddenChapters[chapter.id];

							return (
								<div
									key={chapter.id}
									className="w-full text-left group/ch-item space-y-2 border border-border/30 rounded-xl p-3 bg-secondary/5 hover:bg-secondary/10 transition-colors"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2 min-w-0">
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													toggleChapterHidden(chapter.id);
												}}
												aria-label={isHidden ? "Show Chapter" : "Hide Chapter"}
												className="text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0"
											>
												{isHidden ? (
													<EyeOff className="w-4 h-4" />
												) : (
													<Eye className="w-4 h-4" />
												)}
											</button>
											<button
												type="button"
												onClick={() =>
													setExpandedChapterId(isExpanded ? null : chapter.id)
												}
												className={cn(
													"text-xs font-bold truncate transition-all bg-transparent border-none p-0 text-left flex-1 cursor-pointer",
													isHidden && "opacity-50 line-through",
												)}
											>
												{chapter.title}
											</button>
										</div>
										<span className="text-[9px] font-mono text-muted-foreground shrink-0">
											{generatedCount}/{chapter.chunks.length}
										</span>
									</div>

									{/* Expanded Dots Logic remains same... */}
									{isExpanded && (
										<div className="grid grid-cols-10 gap-1 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
											{chapter.chunks.map((chunk) => (
												<div
													key={chunk.id}
													title={chunk.text_content.slice(0, 50)}
													className={cn(
														"w-full aspect-square rounded-[1px] transition-all",
														chunk.status === "generated"
															? "bg-green-500/80"
															: chunk.status === "processing"
																? "bg-amber-500 animate-pulse"
																: "bg-border/50",
													)}
												/>
											))}
										</div>
									)}
								</div>
							);
						})
					)}
				</div>

				{/* Footer Export Action */}
				{hasChunks && (
					<div className="p-4 border-t bg-secondary/10">
						<ExportDialog projectId={activeProjectId} chapters={chapters} />
					</div>
				)}
			</div>
		</aside>
	);
};
