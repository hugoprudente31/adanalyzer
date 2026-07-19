import { useState } from "react";
import NexusCRM from "./NexusCRM";
import CarouselStudio from "./CarouselStudio";
import ContentPlanner from "./ContentPlanner";
import Integrations from "./Integrations";

const TABS = [
  { id: "crm",       label: "✦ Nexus CRM",        color: "#f59e0b" },
  { id: "carousel",  label: "⚡ Carousel Studio",  color: "#FF3B3B" },
  { id: "planner",   label: "📊 Content Planner",  color: "#6366f1" },
  { id: "settings",  label: "⚙️ Integrações",      color: "#10b981" },
];

export default function App() {
  const [app, setApp] = useState("crm");
  const active = TABS.find(t => t.id === app);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#080c14", minHeight: "100vh" }}>
      {app === "crm"      && <NexusCRM />}
      {app === "carousel" && <CarouselStudio />}
      {app === "planner"  && <ContentPlanner />}
      {app === "settings" && <Integrations />}

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 4, background: "rgba(13,21,32,0.95)",
        border: "1px solid #1e2a3a", borderRadius: 44, padding: "6px 8px",
        zIndex: 9999, boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        backdropFilter: "blur(12px)",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setApp(t.id)} style={{
            padding: "9px 20px", borderRadius: 30,
            background: app === t.id ? `linear-gradient(135deg,${t.color},${t.color}99)` : "transparent",
            border: "none",
            color: app === t.id ? "#fff" : "#475569",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            transition: "all 0.18s",
            boxShadow: app === t.id ? `0 0 16px ${t.color}44` : "none",
          }}>{t.label}</button>
        ))}
      </div>
    </div>
  );
}
