import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { GoogleHandler } from "./google-handler";
import type { Props } from "./types.js";
import { registerNoteTools } from "./tools/note-tools.js";
import { registerSearchTools } from "./tools/search-tools.js";
import { registerDebugTools } from "./tools/debug-tools.js";

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "AutoRAG Notes MCP",
		version: "1.0.0",
	});

	async init() {
		// Register all tool categories
		registerNoteTools(this.server, this.props, this.env);
		registerSearchTools(this.server, this.props, this.env);
		registerDebugTools(this.server, this.props, this.env);
	}
}

export default new OAuthProvider({
	apiHandler: MyMCP.mount("/sse") as any,
	apiRoute: "/sse",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: GoogleHandler as any,
	tokenEndpoint: "/token",
});
