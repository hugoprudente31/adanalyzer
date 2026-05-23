import { useState, useEffect, useRef } from "react";

const PLATFORMS = {
  meta: {
    name: "Meta Ads",
    color: "#0866FF",
    accent: "#19C3FF",
    icon: "⬡",
    metrics: ["Alcance", "Impressões", "Cliques", "CTR", "CPM", "CPC", "ROAS", "Conversões"],
  },
  google: {
    name: "Google Ads",
    color: "#34A853",
    accent: "#FBBC04",
    icon: "◈",
    metrics: ["Impressões", "Cliques", "CTR", "CPC", "CPA", "ROAS", "Conv. Rate", "Quality Score"],
  },
};

const UTM_PARAMS = {
  meta: {
    utm_source: "meta",
    utm_medium: "{{adset.id}}",
    utm_id: "{{campaign.id}}",
    utm_content: "{{ad.id}}",
    utm_campaign: "{{campaign.name}}",
    utm_term: "{{adset.name}}",
  },
  google: {
    utm_source: "google",
    utm_medium: "cpc",
    utm_id: "{campaignid}",
    utm_content: "{adgroupid}",
    utm_campaign: "{campaign}",
    utm_term: "{keyword}",
  },
};

const OBJECTIVES = [
  { id: "awareness", label: "Reconhecimento", icon: "👁", desc: "Alcance e Impressões" },
  { id: "traffic", label: "Tráfego", icon: "🔗", desc: "Cliques e Sessões" },
  { id: "leads", label: "Captação de Leads", icon: "🎯", desc: "CPL Otimizado" },
  { id: "sales", label: "Vendas / ROAS", icon: "💰", desc: "Conversão Direta" },
  { id: "retention", label: "Retenção", icon: "🔄", desc: "Remarketing" },
];

const FUNNEL_STAGES = [
  { id: "topo", label: "TOPO", sublabel: "Descoberta", color: "#6366f1", width: "100%" },
  { id: "meio", label: "MEIO", sublabel: "Consideração", color: "#8b5cf6", width: "72%" },
  { id: "fundo", label: "FUNDO", sublabel: "Decisão", color: "#a855f7", width: "48%" },
  { id: "retencao", label: "RETENÇÃO", sublabel: "Fidelização", color: "#c026d3", width: "30%" },
];

const mockCampaigns = [
  { name: "Captação - Topo Frio", platform: "meta", status: "active", budget: 150, spent: 97.4, impressions: 48200, clicks: 892, ctr: 1.85, cpc: 1.09, conversions: 23, cpa: 4.23, roas: 3.8 },
  { name: "Remarketing 3-7 dias", platform: "meta", status: "active", budget: 80, spent: 55.2, impressions: 19400, clicks: 612, ctr: 3.15, cpc: 0.90, conversions: 41, cpa: 1.35, roas: 6.2 },
  { name: "Pesquisa - Marca", platform: "google", status: "active", budget: 60, spent: 38.7, impressions: 8900, clicks: 534, ctr: 6.0, cpc: 0.72, conversions: 28, cpa: 1.38, roas: 5.9 },
  { name: "Performance Max", platform: "google", status: "active", budget: 200, spent: 144.8, impressions: 91000, clicks: 1820, ctr: 2.0, cpc: 0.79, conversions: 67, cpa: 2.16, roas: 4.7 },
  { name: "Lookalike 1% - Compradores", platform: "meta", status: "paused", budget: 100, spent: 12.3, impressions: 6100, clicks: 118, ctr: 1.93, cpc: 1.04, conversions: 4, cpa: 3.08, roas: 2.1 },
];

