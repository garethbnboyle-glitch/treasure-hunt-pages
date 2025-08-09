export interface Env {
  TOKENS: KVNamespace;
  APP_SCRIPT_URL: string;      // e.g. https://script.google.com/macros/s/XXXX/exec
  BONUS_EXTRA_SCROLL?: string; // e.g. "1,14"
  BONUS_MULTI_TAP?: string;    // e.g. "10,11"
}

export const onRequest: PagesFunction<Env> = async ({ params, env, request }) => {
  const token = String(params.token || "").trim();
  const reqUrl = new URL(request.url);
  const groupParam = (reqUrl.searchParams.get("group") || "").trim();
  const bonusParam = (reqUrl.searchParams.get("bonus") || "").trim();

  // Lookup tag in KV immediately (we'll need it even for the form page)
  const record = await env.TOKENS.get(token, "json") as { tag: number } | null;
  if (!record) return new Response("Invalid token", { status: 404 });
  const tag = record.tag;

  // Parse bonus arrays once
  const scroll = (env.BONUS_EXTRA_SCROLL || "")
    .split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  const multi = (env.BONUS_MULTI_TAP || "")
    .split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

  // If we don't have a group param, show inline capture page that jumps straight to next step on submit
  if (!groupParam) {
    const appUrl = env.APP_SCRIPT_URL;
    const isScrollBonus = scroll.includes(tag);
    const isMultiBonus  = multi.includes(tag);

    const html = `
<!doctype html><html><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Enter Group</title>
  <link rel="stylesheet" href="/assets/css/style.css">
</head><body class="wrap center">
  <h2>Enter your Group ID</h2>
  <form id="gform">
    <input id="ginput" placeholder="e.g. G1" required
           style="width:100%;padding:.6rem;border:1px solid #dadce0;border-radius:8px">
    <div style="height:12px"></div>
    <button class="btn" type="submit">Continue</button>
  </form>
  <script>
    (function(){
      var token = ${JSON.stringify(token)};
      var tag    = ${JSON.stringify(tag)};
      var app    = ${JSON.stringify(appUrl)};
      var isScroll = ${JSON.stringify(isScrollBonus)};
      var isMulti  = ${JSON.stringify(isMultiBonus)};

      function goNext(group){
        // Prefer bonus route if this tag is a bonus trigger and we're not returning from a bonus
        if (isScroll) {
          var u = new URL("/bonus/bonus1", location.origin);
          u.searchParams.set("group", group);
          // pass the token so bonus can return via /checkpoint/{token}
          u.searchParams.set("tag", token);
          location.replace(u.toString());
          return;
        }
        if (isMulti) {
          var u = new URL("/bonus/bonus2", location.origin);
          u.searchParams.set("group", group);
          u.searchParams.set("tag", token);
          location.replace(u.toString());
          return;
        }
        // Normal clue: jump straight to Apps Script
        var u = new URL(app);
        u.searchParams.set("group", group);
        u.searchParams.set("tag", String(tag));
        location.replace(u.toString());
      }

      // Fast path: already saved
      var saved = localStorage.getItem('treasure_group');
      if (saved) { goNext(saved); return; }

      // Capture + go
      document.getElementById('gform').addEventListener('submit', function(e){
        e.preventDefault();
        var g = document.getElementById('ginput').value.trim();
        if (!g) return;
        localStorage.setItem('treasure_group', g);
        goNext(g);
      });
    })();
  </script>
</body></html>`;
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  // If we're returning from a bonus completion, go straight to Apps Script with bonus param
  const scriptUrl = new URL(env.APP_SCRIPT_URL);
  scriptUrl.searchParams.set("group", groupParam);
  scriptUrl.searchParams.set("tag", String(tag));
  if (bonusParam) scriptUrl.searchParams.set("bonus", bonusParam);

  // If not a bonus completion, check for bonus trigger then redirect accordingly
  if (!bonusParam) {
    if (scroll.includes(tag)) {
      const u = new URL("/bonus/bonus1", reqUrl.origin);
      u.searchParams.set("group", groupParam);
      u.searchParams.set("tag", token);
      return Response.redirect(u.toString(), 302);
    }
    if (multi.includes(tag)) {
      const u = new URL("/bonus/bonus2", reqUrl.origin);
      u.searchParams.set("group", groupParam);
      u.searchParams.set("tag", token);
      return Response.redirect(u.toString(), 302);
    }
  }

  // Normal clue
  return Response.redirect(scriptUrl.toString(), 302);
};
