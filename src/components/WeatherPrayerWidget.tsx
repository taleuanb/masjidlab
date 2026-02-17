import { Cloud, Sun, Droplets, Clock } from "lucide-react";

const PRIERES = [
  { nom: "Fajr", heure: "06:45" },
  { nom: "Dhuhr", heure: "13:15" },
  { nom: "Asr", heure: "16:00" },
  { nom: "Maghrib", heure: "18:22" },
  { nom: "Isha", heure: "19:45" },
];

function getProchainePriere() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (const p of PRIERES) {
    const [h, m] = p.heure.split(":").map(Number);
    if (h * 60 + m > minutes) {
      const diff = h * 60 + m - minutes;
      return { ...p, dans: diff };
    }
  }
  // After Isha → next Fajr
  const [h, m] = PRIERES[0].heure.split(":").map(Number);
  const diff = 24 * 60 - minutes + h * 60 + m;
  return { ...PRIERES[0], dans: diff };
}

function formatCountdown(minutes: number) {
  if (minutes < 60) return `dans ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `dans ${h}h${m > 0 ? `${m.toString().padStart(2, "0")}` : ""}`;
}

export function WeatherPrayerWidget() {
  const prochaine = getProchainePriere();

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card/60 backdrop-blur-sm px-4 py-2.5 text-sm">
      {/* Météo simulée */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="flex items-center gap-1">
          <Sun className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-foreground">12°C</span>
        </div>
        <span className="text-xs flex items-center gap-1">
          <Droplets className="h-3 w-3" />
          45%
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Prochaine prière */}
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{prochaine.nom}</span>
          {" "}à {prochaine.heure}
        </span>
        <span className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
          {formatCountdown(prochaine.dans)}
        </span>
      </div>
    </div>
  );
}