// Particle system component
function ParticleField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${p.alpha})`;
        ctx.fill();
      });
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach((b) => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(99,102,241,${0.08 * (1 - d / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

// Sparkline mini chart
function Sparkline({ data, color }) {
  const w = 80, h = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={pts.split(" ").at(-1).split(",")[0]} cy={pts.split(" ").at(-1).split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}

export default function QuantumTrafficSystem() {
  const [activePlatform, setActivePlatform] = useState("meta");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedObjective, setSelectedObjective] = useState("leads");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [utmBuilt, setUtmBuilt] = useState("");
  const [utmBase, setUtmBase] = useState("https://seusite.com.br/pagina");
  const [copiedUtm, setCopiedUtm] = useState(false);
  const [budgetTotal, setBudgetTotal] = useState(590);
  const [budgetSplit, setBudgetSplit] = useState({ topo: 40, meio: 30, fundo: 20, retencao: 10 });

  const platform = PLATFORMS[activePlatform];
  const filteredCampaigns = mockCampaigns.filter(c => c.platform === activePlatform);
  const totalSpent = filteredCampaigns.reduce((s, c) => s + c.spent, 0);
  const totalConversions = filteredCampaigns.reduce((s, c) => s + c.conversions, 0);
  const avgRoas = (filteredCampaigns.reduce((s, c) => s + c.roas, 0) / filteredCampaigns.length).toFixed(1);

  const buildUtm = () => {
    const params = UTM_PARAMS[activePlatform];
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    setUtmBuilt(`${utmBase}?${qs}`);
  };

  const copyUtm = () => {
    navigator.clipboard.writeText(utmBuilt);
    setCopiedUtm(true);
    setTimeout(() => setCopiedUtm(false), 2000);
  };

  const runAiAnalysis = async (context) => {
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const prompt = context || `Analise as seguintes campanhas de ${platform.name} e forneça um diagnóstico quântico com: 
1. Score geral (0-100) com emoji de status
2. Top 3 pontos críticos de otimização
3. Distribuição de budget recomendada por funil (%)
4. Próximas ações táticas (bullet points curtos)
5. Alerta de oportunidades inexploradas

Dados das campanhas:
${JSON.stringify(filteredCampaigns, null, 2)}

Objetivo atual: ${selectedObjective}
Budget total: R$${budgetTotal}
Plataforma: ${platform.name}

