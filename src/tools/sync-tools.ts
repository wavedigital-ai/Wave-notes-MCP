import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Props } from "../types.js";

/**
 * AutoRAG Sync Response Type
 */
interface AutoRAGSyncResponse {
	result: unknown;
	success: boolean;
	errors?: Array<{
		code: number;
		message: string;
	}>;
}

/**
 * Trigger AutoRAG sync to scan data source for changes and queue updated files for indexing
 */
export function registerSyncTools(server: McpServer, props: Props, env: any) {
	server.tool(
		"sync_autorag",
		"Manually trigger AutoRAG sync to scan the data source (R2 bucket) for changes and queue updated or previously errored files for indexing. This is useful after uploading new notes or when search results seem outdated.",
		{
			force: z.boolean().optional().describe("Force a full resync even if no changes detected (default: false)"),
		},
		async ({ force = false }) => {
			try {
				// Check if required environment variables are configured
				if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN || !env.AUTORAG_ID) {
					return {
						content: [{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: "Missing required environment variables",
								message: "AutoRAG sync requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and AUTORAG_ID to be configured.",
								configuration_guide: {
									required_env_vars: [
										"CLOUDFLARE_ACCOUNT_ID - Your Cloudflare account ID",
										"CLOUDFLARE_API_TOKEN - API token with 'AutoRAG Write' permission",
										"AUTORAG_ID - Your AutoRAG instance ID (max 32 chars, min 1 char)"
									],
									instructions: [
										"1. Go to Cloudflare Dashboard → AI → AutoRAG",
										"2. Copy your AutoRAG ID from the URL or settings",
										"3. Create an API token with 'AutoRAG Write' permission",
										"4. Add these to your Worker environment variables"
									]
								}
							}, null, 2),
						}],
					};
				}

				// Construct the sync API URL
				const syncUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/autorag/rags/${env.AUTORAG_ID}/sync`;

				console.log(`Triggering AutoRAG sync for account ${env.CLOUDFLARE_ACCOUNT_ID}, RAG ID: ${env.AUTORAG_ID}${force ? ' (forced)' : ''}`);

				// Make the PATCH request to trigger sync
				const response = await fetch(syncUrl, {
					method: 'PATCH',
					headers: {
						'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
						'Content-Type': 'application/json',
					},
					// Add force parameter if specified (check AutoRAG API docs for exact parameter name)
					...(force && { 
						body: JSON.stringify({ force: true }) 
					})
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error('AutoRAG sync failed:', {
						status: response.status,
						statusText: response.statusText,
						body: errorText
					});

					return {
						content: [{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: "AutoRAG sync request failed",
								details: {
									status: response.status,
									statusText: response.statusText,
									body: errorText,
									url: syncUrl
								},
								troubleshooting: {
									common_issues: [
										"Invalid API token - ensure it has 'AutoRAG Write' permission",
										"Wrong Account ID - verify from Cloudflare dashboard",
										"Invalid AutoRAG ID - check your AutoRAG instance settings",
										"Network connectivity issues"
									],
									next_steps: [
										"Verify environment variables are correct",
										"Check API token permissions in Cloudflare dashboard",
										"Confirm AutoRAG instance is active and accessible"
									]
								}
							}, null, 2),
						}],
					};
				}

				// Parse the response
				const syncResult: AutoRAGSyncResponse = await response.json();

				console.log('AutoRAG sync response:', syncResult);

				if (syncResult.success) {
					return {
						content: [{
							type: "text",
							text: JSON.stringify({
								success: true,
								message: "AutoRAG sync triggered successfully",
								details: {
									account_id: env.CLOUDFLARE_ACCOUNT_ID,
									autorag_id: env.AUTORAG_ID,
									forced: force,
									timestamp: new Date().toISOString(),
									result: syncResult.result
								},
								next_steps: [
									"Sync process has been queued and will run in the background",
									"Changes and new files will be indexed automatically",
									"Search results should reflect updates within a few minutes",
									"Monitor your AutoRAG dashboard for sync status"
								]
							}, null, 2),
						}],
					};
				} else {
					return {
						content: [{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: "AutoRAG sync failed",
								details: {
									result: syncResult.result,
									errors: syncResult.errors,
									account_id: env.CLOUDFLARE_ACCOUNT_ID,
									autorag_id: env.AUTORAG_ID
								},
								message: "The sync request was accepted but AutoRAG reported errors"
							}, null, 2),
						}],
					};
				}

			} catch (error) {
				console.error('AutoRAG sync error:', error);
				
				return {
					content: [{
						type: "text",
						text: JSON.stringify({
							success: false,
							error: "Sync operation failed",
							message: error instanceof Error ? error.message : String(error),
							details: {
								error_type: error instanceof Error ? error.constructor.name : typeof error,
								stack: error instanceof Error ? error.stack : undefined
							},
							troubleshooting: {
								common_causes: [
									"Network connectivity issues",
									"Invalid API credentials",
									"AutoRAG service temporarily unavailable",
									"Malformed request parameters"
								],
								suggestions: [
									"Check your internet connection",
									"Verify environment variables are set correctly",
									"Try again in a few minutes",
									"Check Cloudflare status page for service issues"
								]
							}
						}, null, 2),
					}],
				};
			}
		}
	);
} 