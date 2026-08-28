---
name: supermemory-setup
description: Connect Supermemory to Cursor for persistent AI memory
---

Run the following command in the terminal to authenticate. Use `CURSOR_PLUGIN_ROOT` when it is set (Cursor sets it for plugin hooks):

```bash
node "${CURSOR_PLUGIN_ROOT}/dist/cli.js" login
```

If that variable is empty, run `node dist/cli.js login` from the installed plugin directory.

This opens your browser to connect your Supermemory account to Cursor. Once connected, the AI will have persistent memory across all your coding sessions.

If the browser doesn't open automatically, visit: https://app.supermemory.ai/auth/connect?client=cursor
