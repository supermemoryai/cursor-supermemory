// Without an explicit tag the hosted server writes to the active space, where hook recall never looks.
export function formatContainerDirective(containerTag: string): string {
  return `This project's memory container: ${containerTag}. Pass \`containerTag: "${containerTag}"\` on every hosted Supermemory MCP call (search_memory, add_memory, listMemories) so tool memories and session recall stay in the same space. Local \`supermemory_*\` aliases instead require \`workspaceRoot\` with the active workspace's absolute path and use \`container: "user"\` or \`"project"\`; those aliases resolve this same container with personal/project scope metadata.`;
}

export function formatSessionContext(
  profiles: any[],
  maxItems: number,
  containerTag: string,
  projectName: string,
): string {
  const statics = [
    ...new Set(
      profiles.flatMap((result) =>
        Array.isArray(result?.profile?.static)
          ? result.profile.static.flatMap(factText)
          : [],
      ),
    ),
  ].slice(0, maxItems);
  const dynamics = [
    ...new Set(
      profiles.flatMap((result) =>
        Array.isArray(result?.profile?.dynamic)
          ? result.profile.dynamic.flatMap(factText)
          : [],
      ),
    ),
  ].slice(0, maxItems);
  if (statics.length === 0 && dynamics.length === 0) return "";

  const sections: string[] = [];
  if (statics.length > 0) {
    sections.push(
      `## User Profile (Persistent)\n${statics.map((fact) => `- ◪ ${fact}`).join("\n")}`,
    );
  }
  if (dynamics.length > 0) {
    sections.push(
      `## Recent Context\n${dynamics.map((fact) => `- ◪ ${fact}`).join("\n")}`,
    );
  }
  return `<supermemory-context>
Recalled memory for this project (${projectName}). Every line marked ◪ comes from Supermemory. Preserve the mark when citing one, and call the source “Supermemory,” never generic memory.
${formatContainerDirective(containerTag)}

${sections.join("\n\n")}
</supermemory-context>`;
}

function factText(fact: unknown): string[] {
  const text =
    typeof fact === "string" ? fact : (fact as { memory?: unknown })?.memory;
  return typeof text === "string" && text.trim() ? [text] : [];
}
