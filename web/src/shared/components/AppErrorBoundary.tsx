import { AlertCircle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	name: string;
	fallback?: ReactNode;
}
interface State {
	hasError: boolean;
	error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
	public state: State = { hasError: false, error: null };
	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}
	public componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
		console.error("ErrorBoundary", `Crash in [${this.props.name}]`, {
			message: error.message,
		});
	}
	private handleReset = () => {
		this.setState({ hasError: false, error: null });
	};
	public render() {
		if (this.state.hasError) {
			if (this.props.fallback) return this.props.fallback;
			return (
				<div className="flex flex-col items-center justify-center p-6 text-center h-full bg-destructive/5 rounded-lg">
					<AlertCircle className="w-8 h-8 text-destructive mb-3" />
					<h3 className="text-sm font-bold uppercase">
						Feature Error: {this.props.name}
					</h3>
					<button
						type="button"
						onClick={this.handleReset}
						className="mt-4 bg-secondary px-4 py-1.5 rounded text-xs"
					>
						RECOVERY
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}
