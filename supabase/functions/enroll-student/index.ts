import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnrollmentRequest {
  // Student
  student_nom: string;
  student_prenom: string;
  student_niveau: string | null;
  age: number | null;
  gender: string | null;
  level_id: string | null;
  // Parent
  parent_id: string | null;
  parent_nom: string | null;
  parent_prenom: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  // Enrollment
  class_id: string | null; // null = sandbox
  annee_scolaire: string;
  // Billing
  tarif_mensuel: number;
  billing_cycle: "mensuel" | "trimestriel";
  org_id: string;
  // Enriched
  family_id: string | null;
  assessment: { test_score: number | null; notes: string | null } | null;
  preferences: { days: string[]; sibling_priority: boolean } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const body: EnrollmentRequest = await req.json();

    // Validate required fields
    if (!body.student_nom?.trim() || !body.student_prenom?.trim()) {
      throw new Error("Nom et prénom de l'élève requis");
    }
    if (!body.org_id || !body.annee_scolaire) {
      throw new Error("Organisation et année scolaire requis");
    }

    // 1. Resolve or create parent
    let parentId: string | null = body.parent_id;

    if (!parentId && body.parent_email) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", body.parent_email)
        .eq("org_id", body.org_id)
        .maybeSingle();

      if (existingProfile) {
        parentId = existingProfile.user_id;
      }
    }

    // 2. Check for duplicate enrollment
    const { data: existingStudent } = await supabase
      .from("madrasa_students")
      .select("id")
      .eq("nom", body.student_nom.trim())
      .eq("prenom", body.student_prenom.trim())
      .eq("org_id", body.org_id)
      .maybeSingle();

    if (existingStudent && body.class_id) {
      const { data: existingEnroll } = await supabase
        .from("madrasa_enrollments")
        .select("id")
        .eq("student_id", existingStudent.id)
        .eq("class_id", body.class_id)
        .eq("annee_scolaire", body.annee_scolaire)
        .maybeSingle();

      if (existingEnroll) {
        throw new Error("Cet élève est déjà inscrit dans cette classe pour cette année scolaire");
      }
    }

    // 3. Insert or update student
    const studentId = existingStudent?.id;
    let finalStudentId: string;

    if (studentId) {
      finalStudentId = studentId;
      const updatePayload: Record<string, unknown> = {};
      if (parentId) updatePayload.parent_id = parentId;
      if (body.student_niveau) updatePayload.niveau = body.student_niveau;
      if (body.age != null) updatePayload.age = body.age;
      if (body.gender) updatePayload.gender = body.gender;
      if (body.family_id) updatePayload.family_id = body.family_id;
      if (body.assessment) updatePayload.current_assessment = body.assessment;

      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from("madrasa_students")
          .update(updatePayload)
          .eq("id", finalStudentId);
      }
    } else {
      const { data: newStudent, error: studentErr } = await supabase
        .from("madrasa_students")
        .insert({
          nom: body.student_nom.trim(),
          prenom: body.student_prenom.trim(),
          niveau: body.student_niveau || null,
          age: body.age ?? null,
          gender: body.gender || null,
          parent_id: parentId,
          org_id: body.org_id,
          family_id: body.family_id || undefined,
          current_assessment: body.assessment ? body.assessment : {},
        })
        .select("id")
        .single();

      if (studentErr) throw new Error(`Erreur création élève: ${studentErr.message}`);
      finalStudentId = newStudent.id;
    }

    // 4. Determine enrollment status
    const isSandbox = !body.class_id;
    const enrollmentStatut = isSandbox ? "En attente" : "Actif";
    const pedagogicalStatus = isSandbox ? "waiting_placement" : "placed";
    const academicStatus = isSandbox ? "pre_registered" : "enrolled";

    // 5. Insert enrollment
    const { data: enrollment, error: enrollErr } = await supabase
      .from("madrasa_enrollments")
      .insert({
        student_id: finalStudentId,
        class_id: body.class_id || null,
        level_id: body.level_id || null,
        annee_scolaire: body.annee_scolaire,
        statut: enrollmentStatut,
        pedagogical_status: pedagogicalStatus,
        academic_status: academicStatus,
        org_id: body.org_id,
        preferences: body.preferences ? {
          days: body.preferences.days ?? [],
          sibling_priority: body.preferences.sibling_priority ?? false,
        } : { days: [], sibling_priority: false },
      })
      .select("id")
      .single();

    if (enrollErr) throw new Error(`Erreur création inscription: ${enrollErr.message}`);

    // 6. Generate fees
    const nbFees = body.billing_cycle === "mensuel" ? 10 : 4;
    const feeAmount = body.billing_cycle === "mensuel"
      ? body.tarif_mensuel
      : body.tarif_mensuel * 3;

    const fees = [];
    const startMonth = 8; // September (0-indexed: 8 = September)
    const startYear = parseInt(body.annee_scolaire.split("/")[0]) || new Date().getFullYear();

    for (let i = 0; i < nbFees; i++) {
      const monthOffset = body.billing_cycle === "mensuel" ? i : i * 3;
      const dueMonth = startMonth + monthOffset;
      const dueYear = startYear + Math.floor(dueMonth / 12);
      const dueMonthNorm = dueMonth % 12;
      const dueDate = `${dueYear}-${String(dueMonthNorm + 1).padStart(2, "0")}-05`;

      fees.push({
        student_id: finalStudentId,
        amount: feeAmount,
        due_date: dueDate,
        status: "pending",
        org_id: body.org_id,
      });
    }

    const { error: feesErr } = await supabase.from("madrasa_fees").insert(fees);
    if (feesErr) throw new Error(`Erreur génération des frais: ${feesErr.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        student_id: finalStudentId,
        enrollment_id: enrollment.id,
        fees_generated: nbFees,
        sandbox: isSandbox,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
