import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import masjidLabLogo from "@/assets/masjidlab-logo.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, Mail, Loader2, Shield } from "lucide-react";
import { motion } from "framer-motion";

export default function SetupSuccessPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orgStatus, setOrgStatus] = useState<string | null>("pending");
  const [orgName, setOrgName] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, user]);

  // Fetch org status and start polling
  useEffect(() => {
    if (!user) return;

    const fetchOrgStatus = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.org_id) return;

      const { data: org } = await supabase
        .from("organizations")
        .select("status, name")
        .eq("id", profile.org_id)
        .maybeSingle();

      if (org) {
        setOrgStatus(org.status);
        setOrgName(org.name);
        if (org.status === "active") {
          // Org was activated — redirect to dashboard
          navigate("/dashboard", { replace: true });
        }
      }
    };

    fetchOrgStatus();

    // Poll every 10 seconds for status change
    const interval = setInterval(fetchOrgStatus, 10_000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(222 68% 6%)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-brand-cyan" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: "hsl(222 68% 6%)" }}>
      {/* Back link */}
      <div className="px-6 pt-4 pb-2">
        <a href="https://masjidlab.com" className="inline-flex items-center gap-1.5 text-sm font-light text-white/40 hover:text-white/70 transition-colors">
          ← Site Officiel
        </a>
      </div>

      {/* Centered content — no sidebar */}
      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg"
        >
          <Card className="shadow-2xl border-white/10 bg-brand-navy/60 backdrop-blur-xl text-white">
            <CardHeader className="text-center space-y-4 pb-4">
              {/* Logo */}
              <a href="https://masjidlab.com" className="mx-auto block">
                <img
                  src={masjidLabLogo}
                  alt="MasjidLab"
                  className="h-16 w-auto object-contain mix-blend-screen drop-shadow-[0_0_15px_rgba(62,212,226,0.3)]"
                />
              </a>

              {/* Pulsing status icon */}
              <motion.div
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-emerald/10 border border-brand-emerald/20"
                animate={{ scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <CheckCircle2 className="h-10 w-10 text-brand-emerald" />
              </motion.div>

              <CardTitle className="text-2xl font-bold text-white">
                Installation en cours
              </CardTitle>

              {orgName && (
                <p className="text-brand-cyan text-sm font-medium">{orgName}</p>
              )}
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Status card */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                    <Clock className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white mb-1">Validation en cours</p>
                    <p className="text-sm text-white/45 leading-relaxed">
                      Votre infrastructure <span className="font-semibold text-white">MASJIDLAB</span> est en cours 
                      de validation par nos ingénieurs. Délai moyen : <span className="font-semibold text-brand-cyan">24h</span>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10">
                    <Mail className="h-4 w-4 text-brand-cyan" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white mb-1">Notification automatique</p>
                    <p className="text-sm text-white/45 leading-relaxed">
                      Vous recevrez un <span className="font-semibold text-white">accès complet</span> dès 
                      validation. Cette page se met à jour automatiquement.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-emerald/10">
                    <Shield className="h-4 w-4 text-brand-emerald" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white mb-1">Sécurité des données</p>
                    <p className="text-sm text-white/45 leading-relaxed">
                      Vos données sont chiffrées et sécurisées dès maintenant. 
                      Aucune action supplémentaire n'est requise de votre part.
                    </p>
                  </div>
                </div>
              </div>

              {/* Polling indicator */}
              <div className="flex items-center justify-center gap-2 text-white/25 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Vérification automatique en cours…</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
