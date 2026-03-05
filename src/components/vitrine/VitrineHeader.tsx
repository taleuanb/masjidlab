import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import masjidLabLogo from "@/assets/masjidlab-logo.png";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Solutions", href: "#solutions" },
  { label: "Tarifs", href: "#tarifs" },
  { label: "Blog", href: "#blog" },
];

export function VitrineHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-brand-navy/80 backdrop-blur-xl border-b border-brand-cyan/20">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/vitrine" className="flex items-center gap-2.5 shrink-0">
          <img src={masjidLabLogo} alt="MasjidLab" className="h-10 w-10 object-contain drop-shadow-[0_0_12px_hsl(185_73%_57%/0.3)]" />
          <span className="text-white font-bold tracking-tight text-lg">MASJIDLAB</span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="/login"
            className="text-sm font-medium text-brand-cyan hover:text-white transition-colors"
          >
            Connexion
          </a>
          <a href="/setup/identity">
            <Button className="bg-brand-emerald hover:bg-brand-emerald/90 text-white shadow-[0_0_20px_hsl(161_84%_39%/0.3)] hover:shadow-[0_0_30px_hsl(161_84%_39%/0.4)] transition-all">
              Démarrer
            </Button>
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-brand-navy/95 backdrop-blur-xl border-t border-brand-cyan/10 overflow-hidden"
          >
            <div className="px-6 py-6 space-y-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block text-sm font-medium text-white/80 hover:text-white py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <a
                  href="/login"
                  className="block text-sm font-medium text-brand-cyan text-center py-2"
                >
                  Connexion
                </a>
                <a href="/setup/identity" className="block">
                  <Button className="w-full bg-brand-emerald hover:bg-brand-emerald/90 text-white">
                    Démarrer
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
