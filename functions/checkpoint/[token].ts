export interface Env {
  TOKENS: KVNamespace;
  APP_SCRIPT_URL: string;
  BONUS_EXTRA_SCROLL?: string;
  BONUS_MULTI_TAP?: string;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { params, env, request } = ctx;
  const token = String(params.token || "").trim();

  // Lookup token in KV
  const record = await env.TOKENS.get(token, "json") as { group?: string; tag: number } | null;
  if (!record) return new Response("Invalid token", { status: 404 });

  const urlParams = new URL(request.url).searchParams;
  let group = urlParams.get("group") || null;

  // If no group stored, show form
  if (!group) {
    return new Response(renderGroupForm(token), {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }

  // Force uppercase to avoid case mismatches
  group = group.trim().toUpperCase();

  // If Google Script says group is invalid, show change group page
  if (!isValidGroupFormat(group)) {
    return new Response(renderInvalidGroupPage(token), {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }

  // Bonus logic
  const tag = record.tag;
  const extra = (env.BONUS_EXTRA_SCROLL || "").split(",").map(n => parseInt(n, 10));
  const multi = (env.BONUS_MULTI_TAP || "").split(",").map(n => parseInt(n, 10));

  if (extra.includes(tag)) {
    return Response.redirect(`/bonus/bonus1.html?group=${group}&tag=${tag}`, 302);
  }
  if (multi.includes(tag)) {
    return Response.redirect(`/bonus/bonus2.html?group=${group}&tag=${tag}`, 302);
  }

  // Normal redirect to Google Apps Script
  const scriptUrl = new URL(env.APP_SCRIPT_URL);
  scriptUrl.searchParams.set("group", group);
  scriptUrl.searchParams.set("tag", String(tag));
  return Response.redirect(scriptUrl.toString(), 302);
};

// ----------------- Helper Functions -----------------

function renderGroupForm(token: string) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Enter Group ID</title>
<link rel="stylesheet" href="/assets/css/style.css" />
</head>
<body>
  <h2>Enter Your Group ID</h2>
  <form id="groupForm">
    <input type="text" id="groupId" placeholder="e.g. G1" required />
    <button type="submit">Start</button>
  </form>
  <script>
    document.getElementById('groupForm').addEventListener('submit', function(e) {
      e.preventDefault();
      let group = document.getElementById('groupId').value.trim().toUpperCase();
      localStorage.setItem('treasure_group', group);
      location.href = location.pathname + "?group=" + encodeURIComponent(group);
    });
  </script>
</body>
</html>
`;
}

function renderInvalidGroupPage(token: string) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Invalid Group</title>
<link rel="stylesheet" href="/assets/css/style.css" />
</head>
<body>
  <h2>⚠️ Group Not Found</h2>
  <p>The Group ID you entered does not match any group.</p>
  <button id="changeGroup">Change Group</button>
  <script>
    document.getElementById('changeGroup').addEventListener('click', function() {
      localStorage.removeItem('treasure_group');
      location.href = location.pathname; // reload without group param
    });
  </script>
</body>
</html>
`;
}

// Simple group ID format checker (you can make stricter if needed)
function isValidGroupFormat(group: string) {
  return /^G\d+$/i.test(group);
}
