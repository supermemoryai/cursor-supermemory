import { describe, expect, test } from "bun:test";
import { parseAuthCallback, verifyApiKey } from "./auth.ts";

describe("parseAuthCallback", () => {
  test("accepts a state-bound plugin credential", () => {
    const url = new URL(
      "http://127.0.0.1/callback?state=expected&apikey=sm_org_secret",
    );
    expect(parseAuthCallback(url, "expected")).toBe("sm_org_secret");
  });

  test("rejects a callback with the wrong state", () => {
    const url = new URL(
      "http://127.0.0.1/callback?state=wrong&apikey=sm_org_secret",
    );
    expect(() => parseAuthCallback(url, "expected")).toThrow(
      "Invalid callback state",
    );
  });

  test("rejects a callback without a plugin credential", () => {
    const url = new URL(
      "http://127.0.0.1/callback?state=expected&apikey=invalid",
    );
    expect(() => parseAuthCallback(url, "expected")).toThrow(
      "Invalid API key",
    );
  });
});

describe("verifyApiKey", () => {
  test("returns the organization bound to the candidate credential", async () => {
    const identity = await verifyApiKey(
      "sm_org_secret",
      "https://api.supermemory.ai/",
      (async (url, init) => {
        expect(url).toBe("https://api.supermemory.ai/v3/session");
        expect(init?.headers).toEqual({
          Authorization: "Bearer sm_org_secret",
          "x-sm-source": "cursor",
        });
        return new Response(
          JSON.stringify({
            org: { id: "org_1", name: "Engineering" },
            user: { email: "person@example.com" },
          }),
          { status: 200 },
        );
      }) as typeof fetch,
    );

    expect(identity).toEqual({
      organizationId: "org_1",
      organizationName: "Engineering",
      userEmail: "person@example.com",
    });
  });

  test("rejects a candidate credential without an organization", async () => {
    await expect(
      verifyApiKey(
        "sm_unknown_secret",
        "https://api.supermemory.ai",
        (async () =>
          new Response(JSON.stringify({ user: { id: "user_1" } }), {
            status: 200,
          })) as unknown as typeof fetch,
      ),
    ).rejects.toThrow("did not resolve to an organization");
  });
});
