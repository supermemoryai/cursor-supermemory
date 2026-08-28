---
name: supermemory-status
description: Check Supermemory authentication and live connectivity
---

Run:

```bash
node "${CURSOR_PLUGIN_ROOT}/dist/cli.js" status
```

If `CURSOR_PLUGIN_ROOT` is empty, run `node dist/cli.js status` from the installed plugin directory.

Report whether credentials are present and whether Supermemory is reachable. Never print the full API key.
