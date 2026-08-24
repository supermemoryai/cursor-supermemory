---
name: supermemory-switch-org
description: Choose which Supermemory organization Cursor should use
---

Run the following command in the terminal:

```bash
bunx cursor-supermemory@latest switch-org
```

This opens Supermemory in your browser, where you can choose an organization.
Your existing saved credential is kept if authentication is cancelled or fails.

After a successful switch, restart Cursor or run **Developer: Reload Window**
so the MCP server uses the new organization.
