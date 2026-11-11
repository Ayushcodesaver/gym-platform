import { describe, it, expect, vi, afterEach } from "vitest";
import { createApiClient, ApiClientError } from "../src/index";

const okResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), { status });

afterEach(() => vi.unstubAllGlobals());

describe("api client envelope handling", () => {
  it("unwraps success envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ hello: "world" })));
    const client = createApiClient("http://test", async () => "token-1");
    await expect(client.get("/api/x")).resolves.toEqual({ hello: "world" });
  });

  it("throws ApiClientError with server code and message on error envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ success: false, error: { code: "DUPLICATE_CHECKIN", message: "Already checked in" } }), { status: 409 }),
    ));
    const client = createApiClient("http://test", async () => "token-1");
    const err = await client.get("/api/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe("DUPLICATE_CHECKIN");
    expect((err as ApiClientError).status).toBe(409);
  });

  it("sends the bearer token and JSON content type", async () => {
    const fetchMock = vi.fn(async () => okResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("http://test", async () => "tok");
    await client.post("/api/y", { a: 1 });
    const [, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });
});
