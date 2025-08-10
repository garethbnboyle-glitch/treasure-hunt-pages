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

  // 2) Check if tag is eligible for scroll bonus
  const scrollBonus = parseCsvNums(env.BONUS_EXTRA_SCROLL); 
  if (scrollBonus.includes(Number(tag))) {
    const bonusKey = `BONUS:${group}:${tag}:scroll`;
    const alreadyClaimed = await env.TOKENS.get(bonusKey);

    // 3) If bonus hasn't been claimed, mark it as claimed and redirect to clue
    if (!alreadyClaimed) {
      await env.TOKENS.put(bonusKey, 'claimed', { expirationTtl: 21600 }); // Set TTL for 6 hours
      const clueUrl = await getClueUrl(tag, env);
      return Response.redirect(clueUrl, 302);
    } else {
      // Bonus already claimed, redirect to clue with bonusClaimed=true
      const clueUrl = await getClueUrl(tag, env);
      return Response.redirect(clueUrl + '?bonusClaimed=true', 302);
    }
  }

  // Default page if not eligible for bonus
  return new Response(htmlPage('Keep scrolling…', group, tag));
};

// Helper function to fetch clue URL from links.json
async function getClueUrl(tag: string, env: Env): Promise<string> {
  const links = await fetch(`${env.URL}/data/links.json`).then(r => r.json());
  return links[`clue${tag}`];
}

// Helper function to parse a CSV string into an array of numbers
function parseCsvNums(v?: string) {
  return (v || "").split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

// Helper function to generate the HTML page content
function htmlPage(message: string, group: string, tag: string) {
  return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Explorer’s Reward</title>
      <link rel="stylesheet" href="/assets/css/style.css">
    </head>
    <body class="wrap center">
      <h2>${message}</h2>
      <div style="height:2000px"></div>
      <a href="#" class="btn">🎉 Claim Bonus</a>
    </body>
    </html>
  `;
}
