import type { 
	AutoRAGSearchResponse, 
	AutoRAGAISearchResponse, 
	SearchParams, 
	AISearchParams,
	AutoRAGFilter 
} from '../types.js';

/**
 * Create user folder filter for AutoRAG searches with "starts with" behavior
 * Based on Cloudflare AutoRAG multitenancy documentation
 * This ensures users only see their own notes and subfolders
 */
export function createUserFolderFilter(user: string): AutoRAGFilter {
	return {
		type: "and",
		filters: [
			{
				type: "gte",
				key: "folder",
				value: `${user}/`,  // Greater than or equal to user folder
			},
			{
				type: "lt",
				key: "folder", 
				value: `${user}/z`,  // Less than folder + z for upper bound  
			}
		]
	};
}

/**
 * Create advanced metadata filter with user isolation and additional criteria
 * Supports filtering by note type, date ranges, etc.
 */
export function createAdvancedFilter(user: string, options: {
	since_timestamp?: number;
	until_timestamp?: number;
} = {}): AutoRAGFilter {
	const filters: any[] = [
		// User folder isolation (required)
		{
			type: "gte",
			key: "folder",
			value: `${user}/`,
		},
		{
			type: "lt",
			key: "folder",
			value: `${user}/z`,
		}
	];



	// Add timestamp range filters if specified
	if (options.since_timestamp) {
		filters.push({
			type: "gte",
			key: "timestamp",
			value: options.since_timestamp.toString()
		});
	}

	if (options.until_timestamp) {
		filters.push({
			type: "lte", 
			key: "timestamp",
			value: options.until_timestamp.toString()
		});
	}

	return {
		type: "and",
		filters
	};
}

/**
 * Filter out metadata sidecar files from search results
 */
export function filterNoteResults(results: any[]): any[] {
	return results.filter((result: any) => 
		result.filename && 
		!result.filename.includes('/.metadata/')
	);
}

/**
 * Perform AutoRAG search with proper error handling and response parsing
 */
export async function performAutoRAGSearch(
	AI: any, 
	params: SearchParams
): Promise<AutoRAGSearchResponse> {
	const response = await AI.autorag("notes").search(params);
	
	// AutoRAG response format: {object, search_query, data}
	// No 'result' or 'success' wrapper properties
	if (!response || typeof response !== 'object') {
		throw new Error('Invalid AutoRAG response format');
	}
	
	return {
		object: response.object || "vector_store.search_results.page",
		search_query: response.search_query || params.query,
		data: response.data || []
	};
}

/**
 * Perform AutoRAG AI search with proper error handling and response parsing
 */
export async function performAutoRAGAISearch(
	AI: any, 
	params: AISearchParams
): Promise<AutoRAGAISearchResponse> {
	// Don't pass model parameter - it's configured at AutoRAG instance level
	// Don't pass stream parameter - streaming is handled differently
	const response = await AI.autorag("notes").aiSearch(params);
	
	// AutoRAG AI response format: {object, search_query, response, data}
	if (!response || typeof response !== 'object') {
		throw new Error('Invalid AutoRAG AI response format');
	}
	
	return {
		object: response.object || "vector_store.search_results.page",
		search_query: response.search_query || params.query,
		response: response.response || "No relevant information found.",
		data: response.data || []
	};
}

/**
 * Enrich search results with sidecar metadata
 */
export async function enrichResultsWithMetadata(
	results: any[],
	user: string,
	notesStorage: any
): Promise<any[]> {
	return Promise.all(
		results.map(async (result: any) => {
			try {
				const noteId = result.filename?.match(/\/([^/]+)\.md$/)?.[1];
				if (noteId) {
					const sidecarKey = `${user}/.metadata/${noteId}.json`;
					const sidecar = await notesStorage.get(sidecarKey);
					if (sidecar) {
						const sidecarData = JSON.parse(await sidecar.text());
						return {
							...result,
							sidecarMetadata: sidecarData,
						};
					}
				}
			} catch (e) {
				// If sidecar fetch fails, return original result
				console.warn('Failed to fetch sidecar metadata:', e);
			}
			return result;
		})
	);
} 