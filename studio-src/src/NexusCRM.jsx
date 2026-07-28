import { useState, useRef, useEffect, useMemo } from "react";

const fmt = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR");
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
const fmtRelative = (iso) => {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.round(hours / 24)}d atrás`;
};

const stageColor = (s) => s.isWon ? "#10b981" : s.isLost ? "#ef4444" : "#6366f1";

const Avatar = ({ code, color, size = 36 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: color + "22", border: `1.5px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color, flexShrink: 0 }}>{code}</div>
);

const initials = (name) => (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data;
}

export default function NexusCRM() {
  const [view, setView] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [summary, setSummary] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [activePipelineId, setActivePipelineId] = useState(null);
  const [board, setBoard] = useState(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showSync, setShowSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", text: "Olá! Sou o Nexus AI. Tenho acesso aos dados reais do funil de leads do Kommo e do desempenho de anúncios. Posso analisar o pipeline, identificar riscos e sugerir prioridades. O que você precisa?" }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatRef = useRef();

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [aiMessages]);

  const loadOverview = async () => {
    setLoading(true); setLoadError("");
    try {
      const [s, p, st] = await Promise.all([
        api("/api/kommo/summary"),
        api("/api/kommo/pipelines"),
        api("/api/kommo/status"),
      ]);
      setSummary(s);
      setPipelines(p);
      setSyncStatus(st);
      if (p.length > 0 && !activePipelineId) setActivePipelineId(p[0].id);
    } catch (e) {
      setLoadError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadOverview(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!activePipelineId) return;
    setBoardLoading(true);
    api(`/api/kommo/pipelines/${activePipelineId}/board`)
      .then(setBoard)
      .catch((e) => setLoadError(e.message))
      .finally(() => setBoardLoading(false));
  }, [activePipelineId]);

  const runSync = async () => {
    setSyncing(true); setSyncMsg("Sincronizando com o Kommo (pode levar alguns minutos)...");
    try {
      const result = await api("/api/kommo/sync", { method: "POST" });
      setSyncMsg(`✅ Sincronizado: ${result.pipelines} funis, ${result.contacts} contatos, ${result.leads} leads.`);
      await loadOverview();
      if (activePipelineId) api(`/api/kommo/pipelines/${activePipelineId}/board`).then(setBoard);
    } catch (e) {
      setSyncMsg("❌ " + e.message);
    }
    setSyncing(false);
  };

  const activePipeline = useMemo(() => pipelines.find(p => p.id === activePipelineId), [pipelines, activePipelineId]);

  const crmContext = useMemo(() => {
    if (!summary) return "";
    const pipelineLines = pipelines.map(p => `- ${p.name}: ${p.statuses.length} estágios`).join("\n");
    return `DADOS REAIS DO KOMMO CRM:\nPipeline ativo: ${fmt(summary.activePipelineValue)} (${summary.activeDeals} negócios)\nReceita ganha: ${fmt(summary.wonRevenue)} (${summary.wonDeals} vendas fechadas)\nLeads quentes (atualizados nos últimos 3 dias): ${summary.hotLeads}\nLeads em risco (sem atualização há mais de 14 dias): ${summary.atRiskLeads}\n\nFunis (${pipelines.length} lojas):\n${pipelineLines}`;
  }, [summary, pipelines]);

  const sendToAI = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const msg = aiInput.trim();
    setAiInput("");
    setAiMessages(prev => [...prev, { role: "user", text: msg }]);
    setAiLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tokens: 1000,
          system: `Você é o Nexus AI, copiloto de CRM para uma rede de óticas. Responda de forma concisa e prática, em português. Use **negrito** para destacar. ${crmContext}`,
          messages: aiMessages.filter(m => m.role !== "system").concat({ role: "user", text: msg }).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }))
        })
      });
      const data = await res.json();
      const text = data.content?.map(c => c.text || "").join("") || data.error?.message || "Erro ao processar.";
      setAiMessages(prev => [...prev, { role: "assistant", text }]);
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", text: "Erro de conexão com a IA." }]);
    }
    setAiLoading(false);
  };

  const card = { background: "#0d1520", border: "1px solid #1e2a3a", borderRadius: 14, padding: 20 };
  const sT = { fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 };
  const btnA = { padding: "8px 18px", background: "linear-gradient(135deg,#f59e0b,#f97316)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" };

  if (loading) {
    return <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontFamily: "'DM Sans',sans-serif" }}>Carregando dados reais do Kommo...</div>;
  }

  if (loadError && !summary) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#ef4444", fontFamily: "'DM Sans',sans-serif", gap: 12 }}>
        <div>⚠️ Falha ao carregar dados: {loadError}</div>
        <button onClick={loadOverview} style={btnA}>Tentar novamente</button>
      </div>
    );
  }

  const renderDashboard = () => (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {[
          { label: "Pipeline Ativo", value: fmt(summary.activePipelineValue), sub: `${summary.activeDeals} negócios`, icon: "◈", color: "#f59e0b" },
          { label: "Receita Fechada", value: fmt(summary.wonRevenue), sub: `${summary.wonDeals} negócios ganhos`, icon: "✦", color: "#10b981" },
          { label: "Leads Quentes", value: summary.hotLeads, sub: "atualizados em 3 dias", icon: "⬡", color: "#6366f1" },
          { label: "Em Risco", value: summary.atRiskLeads, sub: "sem atualização há 14+ dias", icon: "◉", color: "#ef4444" },
        ].map(m => (
          <div key={m.label} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>{m.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#f8fafc", lineHeight: 1 }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>{m.sub}</div>
              </div>
              <div style={{ fontSize: 24, color: m.color, opacity: 0.7 }}>{m.icon}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={sT}>Funis por loja</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {pipelines.map(p => (
            <div key={p.id} onClick={() => { setActivePipelineId(p.id); setView("pipeline"); }}
              style={{ background: "#080c14", border: "1px solid #1e2a3a", borderRadius: 10, padding: 16, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#f59e0b55"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e2a3a"}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>{p.name.trim()}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>{p.statuses.length} estágios reais</div>
            </div>
          ))}
        </div>
      </div>
      {syncStatus && (
        <div style={{ fontSize: 11, color: "#334155" }}>
          Última sincronização: {syncStatus.lastSyncAt ? fmtRelative(syncStatus.lastSyncAt) : "nunca"} · {syncStatus.leads} leads · {syncStatus.contacts} contatos no total
        </div>
      )}
    </div>
  );

  const renderPipeline = () => (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {pipelines.map(p => (
            <button key={p.id} onClick={() => setActivePipelineId(p.id)} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: p.id === activePipelineId ? "#1e2a3a" : "transparent",
              border: `1px solid ${p.id === activePipelineId ? "#2d3f52" : "#1e2a3a"}`,
              color: p.id === activePipelineId ? "#f8fafc" : "#475569",
            }}>{p.name.trim()}</button>
          ))}
        </div>
      </div>
      {boardLoading || !board ? (
        <div style={{ color: "#475569", padding: 40, textAlign: "center" }}>Carregando funil...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${activePipeline.statuses.length},minmax(200px,1fr))`, gap: 14, overflowX: "auto", paddingBottom: 12 }}>
          {activePipeline.statuses.map(stage => {
            const sc = stageColor(stage);
            const totals = board.totalsByStatus[stage.id] || { leads: 0, totalPrice: 0 };
            const leads = board.leadsByStatus[stage.id] || [];
            return (
              <div key={stage.id} style={{ background: "#0d1520", borderRadius: 12, padding: 14, border: "1px solid #1e2a3a", minHeight: 300 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${sc}33` }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: sc, letterSpacing: "0.04em" }}>{stage.name}</div>
                    <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>{totals.totalPrice > 0 ? fmt(totals.totalPrice) : ""}</div>
                  </div>
                  <div style={{ width: 22, height: 20, background: sc + "22", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: sc, flexShrink: 0 }}>{totals.leads}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {leads.map(lead => (
                    <div key={lead.id} onClick={() => { setSelectedLead(lead); setView("contacts"); }} style={{ background: "#080c14", borderRadius: 10, padding: 10, border: "1px solid #1e2a3a", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = sc + "55"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "#1e2a3a"}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{lead.name}</div>
                      {lead.price > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{fmt(lead.price)}</div>}
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>{fmtRelative(lead.updatedAt)}</div>
                    </div>
                  ))}
                  {totals.leads > leads.length && (
                    <div style={{ fontSize: 10, color: "#334155", textAlign: "center", padding: "6px 0" }}>+ {totals.leads - leads.length} outros</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderContacts = () => {
    const allLeads = board ? Object.values(board.leadsByStatus).flat() : [];
    return (
      <div style={{ padding: 28 }}>
        <div style={sT}>Leads recentes — {activePipeline?.name.trim()}</div>
        {selectedLead ? (
          <div style={{ maxWidth: 460 }}>
            <button onClick={() => setSelectedLead(null)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12, marginBottom: 14, padding: 0 }}>← Voltar</button>
            <div style={card}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
                <Avatar code={initials(selectedLead.name)} color="#f59e0b" size={48} />
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#f8fafc" }}>{selectedLead.name}</div>
                  {selectedLead.phone && <div style={{ fontSize: 12, color: "#475569" }}>{selectedLead.phone}</div>}
                </div>
              </div>
              {selectedLead.price > 0 && <div style={{ fontSize: 20, fontWeight: 800, color: "#10b981", marginBottom: 12 }}>{fmt(selectedLead.price)}</div>}
              <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 6 }}>
                <div>Criado: {fmtDate(selectedLead.createdAt)}</div>
                <div>Última atualização: {fmtDate(selectedLead.updatedAt)}</div>
                {selectedLead.closedAt && <div>Fechado: {fmtDate(selectedLead.closedAt)}</div>}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allLeads.length === 0 && <div style={{ color: "#475569" }}>Nenhum lead recente neste funil.</div>}
            {allLeads.slice(0, 60).map(lead => (
              <div key={lead.id} onClick={() => setSelectedLead(lead)} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: 16, padding: "14px 18px", background: "#0d1520", borderRadius: 12, border: "1px solid #1e2a3a", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#f59e0b55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1e2a3a"}>
                <Avatar code={initials(lead.name)} color="#6366f1" size={32} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{lead.name}</div>
                  {lead.phone && <div style={{ fontSize: 11, color: "#475569" }}>{lead.phone}</div>}
                </div>
                <div style={{ fontSize: 12, color: "#475569" }}>{fmtRelative(lead.updatedAt)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: lead.price > 0 ? "#10b981" : "#334155" }}>{lead.price > 0 ? fmt(lead.price) : "—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAI = () => (
    <div style={{ padding: 28, height: "calc(100vh - 130px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, background: "#f59e0b", borderRadius: "50%", boxShadow: "0 0 12px #f59e0b88" }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.06em" }}>NEXUS AI COPILOT</div>
        <span style={{ fontSize: 11, color: "#334155" }}>· dados reais do Kommo</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["Quais leads estão em risco?", "Resumo do pipeline por loja", "Qual loja tem melhor conversão?", "Prioridades desta semana"].map(q => (
          <button key={q} onClick={() => setAiInput(q)} style={{ fontSize: 11, padding: "5px 12px", background: "#0d1520", border: "1px solid #1e2a3a", borderRadius: 20, color: "#94a3b8", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#f59e0b44"; e.currentTarget.style.color = "#f59e0b"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2a3a"; e.currentTarget.style.color = "#94a3b8"; }}>{q}</button>
        ))}
      </div>
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 4 }}>
        {aiMessages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            {m.role === "assistant" && <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#f59e0b22", border: "1.5px solid #f59e0b44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>✦</div>}
            <div style={{ maxWidth: "75%", padding: "12px 16px", background: m.role === "user" ? "#1e2a3a" : "#0d1520", borderRadius: m.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px", border: m.role === "user" ? "1px solid #2d3f52" : "1px solid #1e2a3a", fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
              {m.text.split("\n").map((line, j) => {
                const bold = line.replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:#f8fafc">${t}</strong>`);
                return <div key={j} dangerouslySetInnerHTML={{ __html: bold || "&nbsp;" }} style={{ marginBottom: j < m.text.split("\n").length - 1 ? 4 : 0 }} />;
              })}
            </div>
          </div>
        ))}
        {aiLoading && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#f59e0b22", border: "1.5px solid #f59e0b44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✦</div>
            <div style={{ display: "flex", gap: 5, padding: "12px 16px", background: "#0d1520", borderRadius: 14, border: "1px solid #1e2a3a" }}>
              {[0, 1, 2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", animation: `bounce 1.2s ${j * 0.2}s ease-in-out infinite` }} />)}
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16, padding: "12px", background: "#0d1520", borderRadius: 12, border: "1px solid #1e2a3a" }}>
        <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendToAI()} placeholder="Pergunte qualquer coisa sobre seu CRM..." style={{ flex: 1, background: "none", border: "none", color: "#f8fafc", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        <button onClick={sendToAI} disabled={aiLoading || !aiInput.trim()} style={{ padding: "8px 18px", background: aiLoading || !aiInput.trim() ? "#1e2a3a" : "linear-gradient(135deg,#f59e0b,#f97316)", border: "none", borderRadius: 8, color: aiLoading || !aiInput.trim() ? "#334155" : "#fff", fontWeight: 700, fontSize: 13, cursor: aiLoading || !aiInput.trim() ? "not-allowed" : "pointer" }}>Enviar</button>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#080c14", minHeight: "100vh", color: "#f8fafc", display: "flex", flexDirection: "column" }}>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#080c14} ::-webkit-scrollbar-thumb{background:#1e2a3a;border-radius:2px} input::placeholder{color:#334155}`}</style>
      <div style={{ height: 56, background: "#0d1520", borderBottom: "1px solid #1e2a3a", display: "flex", alignItems: "center", paddingInline: 24, gap: 20, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 16 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#f59e0b,#f97316)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✦</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.06em" }}>NEXUS CRM</span>
        </div>
        {[["dashboard", "Visão Geral"], ["pipeline", "Pipeline"], ["contacts", "Leads"], ["ai", "✦ AI Copilot"]].map(([v, label]) => (
          <button key={v} onClick={() => { setView(v); if (v !== "contacts") setSelectedLead(null); }} style={{ padding: "6px 14px", background: view === v ? "#1e2a3a" : "none", border: view === v ? "1px solid #2d3f52" : "1px solid transparent", borderRadius: 8, color: view === v ? "#f8fafc" : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {summary && <div style={{ fontSize: 11, color: "#334155" }}>Pipeline: <span style={{ color: "#f59e0b", fontWeight: 700 }}>{fmt(summary.activePipelineValue)}</span></div>}
        <button onClick={() => { setShowSync(true); setSyncMsg(""); }} style={{ padding: "6px 14px", background: "#1e2a3a", border: "1px solid #2d3f52", borderRadius: 8, color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⟳ Sincronizar</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {view === "dashboard" && renderDashboard()}
        {view === "pipeline" && renderPipeline()}
        {view === "contacts" && renderContacts()}
        {view === "ai" && renderAI()}
      </div>

      {showSync && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#0d1520", border: "1px solid #1e2a3a", borderRadius: 16, padding: 28, width: 420, maxWidth: "92vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>⟳ Sincronizar com o Kommo</div>
              <button onClick={() => setShowSync(false)} style={{ background: "none", border: "none", color: "#475569", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ background: "#080c14", borderRadius: 10, padding: 16, marginBottom: 16, fontSize: 12, color: "#94a3b8" }}>
              <div style={{ marginBottom: 6 }}>Os dados já sincronizam automaticamente todo dia às 03:45.</div>
              {syncStatus && <div style={{ color: "#10b981" }}>✅ {syncStatus.leads} leads · {syncStatus.contacts} contatos · última sync: {fmtRelative(syncStatus.lastSyncAt)}</div>}
            </div>
            {syncMsg && <div style={{ padding: "10px 14px", background: syncMsg.startsWith("✅") ? "#0a2a1a" : "#2a0a0a", border: `1px solid ${syncMsg.startsWith("✅") ? "#10b98133" : "#ef444433"}`, borderRadius: 8, fontSize: 12, color: syncMsg.startsWith("✅") ? "#10b981" : "#ef4444", marginBottom: 14 }}>{syncMsg}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={runSync} disabled={syncing} style={{ flex: 1, padding: "11px", background: syncing ? "#1e2a3a" : "linear-gradient(135deg,#f59e0b,#f97316)", border: "none", borderRadius: 8, color: syncing ? "#475569" : "#fff", fontWeight: 700, fontSize: 13, cursor: syncing ? "wait" : "pointer" }}>
                {syncing ? "Sincronizando..." : "Sincronizar agora"}
              </button>
              <button onClick={() => setShowSync(false)} style={{ padding: "11px 18px", background: "#0a1020", border: "1px solid #1e2a3a", borderRadius: 8, color: "#475569", cursor: "pointer" }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
