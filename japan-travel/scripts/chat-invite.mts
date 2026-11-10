import { sharedAccessFromEnvironment } from "../src/lib/server/shared-firestore.ts";

// This administrative command uses the owner's ADC credentials. It is never
// exposed as an unauthenticated HTTP endpoint or shipped in the mobile bundle.
async function main() {
  if (process.env.CHAT_ACCESS_MODE !== "shared") throw new Error("Set CHAT_ACCESS_MODE=shared in the owner-only .env.shared.local first.");
  const args = process.argv.slice(2);
  const access = sharedAccessFromEnvironment();
  if (args[0] === "revoke") {
    if (!args[1] || args.length !== 2) throw new Error("Usage: npm run chat:invite -- revoke INVITE_ID");
    await access.revokeInvite(args[1]);
    console.log("Invitation revoked; its issued sessions can no longer call Gemini.");
    return;
  }
  if (args.length !== 0 && !(args.length === 2 && args[0] === "--app-url")) throw new Error("Usage: npm run chat:invite [-- --app-url APP_DEEP_LINK] (or: npm run chat:invite -- revoke INVITE_ID)");
  let appUrl: URL | undefined;
  if (args[0] === "--app-url") {
    appUrl = new URL(args[1]);
    if (!["japantravelmobile:", "exp:", "exps:"].includes(appUrl.protocol) || appUrl.username || appUrl.password || appUrl.hash || appUrl.searchParams.has("invite")) throw new Error("Use the app's planner deep link without an existing invitation.");
  }
  const now = Date.now();
  const invite = await access.createInvite({ now, expiresAt: now + 24 * 3600000, uses: 10 });
  if (appUrl) appUrl.searchParams.set("invite", invite.inviteToken);
  console.log(JSON.stringify({ ...invite, uses: 10, ...(appUrl ? { appUrl: appUrl.toString() } : {}), note: "Share this access invitation only with the intended testers. It is not a Gemini API key." }, null, 2));
}
main().catch(() => {
  console.error("Could not manage the invitation. Check the owner-only shared settings, ADC permissions and Firestore availability. No credentials were printed.");
  process.exitCode = 1;
});
