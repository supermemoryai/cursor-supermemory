---
name: memory-connect
description: Sign in to Supermemory so persistent memory works. Use when the user asks to sign in, log in, connect or set up Supermemory, or when a Supermemory tool or status says it is not authenticated.
---

1. Start the sign-in. Pass `--client grok_bot` if you are Grok Bot, so the approval page names Grok Bot; leave it off in Cursor:

   ```bash
   node -e 'const f=require("fs"),p=require("path"),h=require("os").homedir(),e=process.env;const ok=d=>{try{return JSON.parse(f.readFileSync(p.join(d,"package.json"),"utf8")).name==="cursor-supermemory"&&f.existsSync(p.join(d,"dist","cli.js"))}catch{return false}};const ls=d=>{try{return f.readdirSync(d).filter(x=>x!=="node_modules"&&x!==".git").map(x=>p.join(d,x))}catch{return[]}};let t=[e.CURSOR_PLUGIN_ROOT,e.CLAUDE_PLUGIN_ROOT,e.GROK_PLUGIN_ROOT].find(v=>v&&!v.includes("${")&&ok(v));let g=[".cursor/plugins",".grok/installed-plugins",".grok/plugins",".claude/plugins","sand-data/plugins"].map(x=>p.join(h,x));for(let i=0;i<4&&!t;i++){g=g.flatMap(ls);t=g.find(ok)}if(!t){console.error("Supermemory plugin not found");process.exit(1)}require("child_process").spawn(process.execPath,[p.join(t,"dist","cli.js"),...process.argv.slice(1)],{stdio:"inherit"}).on("exit",c=>process.exit(c??1))' login --client grok_bot
   ```

   It prints a sign-in URL, tries to open a browser, and then waits up to five minutes for approval. If your shell stops long-running commands, run it in the background and read the URL from its output.

2. Open that URL in a browser on this same machine. Approving redirects to `127.0.0.1` here, so it has to be this machine's browser. If you drive your own browser, open it there. The user may need to sign in to Supermemory and pick a workspace before selecting Approve.

3. Once the page says it is connected, confirm with the memory-status skill.

4. If it times out, run step 1 again. Setting `SUPERMEMORY_API_KEY` in the environment also works and skips the browser.
