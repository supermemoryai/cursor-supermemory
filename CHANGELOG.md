# Changelog

## Unreleased

- Sign in with OAuth 2.1 (dynamic client registration and PKCE) instead of a browser-issued API key. Tokens refresh automatically across hooks and the MCP proxy; `logout` revokes them. API keys from the environment, config or an existing credentials file keep working and take precedence.

## 1.2.3

- Use the bundled official Supermemory 5.0.1 SDK for hosted REST profile, search and document capture, preserving existing namespace strings, metadata and incremental generation IDs.
- Retain custom-server v3/v4 compatibility by default, with explicit `apiVersion` / `SUPERMEMORY_API_VERSION` selection and independent MCP routing.
- Render v5 profile facts and validate capture acceptance before advancing the saved cursor. Preserve recall gates, three-second budgets, zero transport retries and dynamic processing.
- Ship reproducible standalone Node 18+ bundles and SDK license attribution. This is the plugin-panel/Git release channel, not an upgrade or publication of the older npm 1.0.0 local-MCP product.
