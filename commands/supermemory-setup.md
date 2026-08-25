---
name: supermemory-setup
description: Connect Supermemory to Cursor for persistent AI memory
---

Authenticate this plugin. Run:

```bash
node "${CURSOR_PLUGIN_ROOT}/dist/cli.js" login
```

That opens a browser to connect your Supermemory account. Then reload the window (**Developer: Reload Window**).

Alternatively, set `SUPERMEMORY_API_KEY` in the environment (no login needed).

If the browser doesn't open, visit: https://console.supermemory.ai/auth/connect?client=cursor
