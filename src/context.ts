export function formatSessionContext(
  profiles: any[],
  maxItems: number,
  containerTag: string,
  projectName: string,
): string {
  const statics = [
    ...new Set(
      profiles.flatMap((result) =>
        Array.isArray(result?.profile?.static) ? result.profile.static : [],
      ),
    ),
  ].slice(0, maxItems);
  const dynamics = [
    ...new Set(
      profiles.flatMap((result) =>
        Array.isArray(result?.profile?.dynamic) ? result.profile.dynamic : [],
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
This project's memory container: ${containerTag}

${sections.join("\n\n")}
</supermemory-context>`;
}
