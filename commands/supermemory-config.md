---
name: supermemory-config
description: Configure Supermemory settings for this project
---

Create or edit `.cursor/.supermemory/config.json` at your project root:

```json
{
  "apiKey": null,
  "baseUrl": null,
  "repoContainerTag": null,
  "signalExtraction": false
}
```

Settings:
- `apiKey`: Override the global API key for this project
- `baseUrl`: Override the Supermemory API base URL
- `repoContainerTag`: Override the unified repository tag (default: derived from the normalized Git remote or project path)
- `signalExtraction`: Capture only turns containing configured signal keywords (default: false)

The older `userContainerTag` and `projectContainerTag` options are retained
only as compatibility read tags. New memories always use `repoContainerTag`.

Add `.cursor/.supermemory/` to your `.gitignore` to keep credentials out of version control.
