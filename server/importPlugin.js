import { importChordUrl } from "./chordImport.js";

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function handleImport(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: 'Use POST with { "url": "..." }' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const url = String(body.url || "").trim();
    const result = await importChordUrl(url);
    sendJson(res, 200, result);
  } catch (err) {
    const message = err?.message || "Import failed.";
    const status =
      /Missing url|doesn’t look like|Supported sites|Only |No chord|not valid JSON|layout may have changed|Official\/Pro|free “Chords”|returned \d+|Could not find/i.test(
        message
      )
        ? 400
        : 502;
    sendJson(res, status, { error: message });
  }
}

function mountApi(server) {
  server.middlewares.use(async (req, res, next) => {
    const path = req.url?.split("?")[0];
    // Unified import + keep old UG path working.
    if (path !== "/api/import" && path !== "/api/import-ug") return next();
    await handleImport(req, res);
  });
}

/** Vite plugin: POST /api/import { url } → { text, meta } */
export function chordImportPlugin() {
  return {
    name: "chord-import-api",
    configureServer: mountApi,
    configurePreviewServer: mountApi,
  };
}
