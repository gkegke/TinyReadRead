import {
	CheckSquare,
	Download,
	FileArchive,
	Loader2,
	Square,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "../../../shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../../../shared/components/ui/dialog";
import type { Chapter } from "../../../shared/lib/chapterUtils";
import { cn } from "../../../shared/lib/utils";
import { exportService } from "../../../shared/services/ExportService";

interface ExportDialogProps {
	projectId: string;
	chapters: Chapter[];
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
	projectId,
	chapters,
}) => {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [isExporting, setIsExporting] = useState(false);

	const toggleChapter = (id: string) => {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelectedIds(next);
	};

	const handleExport = async () => {
		setIsExporting(true);
		try {
			const ids = Array.from(selectedIds);
			await exportService.exportProjectAudio(
				projectId,
				ids.length > 0 ? ids : undefined,
			);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button className="w-full text-[10px] font-black tracking-widest uppercase h-10 shadow-lg shadow-primary/5">
					<Download className="w-4 h-4 mr-2" />
					Export Audio (.zip)
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileArchive className="w-5 h-5 text-primary" />
						Bundle Export
					</DialogTitle>
				</DialogHeader>

				<div className="py-4 space-y-4">
					<div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
						<span>Select Chapters</span>
						<button
							type="button"
							onClick={() => setSelectedIds(new Set())}
							className="hover:text-primary"
						>
							Clear Selection
						</button>
					</div>

					<div className="max-h-[300px] overflow-y-auto space-y-1 pr-2">
						{chapters.map((ch) => (
							<button
								key={ch.id}
								type="button"
								onClick={() => toggleChapter(ch.id)}
								className={cn(
									"w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
									selectedIds.has(ch.id)
										? "bg-primary/5 border-primary/20"
										: "hover:bg-secondary/50 border-transparent",
								)}
							>
								<div className="flex items-center gap-3">
									{selectedIds.has(ch.id) ? (
										<CheckSquare className="w-4 h-4 text-primary" />
									) : (
										<Square className="w-4 h-4 text-muted-foreground" />
									)}
									<span className="text-sm font-bold">{ch.title}</span>
								</div>
								<span className="text-[10px] font-mono opacity-40">
									{ch.chunks.length} blocks
								</span>
							</button>
						))}
					</div>

					<div className="bg-secondary/30 p-4 rounded-2xl space-y-3">
						<p className="text-[10px] text-muted-foreground leading-relaxed">
							{selectedIds.size === 0
								? "No specific chapters selected. Exporting the ENTIRE project as a structured ZIP."
								: `Exporting ${selectedIds.size} selected chapter(s). Only generated blocks will be included.`}
						</p>
						<Button
							type="button"
							className="w-full h-11 text-xs font-black uppercase tracking-widest"
							onClick={handleExport}
							disabled={isExporting}
						>
							{isExporting ? (
								<Loader2 className="w-4 h-4 animate-spin mr-2" />
							) : (
								<Download className="w-4 h-4 mr-2" />
							)}
							Start Delivery
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
