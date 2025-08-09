export interface Env {
  TOKENS: KVNamespace;                   // KV with token -> {"tag": number}
  APP_SCRIPT_URL: string;                // e.g. https://script.google.com/macros/s/XXXXX/exec
  VALID_GROUPS: string;                  // e.g. "G1,G2,...,G30"
  BONUS_EXTRA_SCROLL?: string;           // e.g. "1,14"
  BONUS_MULTI_TAP?: string;              // e.g. "10,11"
  COOLDOWN_SECONDS?: string;             // e.g. "5"  (fast duplicate-scan window)
  BONUS_TTL_SECONDS?: string;            // e.g. "21600" (6h) lifetime to remember a claimed bonus
}

export const onRequest: PagesFunction<Env> = async ({ params, env, request }) => {
  const token = String(params.token || "").trim();
  const reqUrl = new URL(request.url);
  const q = reqUrl.searchParams;
  const bonusParam = (q.get("bonus") || "").trim(); // set by bonus pages on return

  // 0) Lookup tag for this token
  const record = await env.TOKENS.get(token, "json") as { tag: number } | null;
  if (!record) return html(404, simplePage("Invalid tag", "<p>This tag isn’t recognised.</p>"));
  const tag = record.tag;

  // Parse env config
  const validGroups = (env.VALID_GROUPS || "")
    .split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const scrollBonus = parseCsvNums(env.BONUS_EXTRA_SCROLL);
  const multiBonus  = parseCsvNums(env.BONUS_MULTI_TAP);
  const cooldownSec = toInt(env.COOLDOWN_SECONDS, 5);
  const bonusTtlSec = toInt(env.BONUS_TTL_SECONDS, 21600); // 6h default

  // 1) Group handling (query OR inline capture form). We never hardcode Apps Script URL in HTML.
  const groupParam = (q.get("group") || "").trim();
  if (!groupParam) {
    // Inline capture page: validates before storing, uppercases, and jumps straight to clue/bonus.
    return html(200, captureFormPage({
      token, tag, appUrl: env.APP_SCRIPT_URL,
      isScrollBonus: scrollBonus.includes(tag),
      isMultiBonus:  multiBonus.includes(tag),
      validGroups
    }));
  }

  // 2) Validate group (uppercase + check list)
  const group = groupParam.toUpperCase();
  if (!validGroups.includes(group)) {
    return html(400, invalidGroupPage());
  }

  // 3) Duplicate-scan cooldown (non-bonus triggers only)
  // Use KV as a short TTL semaphore: RL:<group>:<token>
  let dup = "0";
  if (!bonusParam) {
    const rlKey = `RL:${group}:${token}`;
    const hit = await env.TOKENS.get(rlKey);
    if (hit) {
      // Recently scanned; mark as duplicate so Apps Script can de-weight or ignore
      dup = "1";
    } else {
      await env.TOKENS.put(rlKey, "1", { expirationTtl: cooldownSec });
    }
  }

  // 4) Bonus trigger routing (only when not returning from a bonus completion)
  if (!bonusParam) {
    if (scrollBonus.includes(tag)) {
      const u = new URL("/bonus/bonus1", reqUrl.origin);
      u.searchParams.set("group", group);
      // pass the token so bonus can return via /checkpoint/{token}
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

  // 5) Bonus completion anti-abuse
  // If returning with ?bonus=..., ensure award once per (group, tag, bonusType)
  let repeat = "0";
  if (bonusParam) {
    const bKey = `BONUS:${group}:${tag}:${bonusParam}`;
    const already = await env.TOKENS.get(bKey);
    if (already) {
      repeat = "1"; // Apps Script can ignore additional awards
    } else {
      await env.TOKENS.put(bKey, "1", { expirationTtl: bonusTtlSec });
    }
  }

  // 6) Normal (or bonus completion) redirect to Google Apps Script
  const scriptUrl = new URL(env.APP_SCRIPT_URL);
  scriptUrl.searchParams.set("group", group);
  scriptUrl.searchParams.set("tag", String(tag));
  if (bonusParam) scriptUrl.searchParams.set("bonus", bonusParam);
  if (dup === "1") scriptUrl.searchParams.set("dup", "1");
  if (repeat === "1") scriptUrl.searchParams.set("repeat", "1");

  return Response.redirect(scriptUrl.toString(), 302);
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
        // Reload without query so we see the capture form
        location.href = location.pathname;
      });
    </script>
  `);
}

function captureFormPage(opts: {
  token: string; tag: number; appUrl: string;
  isScrollBonus: boolean; isMultiBonus: boolean;
  validGroups: string[];
}) {
  const { token, tag, appUrl, isScrollBonus, isMultiBonus, validGroups } = opts;
  // Inject minimal page that validates BEFORE saving, then jumps straight to next step.
  return `<!doctype html><html><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Enter Group</title>
  <link rel="stylesheet" href="/assets/css/style.css">
</head><body class="wrap center">
  <h2>Enter your Group ID</h2>
  <p class="note">Example: G1, G2, …</p>
  <form id="gform" autocomplete="off">
    <input id="ginput" placeholder="e.g. G1" required
           style="width:100%;padding:.6rem;border:1px solid #dadce0;border-radius:8px">
    <div style="height:12px"></div>
    <button class="btn" type="submit">Continue</button>
    <p id="err" style="color:#d93025;display:none;margin-top:8px">That Group ID isn’t on the list. Check your letter/number.</p>
  </form>
  <script>
    (function(){
      var token = ${JSON.stringify(token)};
      var tag = ${JSON.stringify(tag)};
      var app = ${JSON.stringify(appUrl)};
      var isScroll = ${JSON.stringify(isScrollBonus)};
      var isMulti  = ${JSON.stringify(isMultiBonus)};
      var valid = ${JSON.stringify(validGroups)};

      // If group already saved, validate and go immediately
      try {
        var saved = localStorage.getItem('treasure_group');
        if (saved) {
          var g = (saved + "").trim().toUpperCase();
          if (valid.indexOf(g) >= 0) { return goNext(g); }
          // else purge bad saved value
          localStorage.removeItem('treasure_group');
        }
      } catch(e){}

      document.getElementById('gform').addEventListener('submit', function(e){
        e.preventDefault();
        var g = document.getElementById('ginput').value.trim().toUpperCase();
        if (valid.indexOf(g) === -1) {
          document.getElementById('err').style.display = 'block';
          return;
        }
        try { localStorage.setItem('treasure_group', g); } catch(e){}
        goNext(g);
      });

      function goNext(group){
        // Bonus triggers first
        if (isScroll) {
          var u = new URL("/bonus/bonus1", location.origin);
          u.searchParams.set("group", group);
          u.searchParams.set("tag", token); // pass token so bonus can return to /checkpoint/{token}
          location.replace(u.toString()); return;
        }
        if (isMulti) {
          var u = new URL("/bonus/bonus2", location.origin);
          u.searchParams.set("group", group);
          u.searchParams.set("tag", token);
          location.replace(u.toString()); return;
        }
        // Normal clue
        var u = new URL(app);
        u.searchParams.set("group", group);
        u.searchParams.set("tag", String(tag));
        location.replace(u.toString());
      }
    })();
  </script>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
