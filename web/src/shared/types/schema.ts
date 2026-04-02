import { z } from "zod";

export const ProjectSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	voice_id: z.string().default("Jasper"),
	speed: z.number().default(1.0),
	updated_at: z.coerce.date(),
});

export const ChunkSchema = z.object({
	id: z.string(),
	project_id: z.string(),
	role: z.enum(["heading", "paragraph"]).default("paragraph"),
	text_content: z.string(),
	status: z.enum(["pending", "processing", "generated", "failed"]),
	error_message: z.string().optional().nullable(),
	audio_hash: z.string().optional().nullable(),
	ordinal_index: z.number().default(0),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;

export interface SystemStats {
	file_count: number;
	total_size_bytes: number;
	total_size_mb: number;
}

export interface SystemModel {
	id: string;
	repo: string;
	is_downloaded: boolean;
	status: "idle" | "downloading" | "error";
	error: string | null;
}
