import { Link } from "@tanstack/react-router";
import {
	Check,
	Disc,
	Edit3,
	PanelLeft,
	PanelLeftClose,
	PanelRight,
	PanelRightClose,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useUpdateProjectSettingsMutation } from "../hooks/useMutations";
import { useProjects } from "../hooks/useQueries";
import { cn } from "../lib/utils";
import { useUIStore } from "../store/useUIStore";
import { Button } from "./ui/button";

export const GlobalHeader: React.FC = () => {
	const {
		activeProjectId,
		isInspectorOpen,
		setInspectorOpen,
		isSidebarOpen,
		setSidebarOpen,
	} = useUIStore();
	const { data: projects = [] } = useProjects();
	const { mutate: updateSettings } = useUpdateProjectSettingsMutation();

	const project = projects.find((p) => p.id === activeProjectId);
	const [isEditing, setIsEditing] = useState(false);
	const [name, setName] = useState("");

	useEffect(() => {
		if (project) setName(project.name);
	}, [project]);

	const handleSave = () => {
		if (!activeProjectId || !name.trim()) return;
		updateSettings({ projectId: activeProjectId, updates: { name } });
		setIsEditing(false);
	};

	return (
		<header className="h-16 flex items-center justify-between px-4 border-b bg-background/80 backdrop-blur-md z-40 shrink-0">
			<div className="flex items-center gap-2 flex-1 min-w-0">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => setSidebarOpen(!isSidebarOpen)}
					className={cn(
						isSidebarOpen ? "text-primary" : "text-muted-foreground",
					)}
					title="Toggle Sidebar"
				>
					{isSidebarOpen ? (
						<PanelLeftClose className="w-5 h-5" />
					) : (
						<PanelLeft className="w-5 h-5" />
					)}
				</Button>

				<div className="h-6 w-px bg-border/50 mx-1 shrink-0" />

				<div className="flex items-center gap-3 min-w-0 flex-1 ml-2">
					<Link to="/" className="shrink-0">
						<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
							<Disc className="w-5 h-5 text-background animate-spin [animation-duration:8s]" />
						</div>
					</Link>

					{activeProjectId && project ? (
						isEditing ? (
							<div className="flex items-center gap-2 w-full max-w-sm">
								<input
									value={name}
									onChange={(e) => setName(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleSave()}
									className="bg-secondary/50 border-none rounded px-2 py-1 text-sm font-black uppercase tracking-tight w-full outline-none ring-1 ring-primary/20"
								/>
								<button
									type="button"
									onClick={handleSave}
									className="p-1 text-green-600 hover:bg-green-50 rounded"
								>
									<Check className="w-4 h-4" />
								</button>
							</div>
						) : (
							<button
								type="button"
								className="flex items-center gap-2 group cursor-pointer min-w-0 bg-transparent border-none"
								onClick={() => setIsEditing(true)}
							>
								<h1
									className="text-sm font-black tracking-tight uppercase truncate"
									title={project.name}
								>
									{project.name}
								</h1>
								<Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
							</button>
						)
					) : (
						<h1 className="text-sm font-black tracking-tight uppercase truncate text-muted-foreground">
							ReadRead Studio
						</h1>
					)}
				</div>
			</div>

			<div className="flex items-center gap-2 shrink-0">
				{activeProjectId && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => setInspectorOpen(!isInspectorOpen)}
						className={cn(
							isInspectorOpen ? "text-primary" : "text-muted-foreground",
						)}
					>
						{isInspectorOpen ? (
							<PanelRightClose className="w-5 h-5" />
						) : (
							<PanelRight className="w-5 h-5" />
						)}
					</Button>
				)}
			</div>
		</header>
	);
};
