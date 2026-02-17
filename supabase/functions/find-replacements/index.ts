import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { required_skill, start_time, end_time, exclude_user_id } = await req.json();

    if (!required_skill || !start_time || !end_time) {
      return new Response(
        JSON.stringify({ error: "required_skill, start_time, and end_time are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Find profiles with matching skill
    const { data: matchingProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name, email, competences")
      .contains("competences", [required_skill]);

    if (profilesError) throw profilesError;

    // Exclude the requesting user
    const candidates = (matchingProfiles || []).filter(
      (p) => p.user_id !== exclude_user_id
    );

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ replacements: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const candidateIds = candidates.map((c) => c.user_id);

    // 2. Find candidates who are unavailable during this time
    const { data: unavailable, error: unavailError } = await supabase
      .from("user_availability")
      .select("user_id")
      .in("user_id", candidateIds)
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (unavailError) throw unavailError;

    const unavailableIds = new Set((unavailable || []).map((u) => u.user_id));

    // 3. Find candidates who already have a replacement_request (as replacement) at this time
    // We check via event date overlap
    const { data: busyReplacements, error: busyError } = await supabase
      .from("replacement_requests")
      .select("replacement_id, events!inner(date)")
      .in("replacement_id", candidateIds)
      .eq("status", "Validé");

    if (busyError) throw busyError;

    const busyIds = new Set(
      (busyReplacements || [])
        .filter((r: any) => {
          // Check if the event date overlaps
          const eventDate = r.events?.date;
          if (!eventDate) return false;
          const reqDate = start_time.slice(0, 10);
          return eventDate === reqDate;
        })
        .map((r: any) => r.replacement_id)
    );

    // 4. Filter available candidates
    const availableCandidates = candidates.filter(
      (c) => !unavailableIds.has(c.user_id) && !busyIds.has(c.user_id)
    );

    return new Response(
      JSON.stringify({
        replacements: availableCandidates.map((c) => ({
          user_id: c.user_id,
          display_name: c.display_name,
          competences: c.competences,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("find-replacements error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
