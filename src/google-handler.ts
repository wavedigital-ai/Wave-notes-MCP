import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { type Context, Hono } from "hono";
import { fetchUpstreamAuthToken, getUpstreamAuthorizeUrl } from "./utils";
import type { Props } from "./types";
import {
	clientIdAlreadyApproved,
	parseRedirectApproval,
	renderApprovalDialog,
} from "./workers-oauth-utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

app.get("/authorize", async (c) => {
	const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
	const { clientId } = oauthReqInfo;
	if (!clientId) {
		return c.text("Invalid request", 400);
	}

	if (
		await clientIdAlreadyApproved(c.req.raw, oauthReqInfo.clientId, c.env.COOKIE_ENCRYPTION_KEY)
	) {
		return redirectToGoogle(c, oauthReqInfo);
	}

	return renderApprovalDialog(c.req.raw, {
		client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
		server: {
			description: "AutoRAG Notes MCP Server using Google for authentication.",
			logo: "https://developers.google.com/identity/images/g-logo.png",
			name: "AutoRAG Notes MCP Server",
		},
		state: { oauthReqInfo },
	});
});

app.post("/authorize", async (c) => {
	const { state, headers } = await parseRedirectApproval(c.req.raw, c.env.COOKIE_ENCRYPTION_KEY);
	if (!state.oauthReqInfo) {
		return c.text("Invalid request", 400);
	}

	return redirectToGoogle(c, state.oauthReqInfo, headers);
});

async function redirectToGoogle(
	c: Context,
	oauthReqInfo: AuthRequest,
	headers: Record<string, string> = {},
) {
	// Build the Google OAuth URL with hosted domain restriction
	const authParams = {
		upstreamUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		clientId: c.env.GOOGLE_CLIENT_ID,
		redirectUri: new URL("/callback", c.req.raw.url).href,
		scope: "email profile openid",
		state: btoa(JSON.stringify(oauthReqInfo)),
		...(c.env.GOOGLE_HOSTED_DOMAIN && { hostedDomain: c.env.GOOGLE_HOSTED_DOMAIN }),
	};

	return new Response(null, {
		headers: {
			...headers,
			location: getUpstreamAuthorizeUrl(authParams),
		},
		status: 302,
	});
}

/**
 * OAuth Callback Endpoint for Google
 */
app.get("/callback", async (c) => {
	// Get and decode state parameter
	const rawState = c.req.query("state");
	if (!rawState) {
		return c.text("Missing state parameter", 400);
	}

	let oauthReqInfo: AuthRequest;
	try {
		const decodedState = decodeURIComponent(rawState);
		oauthReqInfo = JSON.parse(atob(decodedState)) as AuthRequest;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("Failed to decode state parameter:", { 
			rawState, 
			error: errorMessage,
			url: c.req.url 
		});
		
		try {
			oauthReqInfo = JSON.parse(atob(rawState)) as AuthRequest;
		} catch (fallbackError) {
			const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
			console.error("Fallback decoding also failed:", fallbackMessage);
			return c.text(`Invalid state parameter: ${errorMessage}`, 400);
		}
	}

	if (!oauthReqInfo.clientId) {
		return c.text("Invalid state", 400);
	}

	// Exchange the code for an access token
	const code = c.req.query("code");
	if (!code) {
		return c.text("Missing authorization code", 400);
	}

	const [accessToken, errResponse] = await fetchUpstreamAuthToken({
		code,
		upstreamUrl: "https://oauth2.googleapis.com/token",
		clientSecret: c.env.GOOGLE_CLIENT_SECRET,
		redirectUri: new URL("/callback", c.req.url).href,
		clientId: c.env.GOOGLE_CLIENT_ID,
		grantType: "authorization_code",
	});

	if (errResponse) return errResponse;

	// Fetch user info from Google
	const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!userInfoResponse.ok) {
		console.error("Failed to fetch user info:", await userInfoResponse.text());
		return c.text("Failed to fetch user information", 500);
	}

	const userInfo = await userInfoResponse.json() as {
		id: string;
		email: string;
		name: string;
		hd?: string; // hosted domain
	};

	const { id, email, name, hd } = userInfo;

	// Verify hosted domain if configured (extra security check)
	if (c.env.GOOGLE_HOSTED_DOMAIN && (!hd || hd !== c.env.GOOGLE_HOSTED_DOMAIN)) {
		return new Response(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Access Denied</title>
				<style>
					body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
					.error { color: #d32f2f; }
					.user-info { color: #666; margin-top: 20px; }
				</style>
			</head>
			<body>
				<h1 class="error">Access Denied</h1>
				<p>Sorry, you must use an account from the ${c.env.GOOGLE_HOSTED_DOMAIN} domain.</p>
				<p class="user-info">You authenticated as: <strong>${email}</strong></p>
				<p>Please sign in with the correct domain account.</p>
			</body>
			</html>
		`, {
			status: 403,
			headers: { "Content-Type": "text/html" }
		});
	}

	// Return back to the MCP client a new token
	const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
		metadata: {
			label: name,
		},
		props: {
			login: email, // Use email as login for folder naming
			accessToken,
			email,
			name,
		} as Props,
		request: oauthReqInfo,
		scope: oauthReqInfo.scope,
		userId: id,
	});

	return Response.redirect(redirectTo);
});

export { app as GoogleHandler };