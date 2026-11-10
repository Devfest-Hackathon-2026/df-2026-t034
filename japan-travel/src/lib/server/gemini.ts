import { visitConstraintInstruction } from "./visit-constraints.ts";
import { replyLanguageInstruction } from "./reply-language.ts";
import "server-only";
import { withGeminiSlot } from "./gemini-scheduler.ts";
import { GoogleGenAI, Type, ThinkingLevel, type Schema } from "@google/genai";
import { CHAT_LIMITS, fullPlanInstruction, travelSystemInstruction, type GenerateReply } from "./chat";
import { GEMINI_RETRY_OPTIONS } from "./gemini-options";
import { PLANNING_DECISION_INSTRUCTION, parsePlanningDecision, type AssessPlanning } from "./planning-decision.ts";
import { renderDaySegment } from "./itinerary-format";

function daySegmentSchema(dayCount: number, withOverview: boolean): Schema {
  const schema: Schema = {
    type: Type.OBJECT,
    required: ["days"],
    properties: {
      days: {
        type: Type.ARRAY, minItems: String(dayCount), maxItems: String(dayCount),
        items: {
          type: Type.OBJECT,
          required: ["number", "title", "sights", "activities"],
          properties: {
            number: { type: Type.INTEGER },
            title: { type: Type.STRING },
            sights: {
              type: Type.ARRAY, maxItems: "4",
              items: {
                type: Type.OBJECT, required: ["name", "description"],
                properties: { name: { type: Type.STRING }, description: { type: Type.STRING } },
              },
            },
            activities: { type: Type.ARRAY, minItems: "2", maxItems: "9", items: { type: Type.STRING } },
          },
        },
      },
    },
  };
  if (withOverview) {
    const string = { type: Type.STRING };
    const integer = { type: Type.INTEGER };
    schema.required!.push("opening", "overview", "summary", "budget");
    Object.assign(schema.properties!, {
      opening: string,
      overview: {
        type: Type.ARRAY, minItems: "1",
        items: { type: Type.OBJECT, required: ["first", "last", "area"], properties: { first: integer, last: integer, area: string } },
      },
      summary: string,
      budget: {
        type: Type.OBJECT, required: ["currency", "travelers", "scope", "items"],
        properties: {
          currency: { type: Type.STRING, enum: ["CNY", "JPY"] }, travelers: integer, scope: string,
          items: {
            type: Type.ARRAY, minItems: "3", maxItems: "6",
            items: { type: Type.OBJECT, required: ["label", "economy", "comfort", "luxury"], properties: { label: string, economy: integer, comfort: integer, luxury: integer } },
          },
        },
      },
    });
  }
  return schema;
}

export const generateGeminiReply: GenerateReply = (input) => withGeminiSlot(input.signal, async () => {
  const { model, contents, signal, completeItinerary } = input;
  const range = input.planFormat?.range;
  const structuredDays = range ? range.last - range.first + 1 : 0;
  const withOverview = range?.first === 1;
  const httpOptions = {
    timeout: completeItinerary ? CHAT_LIMITS.fullTimeoutMs : CHAT_LIMITS.timeoutMs,
    retryOptions: GEMINI_RETRY_OPTIONS,
  };
  const ai = input.provider === "vertex"
    ? new GoogleGenAI({ vertexai: true, project: input.projectId, location: input.location, httpOptions: { ...httpOptions, apiVersion: "v1" } })
    : new GoogleGenAI({ vertexai: false, apiKey: input.apiKey, httpOptions });
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: (input.planFormat
        ? fullPlanInstruction(input.planFormat.expectedDays, input.planFormat.repair, input.planFormat.range)
        : travelSystemInstruction(input.dailyItinerary, completeItinerary)) + visitConstraintInstruction(input.visitConstraints) + replyLanguageInstruction(input.language),
      maxOutputTokens: completeItinerary ? CHAT_LIMITS.fullOutputTokens : CHAT_LIMITS.maxOutputTokens,
      abortSignal: signal,
      ...(completeItinerary && model.startsWith("gemini-3.8-flash") ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
      ...(structuredDays ? { responseMimeType: "application/json", responseSchema: daySegmentSchema(structuredDays, withOverview) } : {}),
    },
  });
  const finishReason = response.candidates?.[0]?.finishReason;
  return {
    text: structuredDays ? renderDaySegment(response.text, withOverview) : response.text,
    blocked: Boolean(response.promptFeedback?.blockReason) ||
      ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"].includes(finishReason ?? ""),
    reachedOutputLimit: finishReason === "MAX_TOKENS",
    inputTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount,
    totalTokens: response.usageMetadata?.totalTokenCount,
  };
});

// One bounded assessment shares the existing request admission and deadline.
export const assessGeminiPlanning: AssessPlanning = (input) => withGeminiSlot(input.signal, async () => {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  input.signal.addEventListener("abort", cancel, { once: true });
  if (input.signal.aborted) cancel();
  // Vertex occasionally needs longer than 12s even for this small decision.
  // This remains inside the parent's unchanged 95s total deadline.
  const assessmentTimeoutMs = 20000;
  const timer = setTimeout(cancel, assessmentTimeoutMs);
  try {
    const httpOptions = { timeout: assessmentTimeoutMs, retryOptions: { attempts: 1 } };
    const ai = input.provider === "vertex"
      ? new GoogleGenAI({ vertexai: true, project: input.projectId, location: input.location, httpOptions: { ...httpOptions, apiVersion: "v1" } })
      : new GoogleGenAI({ vertexai: false, apiKey: input.apiKey, httpOptions });
    const response = await ai.models.generateContent({ model: input.model, contents: input.contents, config: {
      systemInstruction: PLANNING_DECISION_INSTRUCTION + replyLanguageInstruction(input.language, true), maxOutputTokens: 2048, abortSignal: controller.signal,
      ...(input.model.startsWith("gemini-3.8-flash") ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
      responseMimeType: "application/json", responseSchema: {
        type: Type.OBJECT, required: ["action", "days", "questions", "assumptions"],
        properties: {
          action: { type: Type.STRING, enum: ["clarify", "plan", "answer"] }, days: { type: Type.INTEGER },
          questions: { type: Type.ARRAY, maxItems: "3", items: { type: Type.STRING } },
          assumptions: { type: Type.ARRAY, maxItems: "3", items: { type: Type.STRING } },
        },
      },
    } });
    return { decision: parsePlanningDecision(response.text),
      inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount,
      totalTokens: response.usageMetadata?.totalTokenCount };
  } finally { clearTimeout(timer); input.signal.removeEventListener("abort", cancel); }
});
