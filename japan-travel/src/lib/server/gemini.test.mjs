import assert from "node:assert/strict";
import test from "node:test";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_RETRY_OPTIONS } from "./gemini-options.ts";

function mockTransport(statuses) {
  let calls = 0;
  const ai = new GoogleGenAI({
    apiKey: "test-only-never-sent-to-network",
    httpOptions: {
      retryOptions: GEMINI_RETRY_OPTIONS,
      fetch: async () => {
        const status = statuses[calls++] ?? 500;
        const body = status === 200 ? {
          candidates: [{ content: { role: "model", parts: [{ text: "旅行建议" }] }, finishReason: "STOP" }],
        } : { error: { code: status, message: "mock upstream failure", status: "UNAVAILABLE" } };
        return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      },
    },
  });
  return {
    call: () => ai.models.generateContent({ model: "test-model", contents: "东京旅行" }),
    calls: () => calls,
  };
}

test("real SDK transport retries a 503 once and returns the successful reply", async () => {
  const transport = mockTransport([503, 200]);
  assert.equal((await transport.call()).text, "旅行建议");
  assert.equal(transport.calls(), 2);
});

test("real SDK transport stops after two 503 attempts", async () => {
  const transport = mockTransport([503, 503, 200]);
  await assert.rejects(transport.call(), (error) => error.status === 503);
  assert.equal(transport.calls(), 2);
});

test("real SDK transport never retries quota, authentication or invalid requests", async () => {
  for (const status of [400, 401, 402, 403, 404, 429]) {
    const transport = mockTransport([status, 200]);
    await assert.rejects(transport.call(), (error) => error.status === status);
    assert.equal(transport.calls(), 1, `status ${status} must not retry`);
  }
});
