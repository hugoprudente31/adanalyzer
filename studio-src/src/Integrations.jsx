import { useState } from "react";

const S = (k) => localStorage.getItem(k) || "";
const LS = (k, v) => localStorage.setItem(k, v);

const STATUS = {
  idle: null,
  ok: { color: "#10b981", label: "● Conectado" },
  err: { color: "#ef4444", label: "● Erro" },
};

function IntCard({ icon, title, subtitle, children, status }) {
  const st = STATUS[status] || STATUS.idle;
  return (
    <div style={{ background: "#0d1520", border: "1px solid #1e2a3a", borderRadius: 14, padding: 22, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: "#1e2a3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#475569" }}>{subtitle}</div>
        </div>
        {st && <span style={{ fontSize: 12, color: st.color, fontWeight: 600 }}>{st.label}</span>}
      </div>
      {children}
    </div>
  );
}

const inp = { width: "100%", background: "#0a1020", border: "1px solid #1e2a3a", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const row = { display: "flex", gap: 8, marginTop: 8 };
const btnSave = { flex: 1, padding: "9px", background: "linear-gradient(135deg,#f59e0b,#f97316)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnTest = { padding: "9px 16px", background: "#1e2a3a", border: "1px solid #2e3a4a", borderRadius: 8, color: "#94a3b8", fontSize: 13, cursor: "pointer" };
const lbl = { display: "block", fontSize: 11, color: "#475569", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 5, marginTop: 12 };

export default function Integrations() {
  const [openai, setOpenai]   = useState(S("nexus_openai_key"));
  const [kommoD, setKommoD]   = useState(S("nexus_kommo_domain"));
  const [kommoT, setKommoT]   = useState(S("nexus_kommo_token"));
  const [kondado, setKondado] = useState(S("nexus_kondado_token"));
  const [mailing, setMailing] = useState(S("nexus_mailing_ckey"));
  const [st, setSt] = useState({});
  const [msg, setMsg] = useState({});

  const setStatus = (k, status, message = "") => {
    setSt(p => ({ ...p, [k]: status }));
    setMsg(p => ({ ...p, [k]: message }));
  };

  const saveOpenAI = () => {
    if (!openai.startsWith("sk-")) { setStatus("openai", "err", "Deve começar com sk-"); return; }
    LS("nexus_openai_key", openai);
    setStatus("openai", "ok", "API key salva");
  };

  const testOpenAI = async () => {
    setStatus("openai", "idle", "Testando...");
    try {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${openai}` }
      });
      if (!r.ok) throw new Error("Key inválida");
      LS("nexus_openai_key", openai);
      setStatus("openai", "ok", "Conectado! DALL-E 3 disponível");
    } catch(e) { setStatus("openai", "err", e.message); }
  };

  const saveKommo = () => {
    if (!kommoD || !kommoT) { setStatus("kommo", "err", "Domínio e token obrigatórios"); return; }
    LS("nexus_kommo_domain", kommoD);
    LS("nexus_kommo_token", kommoT);
    setStatus("kommo", "ok", "Credenciais salvas");
  };

  const testKommo = async () => {
    setStatus("kommo", "idle", "Testando...");
    try {
      const r = await fetch(`https://${kommoD}.kommo.com/api/v4/contacts?limit=1`, {
        headers: { "Authorization": `Bearer ${kommoT}`, "Accept": "application/json" }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const count = data._embedded?.contacts?.length ?? 0;
      LS("nexus_kommo_domain", kommoD);
      LS("nexus_kommo_token", kommoT);
      setStatus("kommo", "ok", `Conectado (${count} contato(s) encontrado(s))`);
    } catch(e) { setStatus("kommo", "err", e.message + " — verifique CORS ou token"); }
  };

  const saveKondado = () => {
    if (!kondado) { setStatus("kondado", "err", "Token obrigatório"); return; }
    LS("nexus_kondado_token", kondado);
    setStatus("kondado", "ok", "Token salvo");
  };

  const saveMailing = () => {
    if (!mailing) { setStatus("mailing", "err", "cKey obrigatório"); return; }
    LS("nexus_mailing_ckey", mailing);
    setStatus("mailing", "ok", "cKey salvo");
  };

  const testMailing = async () => {
    setStatus("mailing", "idle", "Testando...");
    try {
      const params = new URLSearchParams({ account: "app.mailingboss.com", path: "/api/v1/contacts", cKey: mailing, limit: 1 });
      const r = await fetch(`/api/builderall?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      LS("nexus_mailing_ckey", mailing);
      setStatus("mailing", "ok", "MailingBoss conectado");
    } catch(e) { setStatus("mailing", "err", "Erro — use o servidor Node (server.js)"); }
  };

  const anthropicKey = process.env.REACT_APP_ANTHROPIC_KEY;

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#080c14", minHeight: "100vh", color: "#e2e8f0" }}>
      <style>{`input::placeholder{color:#334155} select option{background:#0a1020}`}</style>
      <div style={{ background: "#0d1520", borderBottom: "1px solid #1e2a3a", padding: "0 28px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚙️</div>
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.06em" }}>INTEGRAÇÕES</span>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px" }}>

        {/* Anthropic Claude */}
        <IntCard icon="🤖" title="Claude — Anthropic" subtitle="IA para textos, análises e conteúdo" status={anthropicKey && !anthropicKey.includes("sua_api") ? "ok" : "err"}>
          <div style={{ background: "#0a1020", border: "1px solid #1e2a3a", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
            <div style={{ color: "#475569", marginBottom: 4 }}>Configurado no arquivo <code style={{ color: "#f59e0b" }}>.env</code></div>
            <div style={{ color: anthropicKey && !anthropicKey.includes("sua_api") ? "#10b981" : "#ef4444", fontFamily: "monospace" }}>
              {anthropicKey ? (anthropicKey.includes("sua_api") ? "⚠ Não configurado" : `sk-ant-...${anthropicKey.slice(-6)}`) : "⚠ Não encontrado"}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>Para trocar: edite o arquivo <code>.env</code> → <code>REACT_APP_ANTHROPIC_KEY=sk-ant-...</code></div>
        </IntCard>

        {/* OpenAI */}
        <IntCard icon="✨" title="OpenAI — GPT + DALL-E" subtitle="Geração de imagens para carrossel" status={st.openai || (S("nexus_openai_key") ? "ok" : "idle")}>
          <label style={lbl}>API KEY</label>
          <input type="password" value={openai} onChange={e => setOpenai(e.target.value)} placeholder="sk-..." style={inp} />
          {msg.openai && <div style={{ fontSize: 11, marginTop: 6, color: st.openai === "ok" ? "#10b981" : "#ef4444" }}>{msg.openai}</div>}
          <div style={row}>
            <button onClick={saveOpenAI} style={btnSave}>Salvar</button>
            <button onClick={testOpenAI} style={btnTest}>Testar</button>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>Obtenha em: <span style={{ color: "#f59e0b" }}>platform.openai.com/api-keys</span></div>
        </IntCard>

        {/* Kommo */}
        <IntCard icon="🚀" title="Kommo (amoCRM)" subtitle="Sincronizar contatos e negócios" status={st.kommo || (S("nexus_kommo_token") ? "ok" : "idle")}>
          <label style={lbl}>DOMÍNIO DA CONTA</label>
          <input value={kommoD} onChange={e => setKommoD(e.target.value)} placeholder="suaempresa  (sem .kommo.com)" style={inp} />
          <label style={lbl}>ACCESS TOKEN</label>
          <input type="password" value={kommoT} onChange={e => setKommoT(e.target.value)} placeholder="Token OAuth2..." style={inp} />
          {msg.kommo && <div style={{ fontSize: 11, marginTop: 6, color: st.kommo === "ok" ? "#10b981" : "#ef4444" }}>{msg.kommo}</div>}
          <div style={row}>
            <button onClick={saveKommo} style={btnSave}>Salvar</button>
            <button onClick={testKommo} style={btnTest}>Testar</button>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>Token em: <span style={{ color: "#f59e0b" }}>suaempresa.kommo.com → Integrações → API</span></div>
        </IntCard>

        {/* Kondado */}
        <IntCard icon="🔗" title="Kondado" subtitle="Integração de dados e leads" status={st.kondado || (S("nexus_kondado_token") ? "ok" : "idle")}>
          <label style={lbl}>JWT TOKEN</label>
          <textarea value={kondado} onChange={e => setKondado(e.target.value)} placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." style={{ ...inp, height: 80, resize: "vertical", fontFamily: "monospace", fontSize: 11 }} />
          {msg.kondado && <div style={{ fontSize: 11, marginTop: 6, color: st.kondado === "ok" ? "#10b981" : "#ef4444" }}>{msg.kondado}</div>}
          <div style={row}>
            <button onClick={saveKondado} style={btnSave}>Salvar Token</button>
          </div>
        </IntCard>

        {/* MailingBoss */}
        <IntCard icon="📧" title="MailingBoss — Builderall" subtitle="E-mail marketing e lista de contatos" status={st.mailing || (S("nexus_mailing_ckey") ? "ok" : "idle")}>
          <label style={lbl}>cKEY (CHAVE DA API)</label>
          <input type="password" value={mailing} onChange={e => setMailing(e.target.value)} placeholder="eb8d67e83a15..." style={inp} />
          {msg.mailing && <div style={{ fontSize: 11, marginTop: 6, color: st.mailing === "ok" ? "#10b981" : "#ef4444" }}>{msg.mailing}</div>}
          <div style={row}>
            <button onClick={saveMailing} style={btnSave}>Salvar</button>
            <button onClick={testMailing} style={btnTest}>Testar</button>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>Requer o servidor Node local para contornar CORS.</div>
        </IntCard>

      </div>
    </div>
  );
}
