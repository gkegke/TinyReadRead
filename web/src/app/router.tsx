import {
	createRootRoute,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { AlertTriangle, LayoutTemplate, RotateCcw } from "lucide-react";
import { StudioPage } from "../features/studio/pages/StudioPage";
import { MainLayout } from "../shared/components/layouts/MainLayout";
import App from "./App";

const GlobalErrorFallback = ({
	error,
	reset,
}: {
	error: Error;
	reset: () => void;
}) => (
	<div className="h-screen flex flex-col items-center justify-center p-12 text-center bg-destructive/[0.02]">
		<AlertTriangle className="w-12 h-12 text-destructive mb-6" />
		<h2 className="text-lg font-black uppercase tracking-widest mb-2">
			Application Crash
		</h2>
		<pre className="text-[10px] font-mono p-4 bg-secondary rounded-lg mb-6 max-w-md overflow-auto border">
			{error.message || "Unknown Runtime Error"}
		</pre>
		<button
			type="button"
			onClick={() => reset()}
			className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-full text-xs font-bold"
		>
			<RotateCcw className="w-4 h-4" />
			Attempt Recovery
		</button>
	</div>
);

const rootRoute = createRootRoute({
	component: App,
	errorComponent: GlobalErrorFallback,
});

export const mainLayoutRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "main",
	component: MainLayout,
});

export const indexRoute = createRoute({
	getParentRoute: () => mainLayoutRoute,
	path: "/",
	component: () => (
		<div className="h-full flex flex-col items-center justify-center p-12 text-center">
			<div className="w-20 h-20 rounded-full bg-secondary/30 flex items-center justify-center mb-6">
				<LayoutTemplate className="w-10 h-10 text-muted-foreground/40" />
			</div>
			<h2 className="text-lg font-black uppercase tracking-widest mb-2">
				No Project Selected
			</h2>
			<p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
				Select a project from the library or create a new session to begin
				synthesizing.
			</p>
		</div>
	),
});

export const projectRoute = createRoute({
	getParentRoute: () => mainLayoutRoute,
	path: "/project/$projectId",
	component: StudioPage,
});

const routeTree = rootRoute.addChildren([
	mainLayoutRoute.addChildren([indexRoute, projectRoute]),
]);

export const router = createRouter({
	routeTree,
	defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
