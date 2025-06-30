/**
 * Extract hashtags from text content
 */
export function extractTags(text: string): string[] {
	const tagPattern = /#(\w+)/g;
	const matches = text.match(tagPattern) || [];
	return [...new Set(matches.map(tag => tag.slice(1).toLowerCase()))];
}

/**
 * Extract URLs from text content
 */
export function extractLinks(text: string): string[] {
	const urlPattern = /https?:\/\/[^\s]+/g;
	const matches = text.match(urlPattern) || [];
	return [...new Set(matches)];
}

/**
 * Generate a structured title if none provided
 */
export function generateTitle(text: string, noteType?: string): string {
	// Extract first sentence or line as title base
	const firstLine = text.split('\n')[0].trim();
	const firstSentence = text.match(/^[^.!?]+[.!?]?/)?.[0] || firstLine;
	const titleBase = firstSentence.slice(0, 50);
	
	// Add type prefix for better organization
	const typePrefix = {
		meeting: "Meeting Notes",
		idea: "Idea",
		task: "Task",
		diary: "Journal Entry",
		code: "Code Snippet",
		other: "Note"
	}[noteType || "other"];
	
	return `${typePrefix}: ${titleBase}${titleBase.length >= 50 ? '...' : ''}`;
}

/**
 * Create AutoRAG-compatible custom metadata (all values must be strings)
 */
export function createCustomMetadata(metadata: Record<string, any>): Record<string, string> {
	const customMetadata: Record<string, string> = {};
	
	for (const [key, value] of Object.entries(metadata)) {
		if (value !== null && value !== undefined) {
			customMetadata[key] = typeof value === 'string' ? value : String(value);
		}
	}
	
	return customMetadata;
} 