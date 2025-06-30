import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Props, AutoRAGFilter } from "../types.js";
import { 
	createUserFolderFilter, 
	createAdvancedFilter,
	filterNoteResults, 
	performAutoRAGSearch, 
	performAutoRAGAISearch, 
	enrichResultsWithMetadata 
} from "../utils/autorag.js";

export function registerSearchTools(server: McpServer, props: Props, env: any) {
	// Simple AutoRAG search returning full content
	server.tool(
		"search_notes_simple",
		"Simple semantic search returning full note content. Use when you need complete text and don't need filtering. Best for: finding specific notes by keyword, getting full note details.",
		{
			query: z.string().describe("Search query (e.g., 'deployment checklist', 'AutoRAG setup')"),
			limit: z.number()
				.min(1)
				.max(50)
				.default(10)
				.describe("Maximum number of results to return (default: 10, max: 50)"),
		},
		async ({ query, limit }) => {
			const user = props.email;
			
			try {
				const response = await performAutoRAGSearch(env.AI, {
					query: query,
					max_num_results: Math.min(limit || 10, 50), // Max 50 per API spec
					rewrite_query: true,
					ranking_options: {
						score_threshold: 0.3,
					},
					filters: createUserFolderFilter(user), // Apply user folder filter
				});
				
				console.log('Simple search response:', JSON.stringify(response));
				
				// Filter out metadata sidecar files (AutoRAG should handle user filtering)
				const noteResults = filterNoteResults(response.data);
				
				return {
					content: [{
						type: "text",
						text: JSON.stringify({
							user_folder: `${user}/`,
							search_query: response.search_query,
							total_results: response.data.length,
							filtered_results: noteResults.length,
							results: noteResults,
							debug: {
								applied_filter: createUserFolderFilter(user)
							}
						}, null, 2),
					}],
				};
			} catch (error) {
				return {
					content: [{
						type: "text",
						text: `Search error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
					}],
				};
			}
		},
	);

	// Advanced semantic search with comprehensive metadata filtering
	server.tool(
		"search_notes_advanced",
		"Advanced semantic search with time-based filtering. Use for: finding recent notes, date-based searches, getting condensed results with previews. Returns condensed results with content previews and metadata. Examples: 'Find notes from last 7 days', 'Search recent project updates'",
		{
			query: z.string().describe("Search query about your note content"),
			limit: z.number()
				.min(1)
				.max(50)
				.default(10)
				.describe("Maximum number of results to return (default: 10, max: 50)"),

			since_days: z.number()
				.min(1)
				.optional()
				.describe("Only include notes from the last N days (e.g., 7 for last week, 30 for last month)"),
			until_days: z.number()
				.min(1)
				.optional()
				.describe("Only include notes older than N days ago (e.g., 90 for notes older than 3 months)"),
		},
		async ({ query, limit, since_days, until_days }) => {
			const user = props.email;
			
			try {
				// Calculate timestamp filters if specified
				const now = Date.now();
				const since_timestamp = since_days ? now - (since_days * 24 * 60 * 60 * 1000) : undefined;
				const until_timestamp = until_days ? now - (until_days * 24 * 60 * 60 * 1000) : undefined;
				
				// Create advanced filter with user isolation and time-based criteria
				const filters = createAdvancedFilter(user, {
					since_timestamp,
					until_timestamp
				});
				
				// Debug: log the filters being applied
				console.log('Advanced search filters:', JSON.stringify(filters, null, 2));
				console.log('Filtering options:', { since_days, until_days, since_timestamp, until_timestamp });
				
				const response = await performAutoRAGSearch(env.AI, {
					query: query,
					max_num_results: Math.min(limit || 10, 50), // Max 50 per API spec
					filters: filters,
					rewrite_query: true,
					ranking_options: {
						score_threshold: 0.3,
					},
				});
				
				console.log('Advanced filtered search response:', JSON.stringify(response));
				
				// Filter out metadata sidecar files and enrich with metadata
				const noteResults = filterNoteResults(response.data);
				const enrichedResults = await enrichResultsWithMetadata(noteResults, user, env.NOTES);
				
				return {
					content: [{
						type: "text",
						text: JSON.stringify({
							user_folder: `${user}/`,
							search_query: response.search_query,
							filters_applied: {
								since_days: since_days || "all time",
								until_days: until_days || "all time"
							},
							total_results: enrichedResults.length,
							results: enrichedResults.map((result: any) => {
								
								// Extract content from AutoRAG result based on Cloudflare docs structure
								let contentPreview = "No content available";
								
								// AutoRAG returns content as array: content: [{ id, type, text }]
								if (result.content && Array.isArray(result.content) && result.content.length > 0) {
									const firstChunk = result.content[0];
									if (firstChunk && firstChunk.text && typeof firstChunk.text === 'string') {
										contentPreview = firstChunk.text.slice(0, 300) + (firstChunk.text.length > 300 ? "..." : "");
									}
								}
								// Fallback: check if content is directly a string
								else if (result.content && typeof result.content === 'string') {
									contentPreview = result.content.slice(0, 300) + (result.content.length > 300 ? "..." : "");
								}
								// Additional fallbacks for other possible structures
								else if (result.text && typeof result.text === 'string') {
									contentPreview = result.text.slice(0, 300) + (result.text.length > 300 ? "..." : "");
								}
								
								return {
									filename: result.filename,
									score: result.score,
									metadata: result.metadata, // Use original metadata from AutoRAG
									enriched_metadata: result.enriched_metadata, // Sidecar metadata if available
									content_preview: contentPreview,
								};
							})
						}, null, 2)
					}]
				};
			} catch (error) {
				// Fallback to R2 list if AutoRAG not available
				const listed = await env.NOTES.list({
					prefix: `${user}/`,
					limit: 1000,
				});
				
				const results = [];
				for (const object of listed.objects) {
					const metadata = object.customMetadata || {};
					
					// Simple text search
					const matchesQuery = metadata.title?.toLowerCase().includes(query.toLowerCase());
					
					if (matchesQuery) {
						results.push({
							key: object.key,
							metadata,
							score: 1.0,
						});
					}
				}
				
				return {
					content: [{
						type: "text",
						text: JSON.stringify({
							results: results.slice(0, limit || 10),
							total: results.length,
							fallback: true,
							filters_applied: { since_days, until_days },
							error: error instanceof Error ? error.message : String(error)
						}),
					}],
				};
			}
		},
	);

	// AI-powered search that returns natural language answers with filtering
	server.tool(
		"ai_search_notes",
		"AI-powered search returning natural language answers to questions about your notes. Use when you want an intelligent summary or answer rather than raw note content. Examples: 'What are my pending tasks?', 'Summarize recent meeting decisions', 'What deployment steps were discussed?'",
		{
			query: z.string().describe("Natural language question about your notes (e.g., 'What tasks are due this week?', 'Summarize project updates')"),
			limit: z.number()
				.min(1)
				.max(50)
				.default(5)
				.describe("Number of source chunks to consider for generating the answer (default: 5, max: 50)"),

			since_days: z.number()
				.min(1)
				.optional()
				.describe("Only consider notes from the last N days (e.g., 7 for last week)"),
			until_days: z.number()
				.min(1)
				.optional()
				.describe("Only consider notes older than N days ago (useful for historical analysis)"),
		},
		async ({ query, limit, since_days, until_days }) => {
			const user = props.email;
			
			try {
				// Calculate timestamp filters if specified
				const now = Date.now();
				const since_timestamp = since_days ? now - (since_days * 24 * 60 * 60 * 1000) : undefined;
				const until_timestamp = until_days ? now - (until_days * 24 * 60 * 60 * 1000) : undefined;
				
				// Create advanced filter with user isolation and time-based criteria
				const filters = createAdvancedFilter(user, {
					since_timestamp,
					until_timestamp
				});
				
				const response = await performAutoRAGAISearch(env.AI, {
					query: query,
					// No model parameter - configured at AutoRAG instance level
					rewrite_query: true,
					max_num_results: Math.min(limit || 5, 50),
					ranking_options: {
						score_threshold: 0.3,
					},
					// No stream parameter - streaming handled differently
					filters: filters
				});
				
				console.log('AutoRAG AI search response:', JSON.stringify(response));
				
				// Add context about applied filters to the response
				let responseText = response.response || "No relevant information found in your notes.";
				
				if (since_days || until_days) {
					const filterInfo = [];
					if (since_days) filterInfo.push(`from the last ${since_days} days`);
					if (until_days) filterInfo.push(`older than ${until_days} days`);
					
					responseText += `\n\n*Note: This answer is based on notes filtered by ${filterInfo.join(', ')}.*`;
				}
				
				// Return the natural language response
				return {
					content: [{
						type: "text",
						text: responseText,
					}],
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
				console.error('AutoRAG error:', errorMessage);
				
				return {
					content: [{
						type: "text",
						text: `Search error: ${errorMessage}\n\nNote: AutoRAG may need time to index newly created documents. Try again in a few minutes.`,
					}],
				};
			}
		},
	);


} 