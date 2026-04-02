import { Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { Button } from "../../../shared/components/ui/button";
import { cn } from "../../../shared/lib/utils";

interface StudioBlockEditorProps {
	text: string;
	onChange: (val: string) => void;
	onSave: () => void;
	onCancel: () => void;
	isPending?: boolean;
	placeholder?: string;
	saveLabel?: string;
}

/**
 * [REUSABILITY] Shared block editor for Insertion and In-place Editing.
 * Ensures consistent heading (#) detection and typography.
 */
export const StudioBlockEditor: React.FC<StudioBlockEditorProps> = ({
	text,
	onChange,
	onSave,
	onCancel,
	isPending,
	placeholder = "Type here...",
	saveLabel = "Save Changes",
}) => {
	const isHeading = text.trim().startsWith("#");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// [UX] Standard manual focus to satisfy Biome's A11Y rules
	// while ensuring the user can start typing immediately.
	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	return (
		<div className="bg-secondary/30 rounded-2xl border border-primary/20 p-4 shadow-xl animate-in fade-in zoom-in-95 duration-200">
			<textarea
				ref={textareaRef}
				value={text}
				onChange={(e) => onChange(e.target.value)}
				className={cn(
					"w-full bg-transparent border-none focus:ring-0 resize-none min-h-[100px] p-2 transition-all duration-300",
					isHeading
						? "text-3xl font-black font-sans text-primary leading-tight"
						: "text-2xl font-serif leading-relaxed text-foreground",
				)}
				placeholder={placeholder}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave();
					if (e.key === "Escape") onCancel();
				}}
			/>

			<div className="flex justify-end gap-2 mt-2 pt-3 border-t border-border/50">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onCancel}
					disabled={isPending}
				>
					Cancel
				</Button>
				<Button
					type="button"
					size="sm"
					onClick={onSave}
					disabled={isPending || !text.trim()}
				>
					{isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
					{saveLabel}
				</Button>
			</div>
		</div>
	);
};
