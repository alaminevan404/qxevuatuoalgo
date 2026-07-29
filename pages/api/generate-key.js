import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_SECRET_KEY = process.env.API_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * POST /api/generate-key
 * Headers: x-api-key === process.env.API_SECRET_KEY
 * Body: { max_devices, expires_days, created_by }
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const providedKey = req.headers["x-api-key"] || req.headers["X-API-KEY"];
    if (!API_SECRET_KEY || !providedKey || providedKey !== API_SECRET_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { max_devices = 1, expires_days = 30, created_by = null } = req.body || {};

    const rawKey = uuidv4().replace(/-/g, "").substring(0, 16).toUpperCase();
    const licence_key = rawKey;
    const created_at = new Date();
    const expires_at = expires_days
      ? new Date(Date.now() + Number(expires_days) * 24 * 60 * 60 * 1000)
      : null;

    const insertPayload = {
      licence_key,
      max_devices: Number(max_devices) || 1,
      used_devices: 0,
      is_active: true,
      created_at: created_at.toISOString(),
      expires_at: expires_at ? expires_at.toISOString() : null,
      created_by: created_by || null,
    };

    const { data, error } = await supabaseAdmin.from("users").insert(insertPayload).select().single();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ success: false, message: error.message || "DB insert error" });
    }

    return res.status(200).json({
      success: true,
      licence_key: data.licence_key,
      created_at: data.created_at || created_at.toISOString(),
      expires_at: data.expires_at || expires_at?.toISOString() || null,
      max_devices: data.max_devices,
    });
  } catch (err) {
    console.error("Unexpected error in /api/generate-key:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
