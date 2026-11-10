import { createSessionHandler } from "@/lib/server/session-handler";
import { sharedAccessFromEnvironment } from "@/lib/server/shared-firestore";

export const POST = createSessionHandler({
  getConfiguration: () => ({ accessMode: process.env.CHAT_ACCESS_MODE, publicOrigin: process.env.CHAT_PUBLIC_ORIGIN, allowAnonymousTest: process.env.CHAT_ALLOW_ANONYMOUS_TEST === "true" }),
  redeem: (invite, now) => sharedAccessFromEnvironment().redeemInvite(invite, now),
  anonymous: (now) => sharedAccessFromEnvironment().createAnonymousSession(now),
});
