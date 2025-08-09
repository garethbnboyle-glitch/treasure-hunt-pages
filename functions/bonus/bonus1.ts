export const onRequest: PagesFunction<Env> = async ({ env, request }) => {
  const urlParams = new URL(request.url).searchParams;
  let group = urlParams.get('group');
  const tag = urlParams.get('tag') || "";

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Explorer’s Reward</title>
    <link rel="stylesheet" href="/assets/css/style.css">
  </head>
  <body class="wrap center">
    <h2>Keep scrolling…</h2>
    <div style="height:2000px"></div>
    <a id="claim" class="btn">🎉 Claim Bonus</a>
    <script>
      let group = "${group || ""}";
      const tag = "${tag}";

      if (!group) {
        group = localStorage.getItem('treasure_group');
        if (!group) {
          const returnUrl = location.pathname + location.search;
          location.href = '/setgroup.html?return=' + encodeURIComponent(returnUrl);
        }
      }

      const url = new URL("${env.APP_SCRIPT_URL}");
      url.searchParams.set("group", group);
      url.searchParams.set("tag", tag);
      url.searchParams.set("bonus", "scroll");

      document.getElementById('claim').onclick = () => location.href = url.toString();
    </script>
  </body>
  </html>
  `;

  return new Response(html, { headers: { "content-type": "text/html" } });
};
