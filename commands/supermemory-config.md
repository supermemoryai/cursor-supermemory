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
  "signalExtraction": false,
  "captureSubagents": false,
  "captureHeadless": false,
  "captureOrchestrated": true,
  "dedupeOpeningPrompt": true,
  "dedupeRecallQueries": true
}
```

Settings:
- `apiKey`: Override the global API key for this project
- `baseUrl`: Override the Supermemory API base URL
- `repoContainerTag`: Override the unified repository tag (default: derived from the normalized Git remote or project path)
- `signalExtraction`: Capture only turns containing configured signal keywords (default: false)
- `captureSubagents`: Recall and capture in subagent sessions (default: false)
- `captureHeadless`: Recall and capture in headless runs such as `cursor-agent -p` and in Cursor cloud/background agents (default: false)
- `captureOrchestrated`: Recall and capture in sessions launched by Conductor or Vibe Kanban (default: true)
- `dedupeOpeningPrompt`: Replace an opening prompt of 200+ characters captured from this machine in the last 24 hours with a one-line marker (default: true)
- `dedupeRecallQueries`: Re-serve the recall of a prompt already searched against the same container in the last 10 minutes (default: true)

The older `userContainerTag` and `projectContainerTag` options are retained
only as compatibility read tags. New memories always use `repoContainerTag`.

Add `.cursor/.supermemory/` to your `.gitignore` to keep credentials out of version control.
