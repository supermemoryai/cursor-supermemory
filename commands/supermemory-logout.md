---
name: supermemory-logout
description: Disconnect Supermemory from Cursor
---

Run:

```bash
node "${CURSOR_PLUGIN_ROOT}/dist/cli.js" logout
```

Credentials are removed from ~/.supermemory-cursor/credentials.json. Memories in Supermemory are not deleted.
