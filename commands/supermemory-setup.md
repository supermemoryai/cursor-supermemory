---
name: supermemory-setup
description: Connect Supermemory to Cursor for persistent AI memory
---

Run the following command in the terminal to authenticate. It locates the plugin
install itself, so it works from any directory:

```bash
node "$(ls -d ~/.cursor/plugins/local/cursor-supermemory ~/.cursor/plugins/cache/*/cursor-supermemory/*/ 2>/dev/null | head -1)/dist/cli.js" login
```

This opens your browser to connect your Supermemory account to Cursor. Once connected, the AI will have persistent memory across all your coding sessions.

If the browser doesn't open automatically, visit: https://app.supermemory.ai/auth/connect?client=cursor
