import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BulkRow {
  student: { nom: string; prenom: string; age: number | null; genre: string };
  parent: { nom: string; prenom: string; phone: string; email: string };
  pedagogy: { cycle_name: string; level_name: string };
  rowIndex: number;
}

interface BulkRequest {
  rows: BulkRow[];
  org_id: string;
  academic_year_id: string | null;
  annee_scolaire_label: string;
}

interface RowResult {
  rowIndex: number;
  success: boolean;
  student_id?: string;
  enrollment_id?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const body: BulkRequest = await req.json();

    if (!body.org_id) throw new Error("org_id requis");
    if (!body.annee_scolaire_label) throw new Error("annee_scolaire_label requis");
    if (!Array.isArray(body.rows) || body.rows.length === 0)
      throw new Error("Aucune ligne à traiter");
    if (body.rows.length > 25)
      throw new Error("Maximum 25 lignes par lot");

    // Pre-fetch levels for this org to resolve level_id from level_name
    const { data: levels } = await supabase
      .from("madrasa_levels")
      .select("id, label, tarif_mensuel")
      .eq("org_id", body.org_id);
    const levelMap = new Map(
      (levels ?? []).map((l) => [l.label, { id: l.id, tarif: l.tarif_mensuel ?? 0 }])
    );

    // Pre-fetch existing profiles by phone for parent deduplication
    const phones = body.rows
      .map((r) => r.parent.phone)
      .filter((p) => p.length >= 10);
    const { data: existingProfiles } = await supabase
      .from("profiles")
      .select("id, user_id, phone, display_name")
      .eq("org_id", body.org_id)
      .in("phone", phones.length > 0 ? phones : ["__none__"]);
    const phoneProfileMap = new Map(
      (existingProfiles ?? []).map((p) => [
        p.phone?.replace(/[\s.\-()]/g, "") ?? "",
        p,
      ])
    );

    const results: RowResult[] = [];

    for (const row of body.rows) {
      try {
        // 1. Resolve level_id
        const levelInfo = levelMap.get(row.pedagogy.level_name);
        const levelId = levelInfo?.id ?? null;
        const tarif = levelInfo?.tarif ?? 0;

        // 2. Resolve parent
        const cleanPhone = row.parent.phone.replace(/[\s.\-()]/g, "");
        const existingProfile = phoneProfileMap.get(cleanPhone);
        const parentId = existingProfile?.user_id ?? null;

        // 3. Create student
        const { data: newStudent, error: studentErr } = await supabase
          .from("madrasa_students")
          .insert({
            nom: row.student.nom,
            prenom: row.student.prenom,
            age: row.student.age,
            gender: row.student.genre || null,
            niveau: row.pedagogy.level_name || null,
            parent_id: parentId,
            org_id: body.org_id,
            current_assessment: {},
            statut: "actif",
          })
          .select("id")
          .single();

        if (studentErr)
          throw new Error(`Création élève: ${studentErr.message}`);

        // 4. Create enrollment (Sandbox mode — no class_id)
        const { data: enrollment, error: enrollErr } = await supabase
          .from("madrasa_enrollments")
          .insert({
            student_id: newStudent.id,
            class_id: null,
            level_id: levelId,
            academic_year_id: body.academic_year_id || null,
            annee_scolaire: body.annee_scolaire_label,
            statut: "en_attente",
            org_id: body.org_id,
            preferences: { days: [], sibling_priority: false },
          })
          .select("id")
          .single();

        if (enrollErr)
          throw new Error(`Création inscription: ${enrollErr.message}`);

        // 5. Generate fees (10 monthly instalments)
        if (tarif > 0) {
          const startYear =
            parseInt(body.annee_scolaire_label.split("/")[0]) ||
            new Date().getFullYear();
          const fees = [];
          for (let i = 0; i < 10; i++) {
            const m = 8 + i; // Sept=8
            const y = startYear + Math.floor(m / 12);
            const mn = m % 12;
            fees.push({
              student_id: newStudent.id,
              amount: tarif,
              due_date: `${y}-${String(mn + 1).padStart(2, "0")}-05`,
              status: "pending",
              org_id: body.org_id,
            });
          }
          const { error: feesErr } = await supabase
            .from("madrasa_fees")
            .insert(fees);
          if (feesErr)
            throw new Error(`Génération frais: ${feesErr.message}`);
        }

        results.push({
          rowIndex: row.rowIndex,
          success: true,
          student_id: newStudent.id,
          enrollment_id: enrollment.id,
        });
      } catch (rowErr: unknown) {
        results.push({
          rowIndex: row.rowIndex,
          success: false,
          error:
            rowErr instanceof Error ? rowErr.message : "Erreur inconnue",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        total: results.length,
        successCount,
        failCount,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
