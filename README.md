# AutoRAG Notes MCP Server

A Model Context Protocol (MCP) server that provides intelligent note-taking capabilities with AI-powered search, image generation, and Google OAuth authentication. Built on Cloudflare Workers with R2 storage.

## 🚀 Features

- **📝 Smart Note Management**: Create, search, and organize notes with metadata
- **🔍 AI-Powered Search**: Semantic search across your notes using vector embeddings
- **🎨 Image Generation**: Generate images using Cloudflare's AI models (Flux-1-Schnell)
- **🔒 Google OAuth**: Secure authentication with Google Workspace domain restriction
- **☁️ Cloud Storage**: Notes stored in Cloudflare R2 with automatic organization
- **🔄 Real-time Sync**: Server-sent events for live updates

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Claude AI     │───▶│  AutoRAG Notes   │───▶│  Cloudflare R2  │
│                 │    │   MCP Server     │    │   (Storage)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Google OAuth    │
                       │  Authentication  │
                       └──────────────────┘
```

## 📋 Prerequisites

- **Cloudflare Account** with Workers and R2 enabled
- **Google Cloud Console** project with OAuth 2.0 credentials
- **Claude AI** account for MCP integration
- **Node.js** 18+ and npm for local development

## ⚙️ Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd autorag-notes-mcp
npm install
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google+ API** and **OAuth 2.0**
4. Create **OAuth 2.0 Client ID** credentials:
   - **Application type**: Web application
   - **Authorized redirect URIs**: 
     - `https://your-worker-domain.workers.dev/callback`
     - `https://your-custom-domain.com/callback` (if using custom domain)
5. Note your **Client ID** and **Client Secret**

### 3. Set Environment Variables

Configure the following secrets in Cloudflare Workers:

```bash
# Google OAuth Configuration
wrangler secret put GOOGLE_CLIENT_ID
# Enter your Google OAuth Client ID

wrangler secret put GOOGLE_CLIENT_SECRET
# Enter your Google OAuth Client Secret

wrangler secret put GOOGLE_HOSTED_DOMAIN
# Enter your domain (e.g., wavedigital.ai) to restrict access

# Cookie Encryption
wrangler secret put COOKIE_ENCRYPTION_KEY
# Enter a strong random key for cookie encryption
```

### 4. Configure Cloudflare Resources

Update `wrangler.toml` with your Cloudflare account details:

```toml
[[kv_namespaces]]
binding = "OAUTH_KV"
id = "your-kv-namespace-id"

[[r2_buckets]]
binding = "NOTES"
bucket_name = "your-r2-bucket-name"

[ai]
binding = "AI"
```

### 5. Deploy to Cloudflare Workers

```bash
npm run deploy
```

### 6. Configure Custom Domain (Optional)

1. In Cloudflare Dashboard: **Workers & Pages** → **autorag-notes-mcp**
2. Go to **Settings** → **Triggers** → **Custom Domains**
3. Add your custom domain (e.g., `notes.yourdomain.com`)
4. Update Google OAuth redirect URIs to include your custom domain

## 🔧 Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret | `GOCSPX-abcdefghijklmnopqrstuv` |
| `GOOGLE_HOSTED_DOMAIN` | Restrict access to specific domain | `wavedigital.ai` |
| `COOKIE_ENCRYPTION_KEY` | Key for encrypting OAuth cookies | `your-random-256-bit-key` |

## 📱 Usage

### Connect to Claude

1. Open Claude AI
2. Go to **Settings** → **Feature Preview** → **Model Context Protocol**
3. Add new MCP server:
   - **Name**: AutoRAG Notes
   - **URL**: `https://your-domain.com/sse`
4. Authenticate with your Google account

### Available Tools

#### 📝 Note Management
- `createNote`: Create a new note with title and content
- `searchNotes`: Search through all your notes
- `searchNotesByDate`: Find notes within a date range

#### 🎨 Image Generation
- `generateImage`: Generate images using AI (Flux-1-Schnell model)

#### 🐛 Debug Tools
- `debugStorage`: View R2 storage information
- `debugProps`: View your authentication properties

### Example Commands

```
# Create a note
"Create a note about my meeting with the product team"

# Search notes
"Search my notes for anything about 'product roadmap'"

# Generate an image
"Generate an image of a futuristic city at sunset"

# Search by date
"Find all notes I created last week"
```

## 📁 File Structure

```
autorag-notes-mcp/
├── src/
│   ├── index.ts              # Main MCP server class
│   ├── google-handler.ts     # Google OAuth handler
│   ├── utils.ts              # OAuth utilities
│   ├── types.ts              # TypeScript types
│   ├── workers-oauth-utils.ts # OAuth UI utilities
│   └── tools/
│       ├── note-tools.ts     # Note management tools
│       ├── search-tools.ts   # Search functionality
│       ├── image-tools.ts    # AI image generation
│       └── debug-tools.ts    # Debug utilities
├── wrangler.toml             # Cloudflare Workers config
├── worker-configuration.d.ts # Environment types
└── package.json              # Dependencies
```

## 🔒 Security Features

- **Domain Restriction**: Only users from specified Google Workspace domain can access
- **OAuth 2.0**: Secure authentication flow with Google
- **Cookie Encryption**: Signed cookies for session management
- **User Isolation**: Each user's notes are stored in separate R2 folders
- **HTTPS Only**: All communications encrypted in transit

## 🧪 Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Deploy to Cloudflare
npm run deploy

# View logs
wrangler tail
```

## 📊 Storage Structure

Notes are organized in R2 storage by user email:

```
R2 Bucket/
├── user1@yourdomain.com/
│   ├── note-uuid-1.md
│   ├── note-uuid-2.md
│   └── .metadata/
│       ├── note-uuid-1.json
│       └── note-uuid-2.json
└── user2@yourdomain.com/
    ├── note-uuid-3.md
    └── .metadata/
        └── note-uuid-3.json
```

## 🔧 Troubleshooting

### Common Issues

1. **OAuth Fails**: Check redirect URIs match exactly in Google Console
2. **Permission Denied**: Verify `GOOGLE_HOSTED_DOMAIN` is set correctly
3. **Notes Not Saving**: Check R2 bucket permissions and binding
4. **Custom Domain Issues**: Ensure DNS is properly configured

### Debug Commands

```bash
# View deployment logs
wrangler tail

# Check environment variables
wrangler secret list

# Test OAuth endpoints
curl https://your-domain.com/authorize?client_id=test
```

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue in this repository
- Check Cloudflare Workers documentation
- Review Google OAuth 2.0 documentation
