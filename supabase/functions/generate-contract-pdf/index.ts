// generate-contract-pdf
// Ontvangt contract-HTML, stuurt naar Gotenberg (headless Chrome),
// geeft een nette A4-PDF terug als download.
//
// POST body: { html: string, filename?: string }
// Response: application/pdf

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOTENBERG_URL = Deno.env.get("GOTENBERG_URL")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const { html, filename } = await req.json();

    if (!html) {
      return new Response(JSON.stringify({ error: "html is verplicht" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!GOTENBERG_URL) {
      return new Response(JSON.stringify({ error: "GOTENBERG_URL niet ingesteld" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Stuur HTML naar Gotenberg
    const formData = new FormData();
    formData.append(
      "files",
      new Blob([html], { type: "text/html; charset=utf-8" }),
      "index.html"
    );
    // Gebruik @page CSS voor formaat + marges (@media print regels worden actief)
    formData.append("emulatedMediaType", "print");
    formData.append("preferCssPageSize", "true");
    formData.append("printBackground", "true");
    formData.append("scale", "1.0");

    // Maak HTTP client die ook self-signed/wildcard certs accepteert
    // (Gotenberg is een interne service — TLS verificatie niet nodig)
    const httpClient = Deno.createHttpClient({ rejectUnauthorized: false });
    const gotenbergRes = await fetch(
      `${GOTENBERG_URL}/forms/chromium/convert/html`,
      { method: "POST", body: formData, client: httpClient }
    );

    if (!gotenbergRes.ok) {
      const errText = await gotenbergRes.text();
      console.error("[generate-contract-pdf] Gotenberg fout:", errText);
      return new Response(
        JSON.stringify({ error: "PDF generatie mislukt", detail: errText }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const pdfBuffer = await gotenbergRes.arrayBuffer();
    const safeName = (filename || "contract")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    return new Response(pdfBuffer, {
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Content-Length": String(pdfBuffer.byteLength),
      },
    });

  } catch (err: any) {
    console.error("[generate-contract-pdf]", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
