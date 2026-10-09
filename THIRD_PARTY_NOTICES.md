# Third-party notices

The standalone Node bundles in `dist/` include the official Supermemory TypeScript SDK 5.0.1 where REST is used. The local MCP artifact also includes the pinned official SDK 4.11.1 only for explicitly selected legacy servers and exact-content forgetting, plus the MCP implementation and schema dependencies below. Upstream package source is unmodified; all required license files ship under `licenses/`.

This table and the copied licenses are generated from the local MCP bundle's actual included modules, using Bun 1.3.14 and the committed lockfile. The lightweight hosted CLI loads that standalone local artifact only when local mode is selected.

| Package | Version | License | Full license |
| --- | --- | --- | --- |
| @modelcontextprotocol/sdk | 1.26.0 | MIT | [License](licenses/modelcontextprotocol-sdk-LICENSE) |
| ajv | 8.20.0 | MIT | [License](licenses/ajv-LICENSE) |
| ajv-formats | 3.0.1 | MIT | [License](licenses/ajv-formats-LICENSE) |
| data-uri-to-buffer | 4.0.1 | MIT | [License](licenses/data-uri-to-buffer-LICENSE) |
| fast-deep-equal | 3.1.3 | MIT | [License](licenses/fast-deep-equal-LICENSE) |
| fast-uri | 3.1.8 | BSD-3-Clause | [License](licenses/fast-uri-LICENSE) |
| fetch-blob | 3.2.0 | MIT | [License](licenses/fetch-blob-LICENSE) |
| formdata-polyfill | 4.0.10 | MIT | [License](licenses/formdata-polyfill-LICENSE) |
| json-schema-traverse | 1.0.0 | MIT | [License](licenses/json-schema-traverse-LICENSE) |
| node-domexception | 1.0.0 | MIT | [License](licenses/node-domexception-LICENSE) |
| node-fetch | 3.3.2 | MIT | [License](licenses/node-fetch-LICENSE) |
| supermemory | 5.0.1 | Apache-2.0 | [License](licenses/supermemory-LICENSE) |
| supermemory (supermemory-legacy import alias) | 4.11.1 | Apache-2.0 | [License](licenses/supermemory-legacy-LICENSE) |
| web-streams-polyfill | 3.3.3 | MIT | [License](licenses/web-streams-polyfill-LICENSE) |
| zod | 4.3.6 | MIT | [License](licenses/zod-LICENSE) |
| zod-to-json-schema | 3.25.2 | ISC | [License](licenses/zod-to-json-schema-LICENSE) |

Supermemory SDK source: https://github.com/supermemoryai/sdk-ts
MCP SDK source: https://github.com/modelcontextprotocol/typescript-sdk
