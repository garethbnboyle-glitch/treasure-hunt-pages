export const onRequest: PagesFunction<Env> = async ({ env, request }) => {
  const urlParams = new URL(request.url).searchParams;
  let group = urlParams.get('group');
  const tag = urlParams.get('tag') || "";

  // 1) Check if group exists (from URL or localStorage)
  if (!group) {
    group = localStorage.getItem('treasure_group');
    if (!group) {
      const returnUrl = location.pathname + location.search;
      location.href = '/setgroup.html?return=' + encodeURIComponent(returnUrl);
    }
  }

  // 2) Handle the tap count for the multi-tap bonus
  let taps = 0, requiredTaps = 3;
  const bonusKey = `BONUS:${group}:${tag}:multiTap`;
  const alreadyClaimed = await env.TOKENS.get(bonusKey);

  // If the bonus has already been claimed, redirect directly to the clue
  if (alreadyClaimed) {
    const clueUrl = await getClueUrl(tag, env);
    return Response.redirect(clueUrl + '?bonusClaimed=true', 302);
  }

  // 3) Handle taps if the bonus hasn't been claimed yet
  if (taps >= requiredTaps) {
    // Once the required taps are reached, claim the bonus and mark it in KV
    await env.TOKENS.put(bonusKey, 'claimed', { expirationTtl: 21600 }); // Set TTL for 6 hours
    const clueUrl = await getClueUrl(tag, env);
    return Response.redirect(clueUrl, 302);
  }

  // 4) Display a page with a button to track the taps
  return new Response(htmlPage(group, tag, taps));
};

// Helper function to fetch the clue URL from links.json
async function getClueUrl(tag: string, env: Env): Promise<string> {
  const links = await fetch(`${env.URL}/data/links.json`).then(r => r.json());
  return links[`clue${tag}`];
}

// Helper function to generate the HTML page content
function htmlPage(group: string, tag: string, taps: number) {
  return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Secret Tap Bonus</title>
      <link rel="stylesheet" href="/assets/css/style.css">
    </head>
    <body class="wrap center">
      <h2>Tap 3 times to