Responda em Português do Brasil, de forma direta e técnica. Use emojis estrategicamente. Seja específico nos números.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      setAiAnalysis(data.content?.[0]?.text || "Erro ao obter análise.");
    } catch (e) {
      setAiAnalysis("❌ Erro na conexão com IA. Tente novamente.");
    }
    setAiLoading(false);
  };

  const sparkData = {
    impressions: [42000, 45000, 48000, 44000, 51000, 49000, 48200],
    clicks: [780, 820, 870, 800, 920, 880, 892],
    conversions: [18, 22, 25, 19, 28, 26, 23],
    roas: [3.2, 3.5, 3.9, 3.4, 4.1, 3.8, 3.8],
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "campaigns", label: "Campanhas" },
    { id: "funnel", label: "Funil" },
    { id: "utm", label: "UTM Builder" },
    { id: "ai", label: "🤖 IA Quântica" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#080812", color: "#e2e8f0",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif", position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0f0f1a; } ::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 2px; }
        .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; backdrop-filter: blur(12px); }
        .glow { box-shadow: 0 0 40px rgba(99,102,241,0.15); }
        .tab-btn { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 13px; font-weight: 500; cursor: pointer; padding: 8px 16px; border-radius: 8px; transition: all 0.2s; font-family: inherit; letter-spacing: 0.02em; }
        .tab-btn:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.05); }
        .tab-btn.active { color: #fff; background: rgba(99,102,241,0.25); border: 1px solid rgba(99,102,241,0.4); }
        .plat-btn { border: none; cursor: pointer; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: 600; transition: all 0.25s; font-family: inherit; letter-spacing: 0.05em; }
        .metric-card { position: relative; overflow: hidden; }
        .metric-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--accent, #6366f1), transparent); }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .slide-in { animation: slideIn 0.4s ease; }
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .campaign-row { transition: all 0.2s; cursor: pointer; }
        .campaign-row:hover { background: rgba(99,102,241,0.08) !important; transform: translateX(2px); }
        .budget-slider { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; outline: none; cursor: pointer; }
        .budget-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #6366f1; border: 2px solid #080812; }
        .ai-text { white-space: pre-wrap; line-height: 1.7; font-size: 13.5px; }
        .blink { animation: blink 1s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        input, textarea { outline: none; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .utm-code { font-family: 'Courier New', monospace; font-size: 11px; word-break: break-all; color: #a5b4fc; }
        .obj-card { border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 10px 14px; cursor: pointer; transition: all 0.2s; background: rgba(255,255,255,0.02); }
        .obj-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.08); }
        .obj-card.selected { border-color: #6366f1; background: rgba(99,102,241,0.15); }
        .copy-btn { background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); color: #a5b4fc; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; font-family: inherit; transition: all 0.2s; }
        .copy-btn:hover { background: rgba(99,102,241,0.35); }
        .generate-btn { background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; color: white; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px; font-family: inherit; transition: all 0.2s; letter-spacing: 0.03em; }
        .generate-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.4); }
        .generate-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      `}</style>

      {/* BG particles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        <ParticleField />
        <div style={{ position: "absolute", top: "10%", left: "5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: "15%", right: "8%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", filter: "blur(30px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚛</div>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>QUANTUM TRAFFIC</span>
              <span style={{ fontSize: 10, background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", padding: "2px 7px", borderRadius: 20, letterSpacing: "0.1em" }}>v2.0</span>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>SISTEMA DE GESTÃO DE TRÁFEGO PAGO · META & GOOGLE ADS</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(PLATFORMS).map(([k, v]) => (
              <button key={k} className="plat-btn"
                onClick={() => setActivePlatform(k)}
                style={{ background: activePlatform === k ? v.color : "rgba(255,255,255,0.05)", color: activePlatform === k ? "#fff" : "rgba(255,255,255,0.5)", border: activePlatform === k ? `1px solid ${v.color}` : "1px solid rgba(255,255,255,0.1)" }}>
                {v.icon} {v.name}
              </button>
            ))}
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.02)", padding: 4, borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", width: "fit-content" }}>
          {tabs.map(t => (
            <button key={t.id} className={`tab-btn ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ===== DASHBOARD ===== */}
        {activeTab === "dashboard" && (
          <div className="slide-in">
            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Gasto Total", value: `R$${totalSpent.toFixed(2).replace(".",",")}`, spark: "impressions", trend: "+12%", good: true },
                { label: "Conversões", value: totalConversions, spark: "conversions", trend: "+8%", good: true },
                { label: "ROAS Médio", value: `${avgRoas}x`, spark: "roas", trend: "+0.3x", good: true },
                { label: "CTR Médio", value: `${(filteredCampaigns.reduce((s,c)=>s+c.ctr,0)/filteredCampaigns.length).toFixed(2)}%`, spark: "clicks", trend: "-0.2%", good: false },
              ].map((m, i) => (
                <div key={i} className="card metric-card" style={{ "--accent": platform.color, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", marginBottom: 8 }}>{m.label.toUpperCase()}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>{m.value}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: m.good ? "#34d399" : "#f87171", fontWeight: 600 }}>{m.trend}</span>
                    <Sparkline data={sparkData[m.spark]} color={m.good ? "#34d399" : "#f87171"} />
                  </div>
                </div>
              ))}
            </div>

            {/* Objective Selector */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 14 }}>OBJETIVO DA CAMPANHA</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {OBJECTIVES.map(obj => (
                  <div key={obj.id} className={`obj-card ${selectedObjective === obj.id ? "selected" : ""}`} onClick={() => setSelectedObjective(obj.id)}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{obj.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{obj.label}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{obj.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>BUDGET DIÁRIO TOTAL</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#a5b4fc" }}>R$ {budgetTotal}</div>
              </div>
              <input type="range" min={100} max={2000} value={budgetTotal} onChange={e=>setBudgetTotal(+e.target.value)}
                className="budget-slider" style={{ width: "100%", background: `linear-gradient(to right, #6366f1 ${(budgetTotal-100)/19}%, rgba(255,255,255,0.1) 0%)`, marginBottom: 20 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                {FUNNEL_STAGES.map(s => (
                  <div key={s.id}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>{s.label} — {budgetSplit[s.id]}%</div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${budgetSplit[s.id]}%`, background: s.color, borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: s.color }}>R$ {Math.round(budgetTotal * budgetSplit[s.id] / 100)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== CAMPAIGNS ===== */}
        {activeTab === "campaigns" && (
          <div className="slide-in">
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>CAMPANHAS ATIVAS — {platform.name}</div>
              </div>
              <div>
                {/* Header */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 70px 70px 70px 70px 60px", gap: 12, padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {["Campanha","Budget","Gasto","CTR","CPC","CPA","ROAS","Status"].map(h => (
                    <div key={h} style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", fontWeight: 600 }}>{h}</div>
                  ))}
                </div>
                {mockCampaigns.filter(c => c.platform === activePlatform).map((c, i) => (
                  <div key={i} className="campaign-row" onClick={() => setSelectedCampaign(c)}
                    style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 70px 70px 70px 70px 60px", gap: 12, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)", background: selectedCampaign?.name === c.name ? "rgba(99,102,241,0.08)" : "transparent" }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>R${c.budget}</div>
                    <div style={{ fontSize: 13 }}>R${c.spent.toFixed(1)}</div>
                    <div style={{ fontSize: 13, color: c.ctr > 2.5 ? "#34d399" : c.ctr < 1.5 ? "#f87171" : "#fbbf24" }}>{c.ctr}%</div>
                    <div style={{ fontSize: 13 }}>R${c.cpc.toFixed(2)}</div>
                    <div style={{ fontSize: 13, color: c.cpa < 2 ? "#34d399" : "#e2e8f0" }}>R${c.cpa.toFixed(2)}</div>
                    <div style={{ fontSize: 13, color: c.roas > 4 ? "#34d399" : c.roas < 3 ? "#f87171" : "#fbbf24", fontWeight: 600 }}>{c.roas}x</div>
                    <div style={{ fontSize: 11 }}>
                      <span className={`status-dot`} style={{ background: c.status === "active" ? "#34d399" : "#f87171" }} />
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>{c.status === "active" ? "Ativo" : "Pausado"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedCampaign && (
              <div className="card slide-in" style={{ padding: 20, marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedCampaign.name}</div>
                  <button className="generate-btn" onClick={() => { setActiveTab("ai"); runAiAnalysis(`Analise especificamente esta campanha e dê recomendações táticas detalhadas:\n${JSON.stringify(selectedCampaign, null, 2)}\n\nIncluir: score de performance, pontos de atenção, sugestões de criativo, ajuste de lance, segmentação.`); }}>
                    🤖 Analisar com IA
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                  {[
                    { l: "Impressões", v: selectedCampaign.impressions.toLocaleString() },
                    { l: "Cliques", v: selectedCampaign.clicks },
                    { l: "Conversões", v: selectedCampaign.conversions },
                    { l: "ROAS", v: `${selectedCampaign.roas}x` },
                  ].map((m, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 16px" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 6, letterSpacing: "0.06em" }}>{m.l.toUpperCase()}</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== FUNNEL ===== */}
        {activeTab === "funnel" && (
          <div className="slide-in">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 20 }}>ARQUITETURA DO FUNIL QUÂNTICO</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  {FUNNEL_STAGES.map((s, i) => (
                    <div key={s.id} style={{ width: s.width, transition: "width 0.5s" }}>
                      <div style={{ background: s.color, borderRadius: 8, padding: "12px 16px", opacity: 0.85 + i * 0.04 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>{s.label}</div>
                            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{s.sublabel}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{budgetSplit[s.id]}%</div>
                            <div style={{ fontSize: 10, opacity: 0.7 }}>R${Math.round(budgetTotal*budgetSplit[s.id]/100)}/dia</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 16 }}>ESTRATÉGIA POR ESTÁGIO</div>
                {[
                  { stage: "TOPO", color: "#6366f1", items: ["Públicos frios — Interesses amplos", "Lookalike 5-10%", "Vídeo de conscientização", "CPM como métrica principal"] },
                  { stage: "MEIO", color: "#8b5cf6", items: ["Visitantes do site 7-30 dias", "Engajadores de vídeo 25-75%", "Lookalike 1-3% de compradores", "CTR e CPC como foco"] },
                  { stage: "FUNDO", color: "#a855f7", items: ["Remarketing 1-3 dias", "Adicionou ao carrinho", "Oferta direta + urgência", "CPA e ROAS como foco"] },
                  { stage: "RETENÇÃO", color: "#c026d3", items: ["Compradores 30-180 dias", "Upsell e cross-sell", "LTV e repeat purchase", "Audiências de valor"] },
                ].map(s => (
                  <div key={s.stage} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 6, letterSpacing: "0.06em" }}>{s.stage}</div>
                    {s.items.map((item, i) => (
                      <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 3, paddingLeft: 12, borderLeft: `1px solid ${s.color}40` }}>→ {item}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== UTM BUILDER ===== */}
        {activeTab === "utm" && (
          <div className="slide-in">
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 20 }}>UTM BUILDER — {platform.name.toUpperCase()}</div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, letterSpacing: "0.04em" }}>URL BASE</div>
                <input value={utmBase} onChange={e => setUtmBase(e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13 }}
                  placeholder="https://seusite.com.br/pagina" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {Object.entries(UTM_PARAMS[activePlatform]).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 6, letterSpacing: "0.06em" }}>{k.toUpperCase()}</div>
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 12px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#a5b4fc" }}>{v}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button className="generate-btn" onClick={buildUtm} style={{ marginBottom: 16 }}>⚡ Gerar URL com UTM</button>

              {utmBuilt && (
                <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#a5b4fc", letterSpacing: "0.06em" }}>URL GERADA</div>
                    <button className="copy-btn" onClick={copyUtm}>{copiedUtm ? "✓ Copiado!" : "Copiar"}</button>
                  </div>
                  <div className="utm-code">{utmBuilt}</div>
                </div>
              )}

              <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 12 }}>COMO USAR NO {platform.name.toUpperCase()}</div>
                {activePlatform === "meta" ? (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
                    1. No Gerenciador de Anúncios, acesse o anúncio<br/>
                    2. Em "URL do site", cole a URL base<br/>
                    3. Em "Parâmetro de URL", cole os parâmetros UTM gerados<br/>
                    4. Os macros {`{{campaign.id}}`}, {`{{adset.id}}`} e {`{{ad.id}}`} são preenchidos automaticamente pelo Meta
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
                    1. No Google Ads, acesse o anúncio ou a campanha<br/>
                    2. Em "Sufixo de URL final", cole os parâmetros gerados<br/>
                    3. Os ValueTrack {`{campaignid}`}, {`{adgroupid}`}, {`{keyword}`} são preenchidos automaticamente<br/>
                    4. Ative rastreamento automático de tags para dados completos no GA4
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== AI ANALYSIS ===== */}
        {activeTab === "ai" && (
          <div className="slide-in">
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 4 }}>IA QUÂNTICA — DIAGNÓSTICO DE TRÁFEGO</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Análise inteligente das campanhas com Claude AI</div>
                </div>
                <button className="generate-btn" onClick={() => runAiAnalysis(null)} disabled={aiLoading}>
                  {aiLoading ? "⏳ Analisando..." : "🚀 Rodar Diagnóstico"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "Plataforma", value: platform.name, icon: platform.icon },
                  { label: "Objetivo", value: OBJECTIVES.find(o=>o.id===selectedObjective)?.label, icon: OBJECTIVES.find(o=>o.id===selectedObjective)?.icon },
                  { label: "Budget Diário", value: `R$ ${budgetTotal}`, icon: "💰" },
                ].map((m, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{m.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {aiLoading && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }} className="pulse">⚛️</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Processando dados quânticos<span className="blink">_</span></div>
                </div>
              )}

              {aiAnalysis && !aiLoading && (
                <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 11, color: "#a5b4fc", letterSpacing: "0.08em", marginBottom: 14 }}>📊 RELATÓRIO QUÂNTICO</div>
                  <div className="ai-text" style={{ color: "rgba(255,255,255,0.8)" }}>{aiAnalysis}</div>
                </div>
              )}

              {!aiAnalysis && !aiLoading && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.2)" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⚛</div>
                  <div style={{ fontSize: 13 }}>Clique em "Rodar Diagnóstico" para iniciar a análise</div>
                </div>
              )}
            </div>

            {/* Quick analysis buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {[
                { label: "🎯 Análise de Segmentação", prompt: `Como especialista em ${platform.name}, analise as audiências e segmentações ideais para o objetivo de "${selectedObjective}" com budget de R$${budgetTotal}/dia. Plataforma: ${platform.name}. Dê recomendações específicas de públicos, idades, interesses e lookalikes. Seja técnico e direto.` },
                { label: "🎨 Estratégia de Criativos", prompt: `Crie uma estratégia completa de criativos para ${platform.name} com objetivo de "${selectedObjective}". Inclua: formatos recomendados, estrutura de copy (gancho, corpo, CTA), ratio de imagens/vídeos, e dicas específicas para o algoritmo atual. Budget: R$${budgetTotal}/dia.` },
                { label: "📈 Plano de Escala", prompt: `Desenvolva um plano de escalonamento para campanhas de ${platform.name} com objetivo "${selectedObjective}" e budget atual de R$${budgetTotal}/dia. Inclua: critérios para escalar, percentuais de aumento, quando pausar, como duplicar campanhas vencedoras e metas por fase.` },
              ].map((q, i) => (
                <button key={i} onClick={() => runAiAnalysis(q.prompt)} disabled={aiLoading}
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px", color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s", lineHeight: 1.4 }}
                  onMouseEnter={e => { e.target.style.borderColor="rgba(99,102,241,0.4)"; e.target.style.background="rgba(99,102,241,0.08)"; }}
                  onMouseLeave={e => { e.target.style.borderColor="rgba(255,255,255,0.07)"; e.target.style.background="rgba(255,255,255,0.03)"; }}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em" }}>
          QUANTUM TRAFFIC SYSTEM · POWERED BY CLAUDE AI · META & GOOGLE ADS
        </div>
      </div>
    </div>
  );
}
