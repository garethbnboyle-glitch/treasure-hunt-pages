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
    <title>Secret Tap Bonus</title>
    <link rel="stylesheet" href="/assets/css/style.css">
  </head>
  <body class="wrap center">
    <h2>Tap 3 times to claim bonus!</h2>
    <button id="tap" class="btn">Tap me</button>
    <script>
      let taps = 0, need = 3;
      let group = "${group || ""}";
      const tag = "${tag}";

      if (!group) {
        group = localStorage.getItem('treasure_group');
        if (!group) {
          const returnUrl = location.pathname + location.search;
          location.href = '/setgroup.html?return=' + encodeURIComponent(returnUrl);
        }
      }

      const appUrl = new URL("${env.APP_SCRIPT_URL}");

      document.getElementById('tap').onclick = () => {
        if (++taps >= need) {
          appUrl.searchParams.set("group", group);
          appUrl.searchParams.set("tag", tag);
          appUrl.searchParams.set("bonus", "multiTap");
          location.href = appUrl.toString();
        }
      };
    </script>
  </body>
  </html>
  `;

  return new Response(html, { headers: { "content-type": "text/html" } });
};
