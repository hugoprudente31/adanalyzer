import { useState, useRef } from "react";

const PLATFORMS = [
  { id: "tiktok",    label: "TikTok",    icon: "♪", color: "#ff0050" },
  { id: "instagram", label: "Instagram", icon: "◉", color: "#e1306c" },
  { id: "ambos",     label: "Ambos",     icon: "⚡", color: "#f59e0b" },
];

const FORMATS = {
  tiktok:    ["Vídeo curto (7-15s)", "Dueto", "Stitch", "Trend + Nicho", "POV", "Story Time"],
  instagram: ["Carrossel", "Reels", "Stories", "Collab", "Tutorial", "Antes/Depois"],
  ambos:     ["Carrossel", "Vídeo curto", "Tutorial", "POV", "Trend + Nicho", "Antes/Depois"],
};

const HOOKS = [
  { cat: "Curiosidade",  color: "#6366f1", hooks: ["Nunca te contaram isso sobre…", "O segredo que os experts escondem", "Você vai se arrepender de não ter visto isso antes"] },
  { cat: "Urgência",     color: "#ef4444", hooks: ["Isso vai mudar em 30 dias", "Aproveite antes que remove", "Última vez que vou falar sobre isso"] },
  { cat: "Transformação",color: "#10b981", hooks: ["De [problema] para [resultado] em X dias", "Como eu saí de 0 para Y", "Isso mudou tudo pra mim"] },
  { cat: "Polêmica",     color: "#f59e0b", hooks: ["Opinião impopular:", "Me cancelam por isso mas…", "Todo mundo faz errado, o certo é…"] },
  { cat: "Prova Social", color: "#06b6d4", hooks: ["Fiz isso e cresci X% em Y dias", "Meus seguidores pediram, aqui está", "O método que 10k pessoas já testaram"] },
];

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const inp = { width: "100%", background: "#0a1020", border: "1px solid #1e2a3a", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

export default function ContentPlanner() {
  const [platform, setPlatform]   = useState("ambos");
  const [niche, setNiche]         = useState("");
  const [topic, setTopic]         = useState("");
  const [trends, setTrends]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendar, setCalendar]   = useState({});
  const [editDay, setEditDay]     = useState(null);
  const [newItem, setNewItem]     = useState({ title: "", format: "", platform: "ambos", time: "18:00" });
  const [fillingWeek, setFillingWeek] = useState(false);
  const [activeTab, setActiveTab] = useState("trends");
  const [sortBy, setSortBy]       = useState("viral");
  const textareaRef               = useRef();

  const claudeKey = process.env.REACT_APP_ANTHROPIC_KEY;

  const callClaude = async (prompt, systemPrompt) => {
    const apiKey = claudeKey || localStorage.getItem("claude_api_key") || "";
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
    return d.content.map(c => c.text || "").join("");
  };

  const safeParseJSON = (raw) => {
    // Remove markdown code fences
    let clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    // Extract just the JSON array (in case Claude adds explanatory text)
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) clean = match[0];
    // Replace smart quotes with standard ones
    clean = clean.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    return JSON.parse(clean);
  };

  const pesquisarTendencias = async () => {
    if (!topic && !niche) return;
    setLoading(true);
    setTrends([]);
    try {
      const plat = PLATFORMS.find(p => p.id === platform)?.label || "TikTok e Instagram";
      const raw = await callClaude(
        `Nicho: "${niche || "geral"}". Tema/Produto: "${topic || niche}". Plataforma: ${plat}.
Gere exatamente 8 ideias de conteúdo viral. Responda APENAS com o array JSON, sem texto antes ou depois:
[{"titulo":"string","hook":"string","formato":"string","melhorHorario":"string","viralScore":85,"plataforma":"ambos","tags":["tag1"],"descricao":"string"}]`,
        `Você é especialista em marketing viral. Responda APENAS com JSON puro, sem markdown, sem explicações. O JSON deve ser um array com 8 objetos, cada um com as chaves: titulo, hook, formato, melhorHorario, viralScore (número 0-100), plataforma (tiktok/instagram/ambos), tags (array de strings), descricao.`
      );
      const parsed = safeParseJSON(raw);
      setTrends(parsed.sort((a, b) => (sortBy === "viral" ? b.viralScore - a.viralScore : 0)));
    } catch(e) { alert("Erro ao pesquisar: " + e.message); }
    setLoading(false);
  };

  const preencherSemanaIA = async () => {
    setFillingWeek(true);
    try {
      const dates = getWeekDates(weekOffset);
      const plat = PLATFORMS.find(p => p.id === platform)?.label || "TikTok/Instagram";
      const raw = await callClaude(
        `Crie um calendário de conteúdo para a semana de ${dates[0].toLocaleDateString("pt-BR")} a ${dates[6].toLocaleDateString("pt-BR")}.
Nicho: "${niche || "geral"}". Plataforma: ${plat}.
Responda SOMENTE em JSON: [{"dia":0,"titulo":"...","formato":"...","hora":"18:00","plataforma":"...","hook":"..."}] (dia: 0=Seg, 6=Dom, 7 itens)`,
        `Você é social media manager especialista em criação de calendários de conteúdo viral. Distribua bem os formatos ao longo da semana, considerando os melhores horários para cada plataforma. Responda SOMENTE em JSON, sem markdown.`
      );
      const items = safeParseJSON(raw);
      const newCal = { ...calendar };
      const weekDates = getWeekDates(weekOffset);
      items.forEach(item => {
        const date = weekDates[item.dia];
        if (!date) return;
        const key = date.toISOString().split("T")[0];
        if (!newCal[key]) newCal[key] = [];
        newCal[key].push({ title: item.titulo, format: item.formato, platform: item.plataforma, time: item.hora, hook: item.hook, id: Date.now() + Math.random() });
      });
      setCalendar(newCal);
    } catch(e) { alert("Erro ao preencher semana: " + e.message); }
    setFillingWeek(false);
  };

  const addToCalendar = (dateKey) => {
    if (!newItem.title) return;
    setCalendar(c => ({
      ...c,
      [dateKey]: [...(c[dateKey] || []), { ...newItem, id: Date.now() }],
    }));
    setNewItem({ title: "", format: "", platform: "ambos", time: "18:00" });
    setEditDay(null);
  };

  const removeFromCalendar = (dateKey, id) => {
    setCalendar(c => ({ ...c, [dateKey]: c[dateKey].filter(i => i.id !== id) }));
  };

  const copyHook = (hook) => {
    navigator.clipboard.writeText(hook);
    const el = document.createElement("div");
    el.textContent = "Hook copiado!";
    el.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:8px 18px;border-radius:8px;font-size:13px;z-index:9999;font-family:sans-serif";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  };

  const platColor = PLATFORMS.find(p => p.id === platform)?.color || "#f59e0b";
  const weekDates = getWeekDates(weekOffset);
  const today = new Date().toISOString().split("T")[0];
  const formats = FORMATS[platform] || FORMATS.ambos;

  const tabStyle = (active) => ({
    flex: 1, padding: "12px 0", background: active ? "#0d1520" : "transparent",
    border: "none", borderBottom: active ? `2px solid ${platColor}` : "2px solid transparent",
    color: active ? "#e2e8f0" : "#475569", fontSize: 12, fontWeight: 700,
    letterSpacing: "0.08em", cursor: "pointer",
  });

  const platBtn = (p) => ({
    padding: "7px 18px", borderRadius: 20, border: `1px solid ${platform === p.id ? p.color : "#1e2a3a"}`,
    background: platform === p.id ? p.color + "22" : "transparent",
    color: platform === p.id ? p.color : "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer",
  });

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#080c14", minHeight: "100vh", color: "#e2e8f0" }}>
      <style>{`
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#080c14} ::-webkit-scrollbar-thumb{background:#1e2a3a;border-radius:2px}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      {/* Header */}
      <div style={{ background: "#0d1520", borderBottom: "1px solid #1e2a3a", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${platColor},${platColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📊</div>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.06em" }}>CONTENT PLANNER</span>
        <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
          {PLATFORMS.map(p => <button key={p.id} onClick={() => setPlatform(p.id)} style={platBtn(p)}>{p.icon} {p.label}</button>)}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e2a3a", background: "#0d1520" }}>
        {[["trends","🔥 Tendências"],["calendar","📅 Calendário"],["hooks","⚡ Viral Hooks"]].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={tabStyle(activeTab === k)}>{l}</button>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>

        {/* ── TENDÊNCIAS ─────────────────────────────── */}
        {activeTab === "trends" && (
          <div>
            <div style={{ background: "#0d1520", border: "1px solid #1e2a3a", borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: platColor }}>🔍 Pesquisar Tendências com IA</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#475569", fontWeight: 700, display: "block", marginBottom: 5 }}>NICHO / SEGMENTO</label>
                  <input value={niche} onChange={e => setNiche(e.target.value)} placeholder="Ex: Óticas, fitness, moda..." style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#475569", fontWeight: 700, display: "block", marginBottom: 5 }}>TEMA / PRODUTO</label>
                  <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex: Armações de grau, promoção..." style={inp} onKeyDown={e => e.key === "Enter" && pesquisarTendencias()} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={pesquisarTendencias} disabled={loading || (!niche && !topic)} style={{ flex: 1, padding: "11px", background: loading ? "#1e2a3a" : `linear-gradient(135deg,${platColor},${platColor}88)`, border: "none", borderRadius: 8, color: loading ? "#475569" : "#fff", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {loading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Analisando tendências...</> : "⚡ Pesquisar Tendências"}
                </button>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inp, width: "auto", cursor: "pointer" }}>
                  <option value="viral">↓ Mais viral</option>
                  <option value="recent">↓ Mais recente</option>
                </select>
              </div>
            </div>

            {trends.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {trends.map((t, i) => {
                  const pColor = t.plataforma === "tiktok" ? "#ff0050" : t.plataforma === "instagram" ? "#e1306c" : "#f59e0b";
                  return (
                    <div key={i} style={{ background: "#0d1520", border: `1px solid #1e2a3a`, borderRadius: 12, padding: 16, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${pColor},transparent)` }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: pColor, fontWeight: 700, background: pColor + "15", padding: "2px 8px", borderRadius: 10 }}>{t.plataforma?.toUpperCase()}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ fontSize: 11, color: t.viralScore >= 80 ? "#10b981" : t.viralScore >= 60 ? "#f59e0b" : "#94a3b8", fontWeight: 700 }}>🔥 {t.viralScore}</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, lineHeight: 1.3 }}>{t.titulo}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, lineHeight: 1.5 }}>{t.descricao}</div>
                      <div style={{ background: "#0a1020", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 12, color: "#e2e8f0", borderLeft: `2px solid ${pColor}` }}>
                        <span style={{ color: "#475569", fontSize: 10 }}>HOOK: </span>{t.hook}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569" }}>
                        <span>📋 {t.formato}</span>
                        <span>🕐 {t.melhorHorario}</span>
                      </div>
                      {t.tags?.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                          {t.tags.map((tag, j) => <span key={j} style={{ fontSize: 10, padding: "2px 7px", background: "#1e2a3a", borderRadius: 10, color: "#64748b" }}>#{tag}</span>)}
                        </div>
                      )}
                      <button onClick={() => copyHook(t.hook)} style={{ width: "100%", marginTop: 10, padding: "7px", background: "#1e2a3a", border: "1px solid #2e3a4a", borderRadius: 7, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
                        📋 Copiar hook
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && trends.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#334155" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>{PLATFORMS.find(p => p.id === platform)?.icon || "⚡"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#475569" }}>Pesquise tendências para o seu nicho</div>
                <div style={{ fontSize: 13 }}>Insira o nicho e tema acima, a IA analisa padrões virais e sugere conteúdos com alto potencial de alcance.</div>
              </div>
            )}
          </div>
        )}

        {/* ── CALENDÁRIO ─────────────────────────────── */}
        {activeTab === "calendar" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: "#0d1520", border: "1px solid #1e2a3a", color: "#e2e8f0", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>‹</button>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {weekDates[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – {weekDates[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: "#0d1520", border: "1px solid #1e2a3a", color: "#e2e8f0", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>›</button>
              </div>
              <button onClick={preencherSemanaIA} disabled={fillingWeek} style={{ padding: "9px 18px", background: fillingWeek ? "#1e2a3a" : `linear-gradient(135deg,${platColor},${platColor}88)`, border: "none", borderRadius: 8, color: fillingWeek ? "#475569" : "#fff", fontWeight: 700, cursor: fillingWeek ? "wait" : "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                {fillingWeek ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Gerando...</> : "🤖 Preencher semana com IA"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
              {weekDates.map((date, i) => {
                const key = date.toISOString().split("T")[0];
                const items = calendar[key] || [];
                const isToday = key === today;
                return (
                  <div key={i} style={{ background: "#0d1520", border: `1px solid ${isToday ? platColor + "66" : "#1e2a3a"}`, borderRadius: 10, minHeight: 140, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>{DAYS[i]}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isToday ? platColor : "#e2e8f0" }}>{date.getDate()}</div>
                    </div>
                    {items.map(item => {
                      const pc = item.platform === "tiktok" ? "#ff0050" : item.platform === "instagram" ? "#e1306c" : "#f59e0b";
                      return (
                        <div key={item.id} style={{ background: "#0a1020", borderRadius: 7, padding: "6px 8px", marginBottom: 5, borderLeft: `2px solid ${pc}`, position: "relative" }}>
                          <button onClick={() => removeFromCalendar(key, item.id)} style={{ position: "absolute", top: 3, right: 4, background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>×</button>
                          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2, paddingRight: 14, lineHeight: 1.3 }}>{item.title}</div>
                          <div style={{ fontSize: 10, color: "#475569" }}>{item.format} · {item.time}</div>
                        </div>
                      );
                    })}
                    <button onClick={() => setEditDay(editDay === key ? null : key)} style={{ width: "100%", marginTop: 4, padding: "5px", background: "transparent", border: `1px dashed #1e2a3a`, borderRadius: 6, color: "#334155", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>+</button>
                    {editDay === key && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        <input value={newItem.title} onChange={e => setNewItem(n => ({ ...n, title: e.target.value }))} placeholder="Título do conteúdo" style={{ ...inp, fontSize: 11, padding: "6px 9px" }} />
                        <select value={newItem.format} onChange={e => setNewItem(n => ({ ...n, format: e.target.value }))} style={{ ...inp, fontSize: 11, padding: "6px 9px", cursor: "pointer" }}>
                          <option value="">Formato...</option>
                          {formats.map(f => <option key={f}>{f}</option>)}
                        </select>
                        <input value={newItem.time} onChange={e => setNewItem(n => ({ ...n, time: e.target.value }))} type="time" style={{ ...inp, fontSize: 11, padding: "6px 9px" }} />
                        <button onClick={() => addToCalendar(key)} style={{ padding: "6px", background: platColor, border: "none", borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Adicionar</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── VIRAL HOOKS ────────────────────────────── */}
        {activeTab === "hooks" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {HOOKS.map((cat, i) => (
                <div key={i} style={{ background: "#0d1520", border: "1px solid #1e2a3a", borderRadius: 12, padding: 18, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color }} />
                    <div style={{ fontWeight: 700, fontSize: 14, color: cat.color }}>{cat.cat}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {cat.hooks.map((hook, j) => (
                      <div key={j} style={{ background: "#0a1020", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: "#94a3b8", flex: 1, lineHeight: 1.4 }}>{hook}</span>
                        <button onClick={() => copyHook(hook)} style={{ background: "#1e2a3a", border: "none", borderRadius: 6, color: cat.color, padding: "5px 10px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>📋</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* AI custom hook generator */}
            <div style={{ background: "#0d1520", border: `1px solid ${platColor}44`, borderRadius: 14, padding: 20, marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: platColor, marginBottom: 12 }}>✦ Gerar hooks personalizados com IA</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input ref={textareaRef} placeholder={`Digite o tema (Ex: "vender óticas no Instagram")...`} style={{ ...inp, flex: 1 }} onKeyDown={async e => {
                  if (e.key !== "Enter") return;
                  const t = e.target.value.trim();
                  if (!t) return;
                  e.target.disabled = true;
                  try {
                    const raw = await callClaude(
                      `Crie 5 hooks virais para o tema: "${t}". Plataforma: ${platform}. Responda apenas a lista, um hook por linha, sem numeração.`,
                      "Você é especialista em copywriting viral para redes sociais. Crie hooks irresistíveis, diretos, que causam curiosidade ou urgência. Responda só os hooks, um por linha."
                    );
                    const hooks = raw.split("\n").filter(Boolean);
                    const el = document.createElement("div");
                    el.style.cssText = "background:#0d1520;border:1px solid #1e2a3a;border-radius:12px;padding:16px;margin-top:12px";
                    hooks.forEach(hook => {
                      const row = document.createElement("div");
                      row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#0a1020;border-radius:8px;margin-bottom:6px;gap:8px";
                      row.innerHTML = `<span style="font-size:13px;color:#94a3b8;flex:1;line-height:1.4;font-family:'DM Sans',sans-serif">${hook}</span><button onclick="navigator.clipboard.writeText('${hook.replace(/'/g,"\\'")}');this.textContent='✓'" style="background:#1e2a3a;border:none;border-radius:6px;color:${platColor};padding:5px 10px;cursor:pointer;font-size:12px;flex-shrink:0">📋</button>`;
                      el.appendChild(row);
                    });
                    e.target.parentElement.parentElement.appendChild(el);
                  } catch(err) { alert("Erro: " + err.message); }
                  e.target.disabled = false;
                  e.target.value = "";
                }} />
                <button onClick={() => textareaRef.current?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))} style={{ padding: "9px 18px", background: `linear-gradient(135deg,${platColor},${platColor}88)`, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>
                  ⚡ Gerar
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 8 }}>Pressione Enter ou clique em Gerar</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
