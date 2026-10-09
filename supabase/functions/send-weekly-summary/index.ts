import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM = Deno.env.get("MAIL_FROM") || "illustrations@cyrillesethi.com";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const subject = body.subject || "Tableau de bord — cette semaine";
  const configuredRecipients = (Deno.env.get("MAIL_TO") || "illustrations@cyrillesethi.com").split(",").map((email) => email.trim()).filter(Boolean);
  const recipients = body.to ? (Array.isArray(body.to) ? body.to : [body.to]) : configuredRecipients;
  let html = body.html;
  if (!html) {
    const templateResponse = await fetch("https://avantpost-cpu.github.io/lazlo/mailing-hebdomadaire.html");
    if (!templateResponse.ok) {
      return Response.json({ error: "Unable to load the mailing template" }, { status: 500 });
    }
    html = await templateResponse.text();
    const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());
    html = html.replace("[DATE DU JOUR]", date);
  }


  // Ajoute les quatre derniers dessins stockés, toutes rubriques confondues.
  // Rendu côté serveur : les clients e-mail n’exécutent pas JavaScript.
  if (html.includes("[DERNIERS_DESSINS]")) {
    try {
      const supabaseUrl = "https://htkkbudgjwomxpwzirow.supabase.co";
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_f5l2P6t-qHInZIAZEtE34Q_LdQRYhbz";
      const folders = ["Projets", "Experimentations", "Portfolio", "A-classer", "Lavis"];
      const results = await Promise.all(folders.map(async (folder) => {
        const url = supabaseUrl + "/storage/v1/object/list/croquis";
        const res = await fetch(url, {
          method: "POST",
          headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: folder + "/", limit: 100, sortBy: { column: "created_at", order: "desc" } })
        });
        if (!res.ok) throw new Error("Storage listing unavailable: " + folder);
        const items = await res.json();
        return (Array.isArray(items) ? items : []).filter((item: any) => item.id).map((item: any) => ({
          name: folder + "/" + item.name, created: item.created_at || item.updated_at || ""
        }));
      }));
      const latest = results.flat().sort((a, b) => b.created.localeCompare(a.created)).slice(0, 4);
      const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      const cells = latest.map((item) => {
        const publicUrl = supabaseUrl + "/storage/v1/object/public/croquis/" + item.name.split("/").map(encodeURIComponent).join("/");
        return '<td style="width:50%;padding:4px;vertical-align:top"><a href="' + escapeHtml(publicUrl) + '"><img src="' + escapeHtml(publicUrl) + '" alt="Dessin récent" style="display:block;width:100%;height:auto;border:0"></a></td>';
      });
      const rows = [];
      for (let i = 0; i < cells.length; i += 2) rows.push("<tr>" + cells[i] + (cells[i + 1] || '<td style="width:50%"></td>') + "</tr>");
      const section = latest.length
        ? '<div class="drawings" style="padding:22px 34px;border-top:1px solid #bdb9b1"><h2 style="font-size:19px;font-weight:400;margin:0 0 8px">Les derniers dessins</h2><p style="font-size:12px;line-height:1.5;margin:0 0 15px">Les quatre derniers dessins ajoutés au carnet.</p><table role="presentation" style="width:100%;border-collapse:collapse"><tbody>' + rows.join("") + '</tbody></table><p style="margin:14px 0 0"><a class="drawings-link" href="https://avantpost-cpu.github.io/lazlo/croquis.html">Voir tous les croquis →</a></p></div>'
        : "";
      html = html.replace("[DERNIERS_DESSINS]", section);
    } catch (err) {
      console.error("Recent drawings unavailable", err);
      html = html.replace("[DERNIERS_DESSINS]", "");
    }
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: recipients, subject, html }),
  });

  const result = await response.json();
  return Response.json(result, { status: response.status });
});
