import { useEffect, useState } from "react";

const cards = [
  ["🤖", "Análise inteligente", "Claude opcional com análise local de contingência"],
  ["✨", "OpenAI", "Geração de imagens configurada exclusivamente no servidor"],
  ["🚀", "Kommo", "Leads, contatos e pipelines sincronizados pelo AdAnalyzer OS"],
  ["🔗", "Kondado", "Google Ads, Meta Ads e GA4 replicados no PostgreSQL"],
  ["💰", "Financeiro", "Vendas sincronizadas do sistema de agendamento"],
];

export default function Integrations() {
  const [status, setStatus] = useState("Verificando...");

  useEffect(() => {
    for (const key of [
      "nexus_openai_key",
      "nexus_kommo_domain",
      "nexus_kommo_token",
      "nexus_kondado_token",
      "nexus_mailing_ckey",
      "claude_api_key",
    ]) localStorage.removeItem(key);

    fetch("/api/status")
      .then((response) => response.json())
      .then((data) => setStatus(data.status === "ready" || data.ok ? "Servidor conectado" : "Servidor degradado"))
      .catch(() => setStatus("Servidor indisponível"));
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#080c14", minHeight: "100vh", color: "#e2e8f0" }}>
      <div style={{ background: "#0d1520", borderBottom: "1px solid #1e2a3a", padding: "0 28px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#f97316)", display: "flex", alignItems: "center", justifyContent: "center" }}>⚙️</div>
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.06em" }}>INTEGRAÇÕES</span>
        <span style={{ marginLeft: "auto", color: status.includes("conectado") ? "#10b981" : "#f59e0b", fontSize: 12 }}>● {status}</span>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ background: "#0d1520", border: "1px solid #1e2a3a", borderRadius: 12, padding: 16, marginBottom: 18, color: "#94a3b8", fontSize: 13 }}>
          As credenciais são administradas no Railway e nunca ficam salvas no navegador.
        </div>
        {cards.map(([icon, title, subtitle]) => (
          <div key={title} style={{ display: "flex", alignItems: "center", gap: 14, background: "#0d1520", border: "1px solid #1e2a3a", borderRadius: 14, padding: 18, marginBottom: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "#1e2a3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{subtitle}</div>
            </div>
            <span style={{ color: "#10b981", fontSize: 12 }}>● Backend</span>
          </div>
        ))}
      </div>
    </div>
  );
}
