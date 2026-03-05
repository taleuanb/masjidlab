import masjidLabLogo from "@/assets/masjidlab-logo.png";

const footerColumns = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "#solutions" },
      { label: "Tarifs", href: "#tarifs" },
      { label: "Changelog", href: "#" },
      { label: "Roadmap", href: "#" },
    ],
  },
  {
    title: "Institution",
    links: [
      { label: "À propos", href: "#" },
      { label: "Blog", href: "#blog" },
      { label: "Partenaires", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "CGU", href: "#" },
      { label: "Confidentialité", href: "#" },
      { label: "Mentions légales", href: "#" },
      { label: "RGPD", href: "#" },
    ],
  },
  {
    title: "Social",
    links: [
      { label: "LinkedIn", href: "#" },
      { label: "Twitter / X", href: "#" },
      { label: "Instagram", href: "#" },
      { label: "YouTube", href: "#" },
    ],
  },
];

export function VitrineFooter() {
  return (
    <footer className="bg-brand-navy border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-brand-cyan mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-white/50 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={masjidLabLogo} alt="MasjidLab" className="h-6 w-6 object-contain" />
            <span className="text-white font-bold text-sm tracking-tight">MASJIDLAB</span>
          </div>
          <p className="text-xs text-white/40 text-center md:text-right leading-relaxed">
            © 2026 MASJIDLAB. L'infrastructure d'excellence pour les institutions musulmanes.
          </p>
        </div>
      </div>
    </footer>
  );
}
