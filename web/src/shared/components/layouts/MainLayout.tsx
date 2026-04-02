import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import ky from "ky";
import {
	FileText,
	HardDrive,
	HelpCircle,
	Loader2,
	Plus,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
	useCreateProjectMutation,
	useDeleteProjectMutation,
} from "../../hooks/useMutations";
import { useProjects } from "../../hooks/useQueries";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../store/useUIStore";
import type { Project, SystemStats } from "../../types/schema";
import { AppErrorBoundary } from "../AppErrorBoundary";
import { GlobalHeader } from "../GlobalHeader";
import { Button } from "../ui/button";

export const MainLayout: React.FC = () => {
	const { projectId } = useParams({ strict: false });
	const { isSidebarOpen, setActiveProject } = useUIStore();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: projects = [], isLoading } = useProjects();
	const { mutateAsync: createProject, isPending: isCreating } =
		useCreateProjectMutation();
	const { mutateAsync: deleteProject } = useDeleteProjectMutation();

	const [stats, setStats] = useState<SystemStats | null>(null);
	const [isDemoLoading, setIsDemoLoading] = useState(false);

	const fetchStats = async () => {
		try {
			const res = await ky.get("/api/system/stats").json<SystemStats>();
			setStats(res);
		} catch (e) {
			console.error("Failed to fetch stats", e);
		}
	};

	useEffect(() => {
		setActiveProject(projectId || null);
		fetchStats();
	}, [projectId, setActiveProject]);

	const handleCreateNew = async () => {
		const newName = `Session ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
		const project = await createProject(newName);
		if (project?.id) {
			navigate({
				to: "/project/$projectId",
				params: { projectId: String(project.id) },
			});
		}
	};

	const handleManualDemo = async () => {
		setIsDemoLoading(true);
		try {
			const project = await ky.post("/api/system/seed-demo").json<Project>();
			queryClient.invalidateQueries({ queryKey: ["projects"] });

			navigate({
				to: "/project/$projectId",
				params: { projectId: String(project.id) },
			});
		} catch (e) {
			console.error("Failed to seed help project", e);
			alert("Could not initialize help project. Check server logs.");
		} finally {
			setIsDemoLoading(false);
		}
	};

	const handleDelete = async (e: React.MouseEvent, targetId: string) => {
		e.preventDefault();
		e.stopPropagation();
		if (!confirm("Delete this project and all its blocks?")) return;

		await deleteProject(targetId);
		if (projectId === targetId) {
			navigate({ to: "/" });
		}
		fetchStats();
	};

	const handlePurge = async () => {
		if (!confirm("Delete ALL generated audio files from the server?")) return;
		await ky.post("/api/system/purge");
		fetchStats();
	};

	return (
		<div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
			<GlobalHeader />

			<div className="flex-1 flex min-h-0 relative overflow-hidden">
				<aside
					className={cn(
						"z-30 h-full flex flex-col bg-secondary/10 border-r transition-all duration-300 overflow-hidden shrink-0",
						isSidebarOpen ? "w-72" : "w-0 border-none",
					)}
				>
					<div className="flex flex-col h-full w-72">
						<div className="p-4 h-12 flex items-center justify-between bg-background/30">
							<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
								Library
							</span>
							<Button
								type="button"
								size="icon"
								variant="ghost"
								className="h-7 w-7"
								onClick={handleCreateNew}
								disabled={isCreating}
							>
								{isCreating ? (
									<Loader2 className="w-3 h-3 animate-spin" />
								) : (
									<Plus className="w-4 h-4" />
								)}
							</Button>
						</div>

						<div className="flex-1 overflow-y-auto p-3 space-y-1">
							{isLoading ? (
								<div className="animate-pulse p-2 space-y-2">
									<div className="h-10 bg-secondary rounded-lg" />
								</div>
							) : projects.length === 0 ? (
								<div className="p-4 text-center opacity-30">
									<p className="text-[9px] font-bold uppercase">No Projects</p>
								</div>
							) : (
								projects.map((p) => (
									<Link
										key={p.id}
										to="/project/$projectId"
										params={{ projectId: String(p.id) }}
										className={`group flex items-center justify-between p-2.5 rounded-xl transition-all border ${projectId === p.id ? "bg-primary/10 border-primary/20 text-primary shadow-sm" : "hover:bg-secondary/50 border-transparent text-foreground/70"}`}
									>
										<div className="flex items-center gap-2.5 min-w-0">
											<FileText className="w-3.5 h-3.5 shrink-0" />
											<span className="text-xs font-bold truncate">
												{p.name}
											</span>
										</div>
										<button
											type="button"
											onClick={(e) => handleDelete(e, p.id)}
											className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive"
										>
											<Trash2 className="w-3 h-3" />
										</button>
									</Link>
								))
							)}

							<Button
								type="button"
								variant="secondary"
								size="sm"
								className="w-full text-[10px] font-black tracking-widest uppercase h-8 mt-2"
								onClick={handleManualDemo}
								disabled={isDemoLoading}
							>
								{isDemoLoading ? (
									<Loader2 className="w-3 h-3 animate-spin mr-2" />
								) : (
									<HelpCircle className="w-3 h-3 mr-2" />
								)}
								Help
							</Button>
						</div>

						<div className="p-4 border-t bg-background/50 space-y-4">
							<div className="space-y-3">
								<div className="flex items-center justify-between text-[9px] font-bold uppercase text-muted-foreground">
									<div className="flex items-center gap-1.5">
										<HardDrive className="w-3 h-3" /> Storage
									</div>
									<span>{stats?.total_size_mb || 0} MB</span>
								</div>
								<div className="flex items-center gap-2">
									<div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
										<div className="h-full bg-primary/40 w-1/3" />
									</div>
									<button
										type="button"
										onClick={handlePurge}
										title="Purge Cache"
										className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
									>
										<Trash2 className="w-3.5 h-3.5" />
									</button>
								</div>
							</div>
						</div>
					</div>
				</aside>

				<main className="flex-1 min-w-0 relative flex flex-col overflow-hidden bg-background">
					<AppErrorBoundary name="MainContent">
						<Outlet />
					</AppErrorBoundary>
				</main>
			</div>
		</div>
	);
};
