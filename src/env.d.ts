interface Env {
	OAUTH_KV: KVNamespace;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	COOKIE_ENCRYPTION_KEY: string;
	MCP_OBJECT: DurableObjectNamespace<import("./index").MyMCP>;
	AI: Ai;
	NOTES: R2Bucket;
}