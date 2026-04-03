/**
 * P4 Memory Archive · Supabase API Routes
 * Column names match actual Supabase schema (verified from SQL Editor screenshots).
 *
 * Env vars:
 *   SUPABASE_URL       https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY  anon/public key (read-only — fine for dashboard)
 *
 * Install: npm install @supabase/supabase-js
 *
 * Register in index.js:
 *   require('./routes/supabase-routes')(app);
 */

const { createClient } = require("@supabase/supabase-js");



function sendError(res, msg, status = 500) {
  console.error("[supabase-routes]", msg);
  res.status(status).json({ error: msg });
}

function parseQuery(q) {
  return {
    limit:  Math.min(parseInt(q.limit)  || 500, 1000),
    order:  q.order  || null,
    asc:    q.dir === "asc",
    year:   q.year   ? parseInt(q.year) : null,
    search: q.search || null,
  };
}

module.exports = function (app) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // ── PMA Approvals ──────────────────────────────────────────────────────────
  // Columns: id, applicant, brand_name, generic_name, product_code,
  //          decision_code, decision_date, advisory_committee
  app.get("/api/pma", async (req, res) => {
    try {
      const { limit, order, asc, year, search } = parseQuery(req.query);
      let q = supabase
        .from("pma_approvals")
        .select("id, applicant, device_name, product_code, decision_code, decision_date, advisory_committee, supplement_number")
        .limit(limit)
        .order(order || "decision_date", { ascending: asc });

      if (year) q = q.gte("decision_date", `${year}-01-01`).lte("decision_date", `${year}-12-31`);
      if (search) q = q.or(`applicant.ilike.%${search}%,brand_name.ilike.%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      res.json({ total: data.length, results: data });
    } catch (err) { sendError(res, err.message); }
  });

  app.get("/api/pma/stats/by-year", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("pma_approvals")
        .select("decision_date");
      if (error) throw error;

      const byYear = {};
      for (const r of data) {
        if (!r.decision_date) continue;
        const y = r.decision_date.substring(0, 4);
        byYear[y] = (byYear[y] || 0) + 1;
      }
      const results = Object.entries(byYear)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, count]) => ({ year, count }));
      res.json({ results });
    } catch (err) { sendError(res, err.message); }
  });

  app.get("/api/pma/stats/top-applicants", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const { data, error } = await supabase.from("pma_approvals").select("applicant");
      if (error) throw error;

      const counts = {};
      for (const r of data) {
        if (!r.applicant) continue;
        counts[r.applicant] = (counts[r.applicant] || 0) + 1;
      }
      const results = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([applicant, count]) => ({ applicant, count }));
      res.json({ results });
    } catch (err) { sendError(res, err.message); }
  });


  // ── MAUDE Events ───────────────────────────────────────────────────────────
  // Columns: id, manufacturer, brand_name, product_code,
  //          event_type, date_received, device_problem, report_number, inserted_at
  app.get("/api/maude", async (req, res) => {
    try {
      const { limit, order, asc, year, search } = parseQuery(req.query);
      let q = supabase
        .from("maude_events")
        .select("id, manufacturer, brand_name, product_code, event_type, date_received, device_problem, report_number")
        .limit(limit)
        .order(order || "date_received", { ascending: asc });

      if (year) q = q.gte("date_received", `${year}-01-01`).lte("date_received", `${year}-12-31`);
      if (search) q = q.or(`manufacturer.ilike.%${search}%,brand_name.ilike.%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      res.json({ total: data.length, results: data });
    } catch (err) { sendError(res, err.message); }
  });

  app.get("/api/maude/stats/by-month", async (req, res) => {
    try {
      const months = parseInt(req.query.months) || 24;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);

      const { data, error } = await supabase
        .from("maude_events")
        .select("date_received")
        .gte("date_received", cutoff.toISOString().substring(0, 10));
      if (error) throw error;

      const byMonth = {};
      for (const r of data) {
        if (!r.date_received) continue;
        const m = r.date_received.substring(0, 7);
        byMonth[m] = (byMonth[m] || 0) + 1;
      }
      const results = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));
      res.json({ results });
    } catch (err) { sendError(res, err.message); }
  });

  app.get("/api/maude/stats/top-manufacturers", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const { data, error } = await supabase.from("maude_events").select("manufacturer");
      if (error) throw error;

      const counts = {};
      for (const r of data) {
        if (!r.manufacturer) continue;
        counts[r.manufacturer] = (counts[r.manufacturer] || 0) + 1;
      }
      const results = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([manufacturer, count]) => ({ manufacturer, count }));
      res.json({ results });
    } catch (err) { sendError(res, err.message); }
  });


  // ── Recalls ────────────────────────────────────────────────────────────────
  // Columns: id, recalling_firm, device_name, product_code,
  //          classification, date_initiated, reason, status, inserted_at
  app.get("/api/recalls", async (req, res) => {
    try {
      const { limit, order, asc, year, search } = parseQuery(req.query);
      let q = supabase
        .from("recalls")
        .select("id, recalling_firm, device_name, product_code, classification, date_initiated, reason, status")
        .limit(limit)
        .order(order || "date_initiated", { ascending: asc });

      if (year) q = q.gte("date_initiated", `${year}-01-01`).lte("date_initiated", `${year}-12-31`);
      if (search) q = q.or(`recalling_firm.ilike.%${search}%,device_name.ilike.%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      res.json({ total: data.length, results: data });
    } catch (err) { sendError(res, err.message); }
  });

  app.get("/api/recalls/stats/by-class", async (req, res) => {
    try {
      const { data, error } = await supabase.from("recalls").select("classification");
      if (error) throw error;

      const counts = {};
      for (const r of data) {
        const cls = r.classification || "Unknown";
        counts[cls] = (counts[cls] || 0) + 1;
      }
      const results = Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([classification, count]) => ({ classification, count }));
      res.json({ results });
    } catch (err) { sendError(res, err.message); }
  });


  // ── SaMD Events ────────────────────────────────────────────────────────────
  // Columns: same shape as maude_events
  app.get("/api/samd", async (req, res) => {
    try {
      const { limit, order, asc, year, search } = parseQuery(req.query);
      let q = supabase
        .from("samd_events")
        .select("id, manufacturer, brand_name, product_code, event_type, date_received, device_problem, report_number")
        .limit(limit)
        .order(order || "date_received", { ascending: asc });

      if (year) q = q.gte("date_received", `${year}-01-01`).lte("date_received", `${year}-12-31`);
      if (search) q = q.or(`manufacturer.ilike.%${search}%,brand_name.ilike.%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      res.json({ total: data.length, results: data });
    } catch (err) { sendError(res, err.message); }
  });


  // ── DB Health — row counts for all 4 tables ────────────────────────────────
  app.get("/api/db/health", async (req, res) => {
    try {
      const tables = ["pma_approvals", "maude_events", "recalls", "samd_events"];
      const counts = {};
      await Promise.all(tables.map(async (t) => {
        const { count, error } = await supabase
          .from(t)
          .select("*", { count: "exact", head: true });
        counts[t] = error ? `error: ${error.message}` : count;
      }));
      res.json({ status: "ok", counts, timestamp: new Date().toISOString() });
    } catch (err) { sendError(res, err.message); }
  });

};
