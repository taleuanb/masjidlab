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
  student_date_naissance: string | null;
  student_niveau: string | null;
  // Parent
  parent_id: string | null; // existing parent profile id (user_id)
  parent_nom: string | null;
  parent_prenom: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  // Enrollment
  class_id: string;
  annee_scolaire: string;
  // Billing
  tarif_mensuel: number;
  billing_cycle: "mensuel" | "trimestriel";
  org_id: string;
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
    if (!body.class_id || !body.org_id || !body.annee_scolaire) {
      throw new Error("Classe, organisation et année scolaire requis");
    }

    // 1. Resolve or create parent
    let parentId: string | null = body.parent_id;

    if (!parentId && body.parent_email) {
      // Check if a profile exists with this email
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", body.parent_email)
        .eq("org_id", body.org_id)
        .maybeSingle();

      if (existingProfile) {
        parentId = existingProfile.user_id;
      }
      // If no existing profile found, parent_id stays null (no ghost profile creation)
    }

    // 2. Check for duplicate enrollment
    const { data: existingStudent } = await supabase
      .from("madrasa_students")
      .select("id")
      .eq("nom", body.student_nom.trim())
      .eq("prenom", body.student_prenom.trim())
      .eq("org_id", body.org_id)
      .maybeSingle();

    if (existingStudent) {
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

    // 3. Insert student
    const studentId = existingStudent?.id;
    let finalStudentId: string;

    if (studentId) {
      finalStudentId = studentId;
      // Update parent if needed
      if (parentId) {
        await supabase
          .from("madrasa_students")
          .update({ parent_id: parentId, niveau: body.student_niveau })
          .eq("id", finalStudentId);
      }
    } else {
      const { data: newStudent, error: studentErr } = await supabase
        .from("madrasa_students")
        .insert({
          nom: body.student_nom.trim(),
          prenom: body.student_prenom.trim(),
          date_naissance: body.student_date_naissance || null,
          niveau: body.student_niveau || null,
          parent_id: parentId,
          org_id: body.org_id,
        })
        .select("id")
        .single();

      if (studentErr) throw new Error(`Erreur création élève: ${studentErr.message}`);
      finalStudentId = newStudent.id;
    }

    // 4. Insert enrollment
    const { data: enrollment, error: enrollErr } = await supabase
      .from("madrasa_enrollments")
      .insert({
        student_id: finalStudentId,
        class_id: body.class_id,
        annee_scolaire: body.annee_scolaire,
        statut: "Actif",
        org_id: body.org_id,
      })
      .select("id")
      .single();

    if (enrollErr) throw new Error(`Erreur création inscription: ${enrollErr.message}`);

    // 5. Generate fees
    const nbFees = body.billing_cycle === "mensuel" ? 10 : 4; // 10 months or 4 quarters
    const feeAmount = body.billing_cycle === "mensuel"
      ? body.tarif_mensuel
      : body.tarif_mensuel * 3; // quarterly = 3 months

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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
