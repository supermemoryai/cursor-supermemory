---
name: supermemory-logout
description: Disconnect Supermemory from Cursor
---

Run the following command to remove your Supermemory credentials:

```bash
node "$(ls -d ~/.cursor/plugins/local/cursor-supermemory ~/.cursor/plugins/cache/*/cursor-supermemory/*/ 2>/dev/null | head -1)/dist/cli.js" logout
```

Your credentials will be removed from ~/.supermemory-cursor/credentials.json. Your memories in Supermemory are not deleted.
