---
name: supermemory-status
description: Check Supermemory authentication and live connectivity
---

Run:

```bash
node "$(ls -d ~/.cursor/plugins/local/cursor-supermemory ~/.cursor/plugins/cache/*/cursor-supermemory/*/ 2>/dev/null | head -1)/dist/cli.js" status
```

Report whether credentials are present and whether Supermemory is reachable. Never print the full API key.
