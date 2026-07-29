import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "WARN: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment."
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * POST /api/verify-key
 * Body: { licence_key, device_id }
 *
 * Validations:
 *  - licence exists
 *  - is_active === true
 *  - used_devices < max_devices
 *  - expires_at > now
 *
 * If valid: increment used_devices and return { valid: true, max_devices, expires_at }
 * If invalid: return { valid: false, message: "reason" }
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { licence_key, device_id } = req.body || {};

    if (!licence_key) {
      return res
        .status(400)
        .json({ valid: false, message: "licence_key is required" });
    }

    // Fetch the licence row
    const { data: user, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("licence_key,is_active,max_devices,used_devices,expires_at")
      .eq("licence_key", licence_key)
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Supabase fetch error:", fetchError);
    }

    if (!user) {
      return res
        .status(200)
        .json({ valid: false, message: "Licence key not found" });
    }

    if (!user.is_active) {
      return res
        .status(200)
        .json({ valid: false, message: "Licence is deactivated" });
    }

    const now = new Date();
    if (user.expires_at) {
      const exp = new Date(user.expires_at);
      if (isNaN(exp.getTime()) || exp <= now) {
        return res
          .status(200)
          .json({ valid: false, message: "Licence has expired" });
      }
    }

    if (typeof user.used_devices === "number" && typeof user.max_devices === "number") {
      if (user.used_devices >= user.max_devices) {
        return res
          .status(200)
          .json({ valid: false, message: "Device limit exceeded" });
      }
    }

    // Increment used_devices
    const newUsed = (user.used_devices || 0) + 1;
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ used_devices: newUsed })
      .eq("licence_key", licence_key)
      .select("licence_key,max_devices,used_devices,expires_at")
      .limit(1)
      .single();

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res
        .status(500)
        .json({ valid: false, message: "Failed to update device usage" });
    }

    return res.status(200).json({
      valid: true,
      max_devices: updated.max_devices,
      used_devices: updated.used_devices,
      expires_at: updated.expires_at,
    });
  } catch (err) {
    console.error("Unexpected error in /api/verify-key:", err);
    return res.status(500).json({ valid: false, message: "Internal server error" });
  }
}
