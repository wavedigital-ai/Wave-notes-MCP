// Props from OAuth authentication
export type Props = {
	login: string;
	name: string;
	email: string;
	accessToken: string;
};

// AutoRAG API Response Types (based on Cloudflare docs)
export interface AutoRAGSearchResponse {
	object: "vector_store.search_results.page";
	search_query: string;
	data: AutoRAGSearchResult[];
}

export interface AutoRAGAISearchResponse {
	object: "vector_store.search_results.page";
	search_query: string;
	response: string;
	data: AutoRAGSearchResult[];
}

export interface AutoRAGSearchResult {
	filename?: string;
	content?: string;
	score?: number;
	metadata?: Record<string, string>;
	[key: string]: any;
}

// Note Metadata Types
export interface NoteMetadata {
	id: string;
	created_at: string;
	created_timestamp: number;
	title: string;
	note_type: "meeting" | "idea" | "task" | "diary" | "code" | "other";
	author: string;
	char_count: number;
	word_count: number;
	version: number;
}

export interface NoteSidecarData extends NoteMetadata {
	content_preview: string;
	tags: string[];
	links: string[];
}

// AutoRAG Filter Types
export interface AutoRAGFilter {
	type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "and" | "or";
	key?: string;
	value?: string | number;
	filters?: AutoRAGFilter[];
}

// Search Parameters
export interface SearchParams {
	query: string;
	max_num_results?: number;
	rewrite_query?: boolean;
	ranking_options?: {
		score_threshold?: number;
	};
	filters?: AutoRAGFilter;
}

// AI Search Parameters (no model parameter - it's configured at instance level)
export interface AISearchParams {
	query: string;
	max_num_results?: number;
	rewrite_query?: boolean;
	ranking_options?: {
		score_threshold?: number;
	};
	filters?: AutoRAGFilter;
} 