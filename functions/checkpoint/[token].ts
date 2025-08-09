export interface Env {
  TOKENS: KVNamespace;                   // KV with token -> {"tag": number}
  BONUS_EXTRA_SCROLL?: string;           // e.g. "1,14"
  BONUS_MULTI_TAP?: string;              // e.g. "10,11"
  COOLDOWN_SECONDS?: string;             // e.g. "5"
  BONUS_TTL_SECONDS?: string;            // e.g. "21600" (6h)
}

export const onRequest: PagesFunction<Env> = async ({ params, env, request }) => {
  const token = String(params.token || "").trim();
  const reqUrl = new URL(request.url);
  const q = reqUrl.searchParams;
  const bonusParam = (q.get("bonus") || "").trim();

  // 0) Lookup tag number for this token
  const record = await env.TOKENS.get(token, "json") as { tag: number } | null;
  if (!record) return html(404, simplePage("Invalid tag", "<p>This tag isn’t recognised.</p>"));
  const tag = record.tag;

  // Parse bonus config
  const scrollBonus = parseCsvNums(env.BONUS_EXTRA_SCROLL);
  const multiBonus  = parseCsvNums(env.BONUS_MULTI_TAP);
  const cooldownSec = toInt(env.COOLDOWN_SECONDS, 5);
  const bonusTtlSec = toInt(env.BONUS_TTL_SECONDS, 21600);

  // Load routes.json and links.json
  const origin = new URL(request.url).origin;
  const [routes, links] = await Promise.all([
    fetch(`${origin}/data/routes.json`).then(r => r.json()),
    fetch(`${origin}/data/links.json`).then(r => r.json())
  ]);

  // 1) Group handling
  const groupParam = (q.get("group") || "").trim().toUpperCase();
  if (!groupParam) {
    return html(200, captureFormPage({
      token, tag,
      isScrollBonus: scrollBonus.includes(tag),
      isMultiBonus:  multiBonus.includes(tag),
      validGroups: Object.keys(routes)
    }));
  }

  const group = groupParam;
  if (!routes[group]) {
    return html(400, invalidGroupPage());
  }

  // 2) Duplicate-scan cooldown
  let dup = "0";
  if (!bonusParam) {
    const rlKey = `RL:${group}:${token}`;
    const hit = await env.TOKENS.get(rlKey);
    if (hit) {
      dup = "1";
    } else {
      await env.TOKENS.put(rlKey, "1", { expirationTtl: cooldownSec });
    }
  }

  // 3) Bonus trigger routing
  if (!bonusParam) {
    if (scrollBonus.includes(tag)) {
      const u = new URL("/bonus/bonus1", reqUrl.origin);
      u.searchParams.set("group", group);
      u.searchParams.set("tag", token);
      return Response.redirect(u.toString(), 302);
    }
    if (multiBonus.includes(tag)) {
      const u = new URL("/bonus/bonus2", reqUrl.origin);
      u.searchParams.set("group", group);
      u.searchParams.set("tag", token);
      return Response.redirect(u.toString(), 302);
    }
  }

  // 4) Bonus completion once-only check
  let repeat = "0";
  if (bonusParam) {
    const bKey = `BONUS:${group}:${tag}:${bonusParam}`;
    const already = await env.TOKENS.get(bKey);
    if (already) {
      repeat = "1";
    } else {
      await env.TOKENS.put(bKey, "1", { expirationTtl: bonusTtlSec });
    }
  }

  // 5) Route checking
  const route = routes[group];
  const tagIndex = route.indexOf(tag);
  if (tagIndex === -1) {
    return html(400, simplePage("Tag Not in Route", `<p>Tag ${tag} is not part of ${group}’s route.</p>`));
  }

  // 6) Get clue URL
  const clueUrl = links[tag];
  if (!clueUrl) {
    return html(400, simplePage("Missing Clue", `<p>No clue found for tag ${tag}.</p>`));
  }

  // 7) Redirect to clue
  const finalUrl = new URL(clueUrl);
  if (dup === "1") finalUrl.searchParams.set("dup", "1");
  if (repeat === "1") finalUrl.searchParams.set("repeat", "1");
  return Response.redirect(finalUrl.toString(), 302);
};

/* ----------------- helpers ----------------- */
function parseCsvNums(v?: string) {
  return (v || "").split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}
function toInt(v: string | undefined, def: number) {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : def;
}
function html(status: number, body: string) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=UTF-8" }
  });
}
function simplePage(title: string, bodyHtml: string) {
  return `<!doctype html><html><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/assets/css/style.css">
  </head><body class="wrap center">
    <h2>${escapeHtml(title)}</h2>
    ${bodyHtml}
  </body></html>`;
}
function invalidGroupPage() {
  return simplePage("⚠️ Group Not Found", `
    <p>The Group ID you entered isn’t on the list.</p>
    <button id="change" class="btn">Change Group</button>
    <script>
      document.getElementById('change').addEventListener('click', function(){
        try { localStorage.removeItem('treasure_group'); } catch(e) {}
        location.href = location.pathname;
      });
    </script>
  `);
}
function captureFormPage(opts: {
  token: string; tag: number;
  isScrollBonus: boolean; isMultiBonus: boolean;
  validGroups: string[];
}) {
  const { token, tag, isScrollBonus, isMultiBonus, validGroups } = opts;
  return `<!doctype html><html><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Enter Group</title>
  <link rel="stylesheet" href="/assets/css/style.css">
</head><body class="wrap center">
  <h2>Enter your Group ID</h2>
  <form id="gform">
    <input id="ginput" placeholder="e.g. G1" required>
    <p id="err" style="color:red;display:none">Invalid Group ID</p>
    <button class="btn" type="submit">Continue</button>
  </form>
  <script>
    (function(){
      var token = ${JSON.stringify(token)};
      var tag = ${JSON.stringify(tag)};
      var isScroll = ${JSON.stringify(isScrollBonus)};
      var isMulti  = ${JSON.stringify(isMultiBonus)};
      var valid = ${JSON.stringify(validGroups)};
      var saved = localStorage.getItem('treasure_group');
      if (saved && valid.indexOf(saved.toUpperCase()) >= 0) {
        goNext(saved.toUpperCase());
      }
      document.getElementById('gform').addEventListener('submit', function(e){
        e.preventDefault();
        var g = document.getElementById('ginput').value.trim().toUpperCase();
        if (valid.indexOf(g) === -1) {
          document.getElementById('err').style.display = 'block';
          return;
        }
        localStorage.setItem('treasure_group', g);
        goNext(g);
      });
      function goNext(group){
        if (isScroll) {
          var u = new URL("/bonus/bonus1", location.origin);
          u.searchParams.set("group", group);
          u.searchParams.set("tag", token);
          location.replace(u.toString()); return;
        }
        if (isMulti) {
          var u = new URL("/bonus/bonus2", location.origin);
          u.searchParams.set("group", group);
          u.searchParams.set("tag", token);
          location.replace(u.toString()); return;
        }
        var u = new URL(location.origin + "/checkpoint/" + token);
        u.searchParams.set("group", group);
        location.replace(u.toString());
      }
    })();
  </script>
</body></html>`;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
