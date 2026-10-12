import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const metadata = JSON.parse(
  readFileSync("node_modules/.cache/cursor-supermemory/mcp-build.json", "utf8"),
);
const packages = new Set<string>();
for (const output of Object.values(metadata.outputs) as {
  inputs: Record<string, unknown>;
}[]) {
  for (const input of Object.keys(output.inputs)) {
    if (!input.startsWith("node_modules/")) continue;
    const parts = input.slice("node_modules/".length).split("/");
    packages.add(
      parts[0]!.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!,
    );
  }
}
if (!packages.has("supermemory") || !packages.has("supermemory-legacy")) {
  throw new Error(
    "The local MCP bundle must include both pinned Supermemory SDK boundaries.",
  );
}
mkdirSync("licenses", { recursive: true });
const rows: string[] = [];
for (const name of [...packages].sort()) {
  const directory = join("node_modules", name);
  const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const filename = `${name.replace(/^@/, "").replace(/\//g, "-")}-LICENSE`;
  const license = ["LICENSE", "LICENSE.md", "LICENSE.txt"].find((candidate) =>
    existsSync(join(directory, candidate)),
  );
  if (license) {
    writeFileSync(
      join("licenses", filename),
      readFileSync(join(directory, license)),
    );
  } else if (name === "data-uri-to-buffer") {
    const readme = readFileSync(join(directory, "README.md"), "utf8");
    const start = readme.indexOf("License\n-------");
    if (start < 0)
      throw new Error("Missing embedded data-uri-to-buffer license.");
    writeFileSync(join("licenses", filename), readme.slice(start));
  } else {
    throw new Error(`Missing bundled package license: ${name}`);
  }
  rows.push(
    `| ${name === pkg.name ? name : `${pkg.name} (${name} import alias)`} | ${pkg.version} | ${pkg.license} | [License](licenses/${filename}) |`,
  );
}
writeFileSync(
  "THIRD_PARTY_NOTICES.md",
  `# Third-party notices

The standalone Node bundles in \`dist/\` include the official Supermemory TypeScript SDK 5.0.1 where REST is used. The local MCP artifact also includes the pinned official SDK 4.11.1 only for explicitly selected legacy servers and exact-content forgetting, plus the MCP implementation and schema dependencies below. Upstream package source is unmodified; all required license files ship under \`licenses/\`.

This table and the copied licenses are generated from the local MCP bundle's actual included modules, using Bun 1.3.14 and the committed lockfile. The lightweight hosted CLI loads that standalone local artifact only when local mode is selected.

| Package | Version | License | Full license |
| --- | --- | --- | --- |
${rows.join("\n")}

Supermemory SDK source: https://github.com/supermemoryai/sdk-ts
MCP SDK source: https://github.com/modelcontextprotocol/typescript-sdk
`,
);
