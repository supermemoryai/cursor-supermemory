# Changelog

## 1.2.4

- Restore the catalog's eight local MCP aliases with SDK5 core operations, per-call workspace configuration and key/base routing, unchanged namespace/scope semantics, document-list resource identity and validated destructive outcomes.
- Add explicit `mcpMode` / `SUPERMEMORY_MCP_MODE=local` selection and `mcp-local`; the existing `mcp` default remains the hosted proxy. Catalog 1.1.0 users must explicitly select local mode before updating—there is no inferred or automatic mode conversion.
- Retain pinned SDK4.11.1 only for explicitly selected legacy/custom servers and exact-content forgetting. Do not substitute semantic deletion or retry a failed write against another API version.
- Support an independent hosted MCP key and fail closed before sending custom REST credentials to the hosted MCP endpoint. Preserve custom MCP endpoints and modern forwarding.
- Ship the standalone local-server artifact, complete bundled-dependency licenses and reproducibility inputs without requiring runtime node_modules. No public catalog refresh or npm publication is performed by this source release.
- Use a pinned, bundled fetch provider through the SDKs' supported options so local-tool cancellation remains reliable on Node 18.0.

## 1.2.3

- Use the bundled official Supermemory 5.0.1 SDK for hosted REST profile, search and document capture, preserving existing namespace strings, metadata and incremental generation IDs.
- Retain custom-server v3/v4 compatibility by default, with explicit `apiVersion` / `SUPERMEMORY_API_VERSION` selection and independent MCP routing.
- Render v5 profile facts and validate capture acceptance before advancing the saved cursor. Preserve recall gates, three-second budgets, zero transport retries and dynamic processing.
- Ship reproducible standalone Node 18+ bundles and SDK license attribution. This is the plugin-panel/Git release channel, not an upgrade or publication of the older npm 1.0.0 local-MCP product.
