import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Props } from "../types.js";

export function registerImageTools(server: McpServer, props: Props, env: any) {
	// Add image generation tool - user access is already validated via OAuth
	server.tool(
		"generateImage",
		"Generate an image using the `flux-1-schnell` model. Works best with 8 steps.",
		{
			prompt: z
				.string()
				.describe("A text description of the image you want to generate."),
			steps: z
				.number()
				.min(4)
				.max(8)
				.default(8)
				.describe("The number of inference steps. More steps often mean higher quality, but slower generation."),
		},
		async ({ prompt, steps }) => {
			const inputs = {
				prompt,
				num_inference_steps: steps,
			};

			const response = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", inputs);

			// Return the generated image in the proper MCP format
			return {
				content: [
					{
						type: "image" as const,
						data: response.image,
						mimeType: "image/jpeg",
					},
					{
						type: "text" as const,
						text: `Generated image with prompt: "${prompt}" using ${steps} steps`,
					},
				],
			};
		},
	);
} 