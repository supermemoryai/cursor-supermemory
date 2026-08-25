const MAX_LENGTH = 2000;

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = diff / 60_000;
  const hours = diff / 3_600_000;
  const days = diff / 86_400_000;
  const weeks = diff / 604_800_000;

  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  if (days < 7) return `${Math.floor(days)}d ago`;
  return `${Math.floor(weeks)}w ago`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringFacts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function formatMemoryLine(memory: unknown): string {
  const item = asRecord(memory) ?? {};
  const time =
    typeof item.updatedAt === "string" ? `[${formatRelativeTime(item.updatedAt)}] ` : "";
  const body =
    (typeof item.memory === "string" && item.memory) ||
    (typeof item.content === "string" && item.content) ||
    (typeof item.summary === "string" && item.summary) ||
    "";
  const label = typeof item.title === "string" && item.title ? `${item.title}: ` : "";
  return `- ${time}${label}${body}`;
}

export interface SessionContext {
  profile?: { static?: unknown; dynamic?: unknown } | null;
  personal?: unknown[];
  project?: unknown[];
}

export function formatContext(
  input: SessionContext,
  maxLength = MAX_LENGTH,
): string {
  const profileItems = [
    ...stringFacts(input.profile?.static),
    ...stringFacts(input.profile?.dynamic),
  ];
  const personal = input.personal ?? [];
  const project = input.project ?? [];

  if (profileItems.length === 0 && personal.length === 0 && project.length === 0) {
    return "";
  }

  const sections: string[] = ["[SUPERMEMORY CONTEXT]"];

  if (profileItems.length > 0) {
    sections.push("\nUser Profile:", ...profileItems.map((item) => `- ${item}`));
  }
  if (personal.length > 0) {
    sections.push("\nRecent Sessions:", ...personal.map(formatMemoryLine));
  }
  if (project.length > 0) {
    sections.push("\nProject Knowledge:", ...project.map(formatMemoryLine));
  }

  sections.push("\nUse these memories when relevant. Don't force them into every response.");

  let result = sections.join("\n");
  if (result.length > maxLength) {
    result = result.slice(0, maxLength - 3) + "...";
  }
  return result;
}
