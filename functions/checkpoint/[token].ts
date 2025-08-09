export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { params, env, request } = ctx;
  const token = String(params.token || "").trim();
  const url = new URL(request.url);
  const group = url.searchParams.get("group");

  // If no group param, return a small HTML that checks localStorage
  if (!group) {
    return new Response(`
      <!DOCTYPE html>
      <script>
        const g = localStorage.getItem('treasure_group');
        if (!g) {
          location.href = '/setgroup.html?return=' + encodeURIComponent(location.pathname);
        } else {
          location.href = location.pathname + '?group=' + encodeURIComponent(g);
        }
      </script>
    `, { headers: { "content-type": "text/html" } });
  }

  // Normal KV lookup and bonus handling here...
  const record = await env.TOKENS.get(token, "json") as { tag: number } | null;
  if (!record) return new Response("Invalid token", { status: 404 });

  const { tag } = record;
  const extra = (env.BONUS_EXTRA_SCROLL || "").split(",").map(n => parseInt(n,10));
  const multi = (env.BONUS_MULTI_TAP || "").split(",").map(n => parseInt(n,10));

  if (extra.includes(tag)) {
    const bonusUrl = new URL(`/bonus/bonus1.html`, url.origin);
    bonusUrl.searchParams.set("group", group);
    bonusUrl.searchParams.set("tag", token);
    return Response.redirect(bonusUrl.toString(), 302);
  }
  if (multi.includes(tag)) {
    const bonusUrl = new URL(`/bonus/bonus2.html`, url.origin);
    bonusUrl.searchParams.set("group", group);
    bonusUrl.searchParams.set("tag", token);
    return Response.redirect(bonusUrl.toString(), 302);
  }

  // Normal clue redirect
  const scriptUrl = new URL(env.APP_SCRIPT_URL);
  scriptUrl.searchParams.set("group", group);
  scriptUrl.searchParams.set("tag", String(tag));
  return Response.redirect(scriptUrl.toString(), 302);
};
