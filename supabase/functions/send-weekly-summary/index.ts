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
