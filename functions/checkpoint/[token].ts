export interface Env {
  TOKENS: KVNamespace;
  APP_SCRIPT_URL: string;
  BONUS_EXTRA_SCROLL?: string; // e.g. "1,14"
  BONUS_MULTI_TAP?: string;    // e.g. "10,11"
}

export const onRequest: PagesFunction<Env> = async ({ params, env, request }) => {
  const token = String(params.token || "").trim();

  // Look up token in KV (stored as JSON: { "group": "G1", "tag": 6 })
  const record = await env.TOKENS.get(token, "json") as { group: string; tag: number } | null;
  if (!record) {
    return new Response("Invalid token", { status: 404 });
  }

  const { group, tag } = record;
  const extra = (env.BONUS_EXTRA_SCROLL || "").split(",").map(n => parseInt(n, 10));
  const multi = (env.BONUS_MULTI_TAP || "").split(",").map(n => parseInt(n, 10));

  // Bonus pages
  if (extra.includes(tag)) {
    const url = new URL(`/bonus/bonus1`, new URL(request.url).origin);
    url.searchParams.set("group", group);
    url.searchParams.set("tag", String(tag));
    return Response.redirect(url.toString(), 302);
  }

  if (multi.includes(tag)) {
    const url = new URL(`/bonus/bonus2`, new URL(request.url).origin);
    url.searchParams.set("group", group);
    url.searchParams.set("tag", String(tag));
    return Response.redirect(url.toString(), 302);
  }

  // Normal clue redirect
  const scriptUrl = new URL(env.APP_SCRIPT_URL);
  scriptUrl.searchParams.set("group", group);
  scriptUrl.searchParams.set("tag", String(tag));
  return Response.redirect(scriptUrl.toString(), 302);
};
