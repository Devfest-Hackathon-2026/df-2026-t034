import "server-only";
import { Firestore } from "@google-cloud/firestore";
import { createSharedAccess, SharedAccessError, type AtomicDocuments, type SharedLimits } from "./shared-access.ts";

function reportStorageFailure(error: unknown) {
  if (error instanceof SharedAccessError) return;
  const code = typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "number" ? error.code : undefined;
  const missingAsset = error instanceof Error && /ENOENT|Cannot find module|Cannot find package/.test(error.message);
  // Never log SDK error messages: they can carry request or credential details.
  console.error(JSON.stringify({ event: "shared_storage_failure", code, category: missingAsset ? "sdk_assets" : "sdk_operation" }));
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new SharedAccessError(503, "SHARED_SERVICE_NOT_CONFIGURED", "共享旅行助手尚未准备好，请稍后再试。");
  }
  return parsed;
}

export function firestoreDocuments(database: Firestore, collection: string): AtomicDocuments {
  const documents = database.collection(collection);
  return {
    run(operation) {
      return database.runTransaction(async (transaction) => operation({
        get: async (key) => (await transaction.get(documents.doc(key))).data(),
        set: (key, value) => { transaction.set(documents.doc(key), value); },
      }), { maxAttempts: 3 }).catch((error: unknown) => { reportStorageFailure(error); throw error; });
    },
  };
}

let cached: { key: string; access: ReturnType<typeof createSharedAccess> } | undefined;
export function sharedAccessFromEnvironment() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const collection = process.env.CHAT_FIRESTORE_COLLECTION || "travelChatAccess";
  if (!projectId || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId) || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(collection)) {
    throw new SharedAccessError(503, "SHARED_SERVICE_NOT_CONFIGURED", "共享旅行助手尚未准备好，请稍后再试。");
  }
  const limits: SharedLimits = {
    dailyRequests: positiveInteger(process.env.CHAT_DAILY_REQUEST_LIMIT, 100, 10000),
    sessionDailyRequests: positiveInteger(process.env.CHAT_SESSION_DAILY_REQUEST_LIMIT, 20, 1000),
    sessionLifetimeMs: positiveInteger(process.env.CHAT_SESSION_HOURS, 4, 24) * 3600000,
  };
  const anonymous = {
    allowAnonymousTest: process.env.CHAT_ALLOW_ANONYMOUS_TEST === "true",
    dailySessions: positiveInteger(process.env.CHAT_ANONYMOUS_SESSION_DAILY_LIMIT, 100, 10000),
  };
  const photos = {
    dailyRequests: positiveInteger(process.env.PLACES_DAILY_REQUEST_LIMIT, 100, 1000),
    sessionDailyRequests: positiveInteger(process.env.PLACES_SESSION_DAILY_REQUEST_LIMIT, 40, 200),
  };
  const key = JSON.stringify({ projectId, collection, limits, anonymous, photos });
  if (!cached || cached.key !== key) {
    // Application Default Credentials stay on the server. No service-account
    // credential, Gemini key, invitation, or session token is shipped to a bundle.
    const database = new Firestore({ projectId, preferRest: true });
    cached = { key, access: createSharedAccess(firestoreDocuments(database, collection), limits, anonymous, photos) };
  }
  return cached.access;
}
