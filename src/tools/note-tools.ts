import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Props, NoteMetadata, NoteSidecarData } from "../types.js";
import { extractTags, extractLinks, generateTitle, createCustomMetadata } from "../utils/metadata.js";

export function registerNoteTools(server: McpServer, props: Props, env: any) {
	// Create note tool
	server.tool(
		"create_note",
		"Save a new note with rich metadata. Creates searchable content with automatic tag extraction, word counts, and metadata organization. Best for: capturing meeting notes, ideas, tasks, project documentation.",
		{
			text: z.string().describe("The main content of your note (required)"),
			title: z.string()
				.optional()
				.describe("Optional title for the note (auto-generated from content if not provided)"),
			note_type: z.enum(["meeting", "idea", "task", "diary", "code", "other"])
				.default("other")
				.describe("Type of note for better organization and filtering"),
		},
		async ({ text, title, note_type }) => {
			const user = props.email;
			const id = crypto.randomUUID();
			const timestamp = new Date();
			
			// Rich metadata structure
			const metadata: NoteMetadata = {
				id: id,
				created_at: timestamp.toISOString(),
				created_timestamp: timestamp.getTime(),
				title: title || generateTitle(text, note_type),
				note_type: note_type || "other",
				author: user,
				char_count: text.length,
				word_count: text.split(/\s+/).filter(word => word.length > 0).length,
				version: 1,
			};
			
			// Create context for AutoRAG AI guidance (as plain text, not JSON)
			const context = `${metadata.note_type} note by ${metadata.author}: ${metadata.title}. Created: ${metadata.created_at}.`;
			
			// Store main note content with AutoRAG-compatible metadata
			const customMetadata = createCustomMetadata({
				...metadata,
				context: context // AutoRAG context field
			});
			
			await env.NOTES.put(`${user}/${id}.md`, text, { 
				httpMetadata: {
					contentType: 'text/markdown',
				},
				customMetadata: customMetadata
			});
			
			// Store metadata sidecar for rich querying
			const sidecarData: NoteSidecarData = {
				...metadata,
				content_preview: text.slice(0, 200),
				tags: extractTags(text),
				links: extractLinks(text),
			};
			
			await env.NOTES.put(`${user}/.metadata/${id}.json`, JSON.stringify(sidecarData, null, 2), {
				httpMetadata: {
					contentType: 'application/json',
				},
			});
			
			return {
				content: [{
					type: "text",
					text: JSON.stringify({ 
						id, 
						metadata,
						storage: {
							note: `${user}/${id}.md`,
							sidecar: `${user}/.metadata/${id}.json`
						}
					}, null, 2),
				}],
			};
		},
	);

	// Delete note tool
	server.tool(
		"delete_note",
		"Delete a note permanently by UUID. This removes both the main note file and its metadata sidecar. WARNING: This action cannot be undone!",
		{
			note_id: z.string()
				.uuid()
				.describe("The UUID of the note to delete (must be exact UUID format)"),
		},
		async ({ note_id }) => {
			const user = props.email;
			
			try {
				// Define the paths for both files
				const notePath = `${user}/${note_id}.md`;
				const metadataPath = `${user}/.metadata/${note_id}.json`;
				
				// Check if the note exists before attempting deletion
				const noteExists = await env.NOTES.head(notePath);
				if (!noteExists) {
					return {
						content: [{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: "Note not found",
								note_id: note_id,
								user_folder: `${user}/`,
								message: `No note found with ID: ${note_id}`
							}, null, 2)
						}]
					};
				}
				
				// Get note metadata before deletion for confirmation
				let noteTitle = "Unknown";
				try {
					const metadata = await env.NOTES.get(metadataPath);
					if (metadata) {
						const metadataJson = await metadata.json();
						noteTitle = metadataJson.title || "Unknown";
					}
				} catch (error) {
					// Continue with deletion even if metadata is missing
					console.warn(`Could not retrieve metadata for note ${note_id}:`, error);
				}
				
				// Delete both files
				const deletePromises = [
					env.NOTES.delete(notePath),
					env.NOTES.delete(metadataPath)
				];
				
				await Promise.all(deletePromises);
				
				return {
					content: [{
						type: "text",
						text: JSON.stringify({
							success: true,
							deleted_note: {
								id: note_id,
								title: noteTitle,
								user: user
							},
							files_deleted: [
								notePath,
								metadataPath
							],
							message: `Successfully deleted note: "${noteTitle}" (${note_id})`
						}, null, 2)
					}]
				};
				
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error(`Error deleting note ${note_id}:`, errorMessage);
				
				return {
					content: [{
						type: "text",
						text: JSON.stringify({
							success: false,
							error: "Deletion failed",
							note_id: note_id,
							error_details: errorMessage,
							message: `Failed to delete note ${note_id}: ${errorMessage}`
						}, null, 2)
					}]
				};
			}
		},
	);
} 