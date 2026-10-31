export const MEMORY_MARK_NOTE =
  'Every line marked ◪ came from Supermemory. When one shapes your answer, credit it naturally with the ◪ prefix (e.g. "◪ earlier you decided X"); if you name the source, say "from supermemory", never generic memory.';

// Without an explicit tag the hosted server writes to the active space, where hook recall never looks.
export function formatContainerDirective(containerTag: string): string {
  return `This project's memory container: ${containerTag}. Pass \`containerTag: "${containerTag}"\` on every Supermemory MCP call (search_memory, add_memory, listMemories) so tool memories and session recall stay in the same space.`;
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
Recalled memory for this project (${projectName}). ${MEMORY_MARK_NOTE}
${formatContainerDirective(containerTag)}

${sections.join("\n\n")}
</supermemory-context>`;
}

function factText(fact: unknown): string[] {
  const text =
    typeof fact === "string" ? fact : (fact as { memory?: unknown })?.memory;
  return typeof text === "string" && text.trim() ? [text] : [];
}
