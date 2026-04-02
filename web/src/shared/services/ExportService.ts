class ExportService {
	async exportProjectAudio(
		projectId: string,
		chapterIds?: string[],
	): Promise<void> {
		console.info(
			"Export",
			`Requesting server-side bundle for project ${projectId}`,
		);

		let downloadUrl = `/api/projects/${projectId}/export`;
		if (chapterIds && chapterIds.length > 0) {
			downloadUrl += `?chapter_ids=${chapterIds.join(",")}`;
		}
		window.location.href = downloadUrl;
	}
}

export const exportService = new ExportService();
