---
name: supermemory-status
description: Check Supermemory authentication and live connectivity
---

Run:

```bash
node -e 'const f=require("fs"),p=require("path"),h=require("os").homedir(),e=process.env;const ok=d=>{try{return JSON.parse(f.readFileSync(p.join(d,"package.json"),"utf8")).name==="cursor-supermemory"&&f.existsSync(p.join(d,"dist","cli.js"))}catch{return false}};const ls=d=>{try{return f.readdirSync(d).filter(x=>x!=="node_modules"&&x!==".git").map(x=>p.join(d,x))}catch{return[]}};let t=[e.CURSOR_PLUGIN_ROOT,e.CLAUDE_PLUGIN_ROOT,e.GROK_PLUGIN_ROOT].find(v=>v&&!v.includes("${")&&ok(v));let g=[".cursor/plugins",".grok/installed-plugins",".grok/plugins",".claude/plugins"].map(x=>p.join(h,x));for(let i=0;i<4&&!t;i++){g=g.flatMap(ls);t=g.find(ok)}if(!t){console.error("Supermemory plugin not found");process.exit(1)}require("child_process").spawn(process.execPath,[p.join(t,"dist","cli.js"),...process.argv.slice(1)],{stdio:"inherit"}).on("exit",c=>process.exit(c??1))' status
```

Report whether credentials are present and whether Supermemory is reachable. Never print the full API key.
