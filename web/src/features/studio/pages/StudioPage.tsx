import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import type React from "react";
import { Button } from "../../../shared/components/ui/button";
import { useProject } from "../../../shared/hooks/useQueries";
import { useUIStore } from "../../../shared/store/useUIStore";
import { ProjectInspector } from "../components/ProjectInspector";
import { Timeline } from "../components/Timeline";

/**
 * [UX FIX] StudioPage Project Validation.
 * Checks if the current projectId exists in the library.
 * Prevents "ghost" UI states for invalid URLs.
 */
export const StudioPage: React.FC = () => {
	const { activeProjectId } = useUIStore();
	const { data: project, isLoading, isError } = useProject(activeProjectId);

	// Handled loading state specifically for the metadata check.
	if (isLoading && !project) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center bg-secondary/5">
				<Loader2 className="w-6 h-6 animate-spin text-primary/20" />
			</div>
		);
	}

	if (isError || (!isLoading && !project)) {
		return (
			<div className="h-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500 bg-secondary/5">
				<div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
					<AlertCircle className="w-8 h-8 text-destructive" />
				</div>
				<h2 className="text-lg font-black uppercase tracking-widest mb-2">
					Project Not Found
				</h2>
				<p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-8">
					The requested session ID does not exist or has been deleted.
				</p>
				<Link to="/">
					<Button variant="outline" className="rounded-full px-6">
						<ArrowLeft className="w-4 h-4 mr-2" />
						Return to Library
					</Button>
				</Link>
			</div>
		);
	}

	return (
		<div className="flex-1 flex min-h-0 relative overflow-hidden">
			<main className="flex-1 min-w-0 relative overflow-hidden bg-secondary/5">
				<Timeline />
			</main>
			<ProjectInspector />
		</div>
	);
};
