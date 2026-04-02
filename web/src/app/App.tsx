import { Outlet, useNavigate } from "@tanstack/react-router";
import ky from "ky";
import type React from "react";
import { useEffect } from "react";
import type { Project } from "../shared/types/schema";

const App: React.FC = () => {
	const navigate = useNavigate();

	useEffect(() => {
		console.info("[App] Tiny-ReadRead Frontend Initialized.");

		// If it's the only project available, we seamlessly route the user straight into it.
		ky.get("/api/projects")
			.json<Project[]>()
			.then((projects) => {
				if (projects.length === 1) {
					navigate({
						to: "/project/$projectId",
						params: { projectId: String(projects[0].id) },
					});
				}
			})
			.catch((err) => {
				console.error("[App] Initial project fetch failed", err);
			});
	}, [navigate]);

	return (
		<div className="min-h-screen bg-background selection:bg-primary/10">
			<Outlet />
		</div>
	);
};

export default App;
