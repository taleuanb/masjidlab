import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { donor_id, annee_fiscale, org_id } = await req.json();

    if (!donor_id || !annee_fiscale || !org_id) {
      return new Response(
        JSON.stringify({ error: "donor_id, annee_fiscale et org_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate total donations for that donor and year
    const yearStart = `${annee_fiscale}-01-01T00:00:00Z`;
    const yearEnd = `${annee_fiscale}-12-31T23:59:59Z`;

    const { data: donations, error: donError } = await supabaseAdmin
      .from("donations")
      .select("montant")
      .eq("donor_id", donor_id)
      .eq("org_id", org_id)
      .gte("date_don", yearStart)
      .lte("date_don", yearEnd);

    if (donError) throw donError;

    const totalDons = (donations ?? []).reduce((s: number, d: any) => s + Number(d.montant), 0);
    const numeroCerfa = `CERFA-${annee_fiscale}-${Date.now().toString(36).toUpperCase()}`;

    // Insert tax receipt
    const { data: receipt, error: insertError } = await supabaseAdmin
      .from("tax_receipts")
      .insert({
        donor_id,
        annee_fiscale,
        org_id,
        numero_cerfa: numeroCerfa,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ receipt, total_dons: totalDons }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-tax-receipt error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
