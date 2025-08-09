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
  let group = urlParams.get("group") || localStorageGroup();

  // If no group stored, show form
  if (!group) {
    return new Response(renderGroupForm(token), {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }

  // Force uppercase to avoid case mismatches
  group = group.trim().toUpperCase();

  // Store uppercase group in localStorage via inline JS on the page
  if (!urlParams.get("group")) {
    return new Response(storeGroupAndRedirect(group, token), {
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

// Helper: Render group form
function renderGroupForm(token: string) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Enter Group ID</title>
<link rel="stylesheet"
