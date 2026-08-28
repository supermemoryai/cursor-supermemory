import { describe, expect, test } from "bun:test";
import {
  formatCapture,
  parseTranscript,
  selectCaptureEntries,
} from "./capture.ts";

describe("conversation capture", () => {
  const transcript = [
    { role: "user", message: { content: [{ type: "text", text: "Investigate the auth bug" }] } },
    { role: "assistant", message: { content: [{ type: "text", text: "The refresh token expires too early." }] } },
    { role: "tool", content: "ignored" },
    { type: "user", content: "Remember that we chose rotating tokens" },
    { type: "assistant", content: "Saved the decision." },
  ];

  test("parses array and JSONL transcript formats", () => {
    expect(parseTranscript(JSON.stringify(transcript))).toHaveLength(4);
    expect(parseTranscript(transcript.map((entry) => JSON.stringify(entry)).join("\n"))).toHaveLength(4);
  });

  test("captures only new entries by default", () => {
    const entries = parseTranscript(JSON.stringify(transcript));
    const selected = selectCaptureEntries(entries, 2, false, [], 3);
    expect(selected.map((entry) => entry.text)).toEqual([
      "Remember that we chose rotating tokens",
      "Saved the decision.",
    ]);
    expect(formatCapture(selected)).toContain("<|start|>user<|message|>");
  });

  test("signal extraction skips chatter and retains nearby turns", () => {
    const entries = parseTranscript(JSON.stringify(transcript));
    expect(selectCaptureEntries(entries.slice(0, 2), 0, true, ["remember"], 3)).toEqual([]);
    expect(selectCaptureEntries(entries, 0, true, ["remember"], 2)).toHaveLength(4);
  });
});
