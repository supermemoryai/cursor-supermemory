---
name: supermemory-config
description: Configure Supermemory settings for this project
---

Create or edit `.cursor/.supermemory/config.json` at your project root:

```json
{
  "apiKey": null,
  "baseUrl": null,
  "repoContainerTag": null
}
```

Settings:
- `apiKey`: Override the global API key for this project
- `baseUrl`: Override the Supermemory API base URL
- `repoContainerTag`: Override the unified repository tag (default: derived from the normalized Git remote or project path)

`user` and `project` both write to this repository's container (`sm_scope`
personal vs project). They are not cross-project. The older
`userContainerTag` and `projectContainerTag` options are retained only as
compatibility read tags.

Add `.cursor/.supermemory/` to your `.gitignore` to keep credentials out of version control.
