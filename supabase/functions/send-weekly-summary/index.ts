import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM = Deno.env.get("MAIL_FROM") || "illustrations@cyrillesethi.com";
const SITE = "https://avantpost-cpu.github.io/lazlo/";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://htkkbudgjwomxpwzirow.supabase.co";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function getRows(table: string, query = ""): Promise<any[]> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!res.ok) throw new Error(`Unable to read ${table}: ${res.status} ${await res.text()}`);
  return await res.json();
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })
    .format(new Date(date + "T12:00:00Z"));
}

async function fillDashboard(html: string): Promise<string> {
  const [checks, events, formations] = await Promise.all([
    getRows("checklist_items", "&order=id.asc"),
    getRows("events", "&order=event_date.asc"),
    getRows("formations")
  ]);
  const pending = checks.filter((x) => !x.completed).map((x) => String(x.label || "")).filter(Boolean);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const upcoming: { date: string; label: string }[] = [];
  for (const e of events) {
    if (typeof e.event_date === "string" && e.event_date >= today)
      upcoming.push({ date: e.event_date, label: String(e.label || e.kind || "Échéance") });
  }
  for (const f of formations) {
    const name = String(f.name || f.school || "Formation");
    for (const [field, label] of [["jpo", "Journée portes ouvertes"], ["immersion", "Immersion"]] as const) {
      if (typeof f[field] === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(f[field]) && f[field] >= today)
        upcoming.push({ date: f[field], label: `${label} — ${name}` });
    }
  }
  // Vacances scolaires zone C : mêmes dates que sur le calendrier du site.
  const holidays = [
    { date: "2026-10-17", end: "2026-11-02", label: "Vacances de la Toussaint" },
    { date: "2026-12-19", end: "2027-01-04", label: "Vacances de Noël" },
    { date: "2027-02-06", end: "2027-02-22", label: "Vacances d’hiver" },
    { date: "2027-04-03", end: "2027-04-19", label: "Vacances de printemps" },
    { date: "2027-07-03", end: "", label: "Vacances d’été" }
  ];
  for (const holiday of holidays) {
    if (holiday.end && holiday.end < today) continue;
    const dates = holiday.end
      ? `du ${formatDate(holiday.date)} au ${formatDate(holiday.end)}`
      : `à partir du ${formatDate(holiday.date)}`;
    upcoming.push({
      date: holiday.date < today ? today : holiday.date,
      label: `${holiday.label} — ${dates}`
    });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];
  const values: Record<string, string> = {
    "[WEEK_FOCUS]": pending.length ? `${pending.length} tâche${pending.length > 1 ? "s" : ""} à terminer sur ${checks.length}.` : "Toutes les tâches de la checklist sont terminées.",
    "[PRIORITY_FOCUS]": pending.length ? escapeHtml(pending[0]) : "Aucune priorité en attente.",
    "[NEXT_DEADLINE]": next ? `${escapeHtml(next.label)} — ${formatDate(next.date)}` : "Aucune échéance à venir enregistrée.",
    "[UPCOMING_FOCUS]": upcoming.length > 1 ? upcoming.slice(1, 3).map(x => `${escapeHtml(x.label)} (${formatDate(x.date)})`).join(" · ") : "Aucun autre événement à venir enregistré.",
    "[TODO_ITEMS]": pending.length ? pending.slice(0, 3).map(x => `<li>${escapeHtml(x)}</li>`).join("") : "<li>Aucune action supplémentaire à prévoir.</li>",
    "[IMPORTANT_REMINDER]": ""
  };
  for (const [marker, value] of Object.entries(values)) html = html.replaceAll(marker, value);
  return html;
}

async function renderDrawings(): Promise<string> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  const folders = ["Projets", "Experimentations", "Portfolio", "A-classer", "Lavis"];
  const items: { path: string; created: string }[] = [];
  for (const folder of folders) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/croquis`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: folder + "/", limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } })
    });
    if (!res.ok) { console.error("Storage folder unavailable", folder, res.status); continue; }
    const files = await res.json();
    for (const file of files) {
      if (file.id && /\.(png|jpe?g|webp|gif)$/i.test(file.name))
        items.push({ path: folder + "/" + file.name, created: file.created_at || file.updated_at || "" });
    }
  }
  const latest = items.sort((a, b) => b.created.localeCompare(a.created)).slice(0, 4);
  if (!latest.length) return "";
  const cells = latest.map(x => {
    const path = x.path.split("/").map(encodeURIComponent).join("/");
    const url = escapeHtml(`${SUPABASE_URL}/storage/v1/object/public/croquis/${path}`);
    return `<td width="50%" style="padding:6px;vertical-align:top"><a href="${url}"><img src="${url}" alt="Dessin de Lazlo" width="280" style="display:block;width:100%;height:auto;border:0"></a></td>`;
  });
  let rows = "";
  for (let i = 0; i < cells.length; i += 2) rows += `<tr>${cells[i]}${cells[i + 1] || "<td></td>"}</tr>`;
  return `<div style="padding:22px 34px;border-top:1px solid #bdb9b1"><h2 style="font-size:19px;font-weight:400">Les derniers dessins</h2><table role="presentation" width="100%" style="border-collapse:collapse"><tbody>${rows}</tbody></table><p><a href="${SITE}croquis.html">Voir tous les croquis →</a></p></div>`;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
    const body = await req.json().catch(() => ({}));
    const subject = body.subject || "Tableau de bord — cette semaine";
    const configuredRecipients = (Deno.env.get("MAIL_TO") || "illustrations@cyrillesethi.com").split(",").map(x => x.trim()).filter(Boolean);
    const recipients = body.to ? (Array.isArray(body.to) ? body.to : [body.to]) : configuredRecipients;
    let html = body.html;
    if (!html) {
      const templateResponse = await fetch(SITE + "mailing-hebdomadaire.html", { headers: { "Cache-Control": "no-cache" } });
      if (!templateResponse.ok) throw new Error("Unable to load the mailing template");
      html = await templateResponse.text();
    }
    const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date());
    html = html.replaceAll("[DATE DU JOUR]", date);
    html = await fillDashboard(html);
    if (html.includes("[DERNIERS_DESSINS]")) html = html.replaceAll("[DERNIERS_DESSINS]", await renderDrawings());
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: recipients, subject, html })
    });
    const result = await response.json();
    return Response.json(result, { status: response.status });
  } catch (error) {
    console.error("Newsletter error", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
