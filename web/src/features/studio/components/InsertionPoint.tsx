import { Plus } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useInsertBlockMutation } from "../../../shared/hooks/useMutations";
import { StudioBlockEditor } from "./StudioBlockEditor";

interface InsertionPointProps {
	projectId: string;
	afterOrderIndex: number;
}

export const InsertionPoint: React.FC<InsertionPointProps> = ({
	projectId,
	afterOrderIndex,
}) => {
	const [isActive, setIsActive] = useState(false);
	const [text, setText] = useState("");

	const { mutate: insertBlock, isPending } = useInsertBlockMutation();

	const handleInsertText = () => {
		if (!text.trim()) return;
		// The backend /import route handles '#' detection automatically
		insertBlock(
			{ text, projectId, afterOrderIndex, role: "paragraph" },
			{
				onSuccess: () => {
					setText("");
					setIsActive(false);
				},
			},
		);
	};

	if (isActive) {
		return (
			<div className="mx-auto max-w-3xl w-full px-6 py-4 animate-in fade-in slide-in-from-top-2">
				<StudioBlockEditor
					text={text}
					onChange={setText}
					onSave={handleInsertText}
					onCancel={() => setIsActive(false)}
					isPending={isPending}
					placeholder="Insert thoughts here... (Use '#' for headings)"
					saveLabel="Insert Block"
				/>
			</div>
		);
	}

	return (
		<button
			type="button"
			className="group relative h-8 w-full flex items-center justify-center cursor-pointer border-none bg-transparent"
			onClick={() => setIsActive(true)}
		>
			<div className="absolute inset-x-0 h-full" />
			<div className="absolute inset-x-0 h-[1px] bg-primary/0 group-hover:bg-primary/20 transition-colors" />
			<div className="z-10 bg-background border border-border rounded-full p-1 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all hover:bg-primary hover:text-primary-foreground shadow-sm flex items-center gap-2 pr-3">
				<Plus className="w-3 h-3" strokeWidth={3} />
				<span className="text-[9px] font-black uppercase tracking-tighter">
					Add Block
				</span>
			</div>
		</button>
	);
};
