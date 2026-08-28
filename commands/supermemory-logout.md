---
name: supermemory-logout
description: Disconnect Supermemory from Cursor
---

Run the following command to remove your Supermemory credentials:

```bash
node "${CURSOR_PLUGIN_ROOT}/dist/cli.js" logout
```

If `CURSOR_PLUGIN_ROOT` is empty, run `node dist/cli.js logout` from the installed plugin directory.

Your credentials will be removed from ~/.supermemory-cursor/credentials.json. Your memories in Supermemory are not deleted.
