export interface Env {
  TOKENS: KVNamespace;
  APP_SCRIPT_URL: string; // e.g., https://script.google.com/macros/s/XXXXX/exec
  BONUS_EXTRA_SCROLL?: string; // comma-separated tag numbers, e.g., "1,14"
  BONUS_MULTI_TAP?: string;    // comma-separated tag numbers, e.g., "10,11"
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { params, env, request } = ctx;
  const token = String(params.token || "").trim();

  // 1. Look up token in KV — should return { tag: number }
  const record = await env.TOKENS.get(token, "json") as { tag: number } | null;
  if (!record) {
    return new Response("Invalid token", { status: 404 });
  }

  const { tag } = record;

  // 2. Get query params
  const urlObj = new URL(request.url);
  const group = urlObj.searchParams.get("group") || "UNKNOWN";
  const bonusType = urlObj.searchParams.get("bonus") || "";

  // 3. Parse bonus tag arrays from env
  const bonusScroll = (env.BONUS_EXTRA_SCROLL || "")
    .split(",")
    .map(n => parseInt(n.trim(), 10))
    .filter(n => !isNaN(n));

  const bonusMultiTap = (env.BONUS_MULTI_TAP || "")
    .split(",")
    .map(n => parseInt(n.trim(), 10))
    .filter(n => !isNaN(n));

  // 4. Handle bonus *trigger pages* (coming from normal tag scan)
  if (!bonusType) {
    if (bonusScroll.includes(tag)) {
      const bonusUrl = new URL(`/bonus/bonus1.html`, new URL(request.url).origin);
      bonusUrl.searchParams.set("group", group);
      bonusUrl.searchParams.set("tag", String(token)); // pass token, not tag number
      return Response.redirect(bonusUrl.toString(), 302);
    }
    if (bonusMultiTap.includes(tag)) {
      const bonusUrl = new URL(`/bonus/bonus2.html`, new URL(request.url).origin);
      bonusUrl.searchParams.set("group", group);
      bonusUrl.searchParams.set("tag", String(token)); // pass token, not tag number
      return Response.redirect(bonusUrl.toString(), 302);
    }
  }

  // 5. Normal or bonus *completion* → send to Apps Script
  const scriptUrl = new URL(env.APP_SCRIPT_URL);
  scriptUrl.searchParams.set("group", group);
  scriptUrl.searchParams.set("tag", String(tag));
  if (bonusType) {
    scriptUrl.searchParams.set("bonus", bonusType);
  }

  return Response.redirect(scriptUrl.toString(), 302);
};
