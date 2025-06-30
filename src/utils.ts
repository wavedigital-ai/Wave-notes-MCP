/**
 * Constructs an authorization URL for an upstream service.
 *
 * @param {Object} options
 * @param {string} options.upstream_url - The base URL of the upstream service.
 * @param {string} options.client_id - The client ID of the application.
 * @param {string} options.redirect_uri - The redirect URI of the application.
 * @param {string} [options.state] - The state parameter.
 * @param {string} [options.hosted_domain] - The hosted domain parameter.
 *
 * @returns {string} The authorization URL.
 */
export function getUpstreamAuthorizeUrl({
	upstreamUrl,
	clientId,
	scope,
	redirectUri,
	state,
	hostedDomain,
}: {
	upstreamUrl: string;
	clientId: string;
	scope: string;
	redirectUri: string;
	state?: string;
	hostedDomain?: string;
}) {
	const params = new URLSearchParams({
		client_id: clientId,
		response_type: "code",
		redirect_uri: redirectUri,
		scope,
	});

	if (state) {
		params.append("state", state);
	}

	if (hostedDomain) {
		params.append("hd", hostedDomain);
	}

	return `${upstreamUrl}?${params.toString()}`;
}

/**
 * Fetches an authorization token from an upstream service.
 *
 * @param {Object} options
 * @param {string} options.client_id - The client ID of the application.
 * @param {string} options.client_secret - The client secret of the application.
 * @param {string} options.code - The authorization code.
 * @param {string} options.redirect_uri - The redirect URI of the application.
 * @param {string} options.upstream_url - The token endpoint URL of the upstream service.
 * @param {string} options.grant_type - The grant type.
 *
 * @returns {Promise<[string, null] | [null, Response]>} A promise that resolves to an array containing the access token or an error response.
 */
export async function fetchUpstreamAuthToken({
	clientId,
	clientSecret,
	code,
	redirectUri,
	upstreamUrl,
	grantType,
}: {
	code: string | undefined;
	upstreamUrl: string;
	clientSecret: string;
	redirectUri: string;
	clientId: string;
	grantType: string;
}): Promise<[string, null] | [null, Response]> {
	if (!code) {
		return [null, new Response("Missing code", { status: 400 })];
	}

	const resp = await fetch(upstreamUrl, {
		body: new URLSearchParams({
			clientId,
			clientSecret,
			code,
			grantType,
			redirectUri,
		}).toString(),
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		method: "POST",
	});
	if (!resp.ok) {
		console.log(await resp.text());
		return [null, new Response("Failed to fetch access token", { status: 500 })];
	}
	const respData = await resp.json() as { access_token: string };
	return [respData.access_token, null];
}

/**
 * User path utilities for consistent R2 storage organization
 */
export const UserPaths = {
	/**
	 * Get the user's email from props
	 */
	getUser: (props: { email: string }) => props.email,
	
	/**
	 * Get the user's root folder path
	 */
	getUserFolder: (user: string) => `${user}/`,
	
	/**
	 * Get the user's metadata folder path
	 */
	getMetadataFolder: (user: string) => `${user}/.metadata/`,
	
	/**
	 * Get the full path for a note file
	 */
	getNotePath: (user: string, noteId: string) => `${user}/${noteId}.md`,
	
	/**
	 * Get the full path for a note's metadata sidecar
	 */
	getMetadataPath: (user: string, noteId: string) => `${user}/.metadata/${noteId}.json`,
};

