export interface Env {
  TOKENS: KVNamespace;
  APP_SCRIPT_URL: string;
  BONUS_EXTRA_SCROLL?: string;
  BONUS_MULTI_TAP?: string;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { params, env, request } = ctx;
  const token = String(params.token || "").trim();

  // Look up token in KV
  const record = await env.TOKENS.get(token, "json") as {group:string; tag:number} | null;
  if (!record) return new Response("Invalid token", { status: 404 });

  const { group, tag } = record;
  const extra = (env.BONUS_EXTRA_SCROLL || "").split(",").map(n => parseInt(n,10));
  const multi = (env.BONUS_MULTI_TAP || "").split(",").map(n => parseInt(n,10));

  // Bonus redirect logic
  if (extra.includes(tag)) {
    const url = new URL(`/bonus/bonus1.html`, new URL(request.url).origin);
    url.searchParams.set("group", group);
    url.searchParams.set("tag", String(tag));
    return Response.redirect(url.toString(), 302);
  }
  if (multi.includes(tag)) {
    const url = new URL(`/bonus/bonus2.html`, new URL(request.url).origin);
    url.searchParams.set("group", group);
    url.searchParams.set("tag", String(tag));
    return Response.redirect(url.toString(), 302);
  }

  // Normal tag → redirect to Apps Script
  const scriptUrl = new URL(env.APP_SCRIPT_URL);
  scriptUrl.searchParams.set("group", group);
  scriptUrl.searchParams.set("tag", String(tag));
  return Response.redirect(scriptUrl.toString(), 302);
};
