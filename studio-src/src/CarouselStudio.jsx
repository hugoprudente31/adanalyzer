import { useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";

const FONTS = [
  { label: "Impact", value: "'Impact', sans-serif" },
  { label: "Bebas Neue", value: "'Bebas Neue', cursive" },
  { label: "Oswald", value: "'Oswald', sans-serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "DM Sans", value: "'DM Sans', sans-serif" },
];

const PALETTES = [
  { name: "Dark Fire", bg: "#0d0d0d", title: "#FF3B3B", body: "#e0e0e0", accent: "#FF3B3B" },
  { name: "Ocean Deep", bg: "#050d1a", title: "#00C6FF", body: "#b8d4e8", accent: "#00C6FF" },
  { name: "Luxury Gold", bg: "#111008", title: "#F5C518", body: "#d4c89a", accent: "#F5C518" },
  { name: "Forest", bg: "#060f0a", title: "#22c55e", body: "#a7d4b4", accent: "#22c55e" },
  { name: "Pure White", bg: "#FFFFFF", title: "#111111", body: "#444444", accent: "#111111" },
  { name: "Neon Purple", bg: "#08000f", title: "#c026d3", body: "#d4a8dc", accent: "#c026d3" },
];

const DEFAULT_SLIDES = [
  { id: 1, title: "O SEGREDO QUE NINGUÉM TE CONTA", body: "A maioria das pessoas faz tudo errado no Instagram. Mas você está prestes a mudar isso.", align: "center" },
  { id: 2, title: "O PROBLEMA", body: "Você posta, posta e posta... mas o alcance não sai do lugar. Isso não é culpa sua.", align: "center" },
  { id: 3, title: "A SOLUÇÃO", body: "Carrosseis bem estruturados enganam o algoritmo e forçam mais entrega. Siga o método.", align: "center" },
  { id: 4, title: "PASSO 1", body: "Gancho forte no slide 1. Faça o usuário PRECISAR arrastar para o próximo.", align: "left" },
  { id: 5, title: "PASSO 2", body: "Cada slide deve entregar valor E criar curiosidade pelo próximo.", align: "left" },
  { id: 6, title: "RESULTADO", body: "Mais alcance. Mais seguidores. Mais vendas. Tudo com um carrossel bem feito.", align: "center" },
  { id: 7, title: "SALVA AGORA ✦", body: "Você vai precisar dessas dicas. Salva o post antes de perder. E me segue para mais.", align: "center" },
];

let slideCounter = 8;

export default function CarouselStudio() {
  const [slides, setSlides] = useState(DEFAULT_SLIDES);
  const [activeSlide, setActiveSlide] = useState(0);
  const [palette, setPalette] = useState(PALETTES[0]);
  const [font, setFont] = useState(FONTS[0]);
  const [tab, setTab] = useState("texto");
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("educativo e direto");
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [batchText, setBatchText] = useState("");
  const [titleSize, setTitleSize] = useState(32);
  const [bodySize, setBodySize] = useState(16);
  const [bgImage, setBgImage] = useState("");
  const [overlay, setOverlay] = useState(0.6);
  const [showExport, setShowExport] = useState(false);
  const [generatingImg, setGeneratingImg] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef();
  const slidePreviewRef = useRef();

  const current = slides[activeSlide] || slides[0];

  const updateSlide = (field, value) => setSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, [field]: value } : s));
  const addSlide = () => { setSlides(prev => [...prev, { id: slideCounter++, title: "NOVO SLIDE", body: "Escreva o conteúdo aqui...", align: "center" }]); setActiveSlide(slides.length); };
  const removeSlide = (idx) => { if (slides.length <= 1) return; setSlides(prev => prev.filter((_, i) => i !== idx)); setActiveSlide(Math.max(0, activeSlide - (idx <= activeSlide ? 1 : 0))); };
  const moveSlide = (from, to) => { if (to < 0 || to >= slides.length) return; const arr = [...slides]; const [item] = arr.splice(from, 1); arr.splice(to, 0, item); setSlides(arr); setActiveSlide(to); };

  const captureSlide = useCallback(async () => {
    const el = slidePreviewRef.current;
    if (!el) throw new Error("Slide não encontrado");
    return html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null });
  }, []);

  const downloadPNG = async () => {
    setDownloading(true);
    try {
      const canvas = await captureSlide();
      const link = document.createElement("a");
      link.download = `slide-${activeSlide + 1}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch(e) { alert("Erro ao baixar: " + e.message); }
    setDownloading(false);
  };

  const downloadAllPNG = async () => {
    setDownloading(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        setActiveSlide(i);
        await new Promise(r => setTimeout(r, 180));
        const canvas = await captureSlide();
        const link = document.createElement("a");
        link.download = `slide-${i + 1}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        await new Promise(r => setTimeout(r, 80));
      }
    } catch(e) { alert("Erro: " + e.message); }
    setDownloading(false);
  };

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "p", unit: "px", format: [500, 500] });
      for (let i = 0; i < slides.length; i++) {
        setActiveSlide(i);
        await new Promise(r => setTimeout(r, 180));
        const canvas = await captureSlide();
        if (i > 0) pdf.addPage([500, 500], "p");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 500, 500);
      }
      pdf.save("carrossel.pdf");
    } catch(e) { alert("Erro ao gerar PDF: " + e.message); }
    setDownloading(false);
  };

  const generateSlideImage = async (idx) => {
    setGeneratingImg(idx);
    try {
      const slide = slides[idx];
      const res = await fetch("/api/openai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `Social media carousel slide background for: "${slide.title}". ${slide.body}. Bold, modern, high-contrast, cinematic. NO TEXT in image. Instagram-ready aesthetic.`,
          n: 1, size: "1024x1024", quality: "standard", response_format: "b64_json",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const b64 = data.data[0].b64_json;
      setSlides(prev => prev.map((s, i) => i === idx ? { ...s, aiImage: `data:image/png;base64,${b64}` } : s));
    } catch(e) { alert("Erro DALL-E: " + e.message); }
    setGeneratingImg(null);
  };

  const applyBatch = () => {
    const lines = batchText.split("\n\n").filter(Boolean);
    const newSlides = lines.map((block, i) => { const parts = block.split("\n"); return { id: slideCounter++, title: parts[0] || `SLIDE ${i+1}`, body: parts.slice(1).join(" "), align: "center" }; });
    if (newSlides.length) { setSlides(newSlides); setActiveSlide(0); setBatchText(""); }
  };

  const generateWithAI = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tokens: 1000,
          messages: [{ role: "user", content: `Crie um carrossel viral com 7 slides sobre: "${topic}". Nicho: ${niche||"geral"}. Tom: ${tone}. Slide 1 = gancho, slides 2-6 = conteúdo, slide 7 = CTA. Responda SOMENTE em JSON válido sem markdown: [{"title":"TÍTULO","body":"Texto."},...]` }]
        })
      });
      const data = await res.json();
      const raw = data.content.map(c => c.text || "").join("");
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setSlides(parsed.map(s => ({ id: slideCounter++, title: s.title, body: s.body, align: "center" })));
      setActiveSlide(0);
    } catch { alert("Erro ao gerar. Verifique a API key no .env"); }
    setLoading(false);
  };

  const handleImageUpload = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => setBgImage(ev.target.result); reader.readAsDataURL(file); };

  const SlideCard = ({ slide, index, mini = false }) => {
    const align = slide.align || "center";
    const textAlign = align === "center" ? "center" : align === "right" ? "right" : "left";
    const justifyContent = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
    const bgSrc = slide.aiImage || bgImage;
    return (
      <div style={{ width: mini ? 80 : "100%", aspectRatio: "1/1", background: bgSrc ? `url(${bgSrc}) center/cover` : palette.bg, position: "relative", borderRadius: mini ? 6 : 16, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: mini && index === activeSlide ? `2px solid ${palette.accent}` : mini ? "2px solid transparent" : "none", cursor: mini ? "pointer" : "default", boxShadow: mini ? "0 2px 12px rgba(0,0,0,0.4)" : "0 8px 40px rgba(0,0,0,0.6)" }}>
        {bgImage && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${overlay})` }} />}
        <div style={{ position: "relative", zIndex: 1, padding: mini ? "6px" : "32px", width: "100%", display: "flex", flexDirection: "column", alignItems: justifyContent === "center" ? "center" : justifyContent === "flex-end" ? "flex-end" : "flex-start", textAlign }}>
          <div style={{ fontFamily: font.value, fontSize: mini ? Math.max(7, titleSize * 0.22) : titleSize, fontWeight: 900, color: palette.title, lineHeight: 1.1, textTransform: "uppercase", marginBottom: mini ? 2 : 14, wordBreak: "break-word" }}>{slide.title}</div>
          {!mini && <div style={{ width: 40, height: 3, background: palette.accent, borderRadius: 2, marginBottom: 14, alignSelf: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }} />}
          <div style={{ fontFamily: font.value, fontSize: mini ? Math.max(5, bodySize * 0.22) : bodySize, color: palette.body, lineHeight: 1.5, wordBreak: "break-word" }}>{slide.body}</div>
          {!mini && <div style={{ position: "absolute", bottom: 16, right: 20, fontSize: 11, color: palette.body, opacity: 0.4 }}>{index+1}/{slides.length}</div>}
        </div>
      </div>
    );
  };

  const labelStyle = { display: "block", fontSize: 10, color: "#555", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 };
  const inputStyle = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#fff", padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const btnPrimary = { width: "100%", padding: "11px", background: "linear-gradient(135deg,#FF3B3B,#FF6B00)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" };
  const btnSecondary = { padding: "8px 16px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" };

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column" }}>
      <style>{`::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#0a0a0a} ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 52 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#FF3B3B,#FF8C00)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase" }}>Carousel AI Studio</span>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setPreviewMode(true)} style={{ background: "#222", border: "1px solid #333", color: "#fff", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>▶ Preview</button>
        <button onClick={() => setShowExport(true)} style={{ background: "linear-gradient(135deg,#FF3B3B,#FF6B00)", border: "none", color: "#fff", padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Exportar</button>
      </div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: 112, background: "#0e0e0e", borderRight: "1px solid #1a1a1a", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px", gap: 8, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", marginBottom: 4 }}>SLIDES</div>
          {slides.map((slide, i) => (
            <div key={slide.id} style={{ position: "relative", width: "100%" }}>
              <div onClick={() => setActiveSlide(i)}><SlideCard slide={slide} index={i} mini /></div>
              <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 3 }}>
                <button onClick={() => moveSlide(i, i-1)} disabled={i===0} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 10, padding: "1px 4px" }}>↑</button>
                <button onClick={() => moveSlide(i, i+1)} disabled={i===slides.length-1} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 10, padding: "1px 4px" }}>↓</button>
                <button onClick={() => removeSlide(i)} style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", fontSize: 10, padding: "1px 4px" }}>✕</button>
              </div>
            </div>
          ))}
          <button onClick={addSlide} style={{ width: "80px", aspectRatio: "1", background: "#1a1a1a", border: "1.5px dashed #333", borderRadius: 6, color: "#555", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0d0d", padding: 32 }}>
          <div style={{ width: "min(420px, 100%)", aspectRatio: "1/1" }} ref={slidePreviewRef}>
            {current && <SlideCard slide={current} index={activeSlide} />}
          </div>
          <div style={{ position: "absolute", bottom: 32, display: "flex", gap: 8 }}>
            <button onClick={downloadPNG} disabled={downloading} style={{ padding: "8px 16px", background: "#1a1a1a", border: "1px solid #333", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{downloading ? "⟳" : "⬇"} PNG</button>
            <button onClick={() => generateSlideImage(activeSlide)} disabled={generatingImg !== null} style={{ padding: "8px 16px", background: generatingImg === activeSlide ? "#2a1a0a" : "#1a0a00", border: "1px solid #FF6B00", color: "#FF6B00", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              {generatingImg === activeSlide ? "⟳ Gerando..." : "✨ DALL-E"}
            </button>
          </div>
        </div>
        <div style={{ width: 320, background: "#111", borderLeft: "1px solid #1a1a1a", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a" }}>
            {[["texto","TEXTO"],["design","DESIGN"],["ia","✦ IA"]].map(([key,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{ flex:1, padding:"12px 0", background:tab===key?"#1a1a1a":"transparent", border:"none", borderBottom:tab===key?"2px solid #FF3B3B":"2px solid transparent", color:tab===key?"#fff":"#555", fontSize:11, fontWeight:700, letterSpacing:"0.08em", cursor:"pointer" }}>{label}</button>
            ))}
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:16 }}>
            {tab==="texto" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div><label style={labelStyle}>TÍTULO</label><input value={current?.title||""} onChange={e=>updateSlide("title",e.target.value)} style={inputStyle} placeholder="Título do slide..." /></div>
                <div><label style={labelStyle}>CORPO</label><textarea value={current?.body||""} onChange={e=>updateSlide("body",e.target.value)} style={{...inputStyle,height:100,resize:"vertical"}} /></div>
                <div>
                  <label style={labelStyle}>ALINHAMENTO</label>
                  <div style={{ display:"flex", gap:6 }}>
                    {[["Esq","left"],["Centro","center"],["Dir","right"]].map(([l,v])=>(
                      <button key={v} onClick={()=>updateSlide("align",v)} style={{ flex:1, padding:"7px 0", background:(current?.align||"center")===v?"#FF3B3B":"#1a1a1a", border:"none", borderRadius:6, color:"#fff", fontSize:11, cursor:"pointer" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ borderTop:"1px solid #1a1a1a", paddingTop:14 }}>
                  <label style={labelStyle}>TEXTO EM LOTE</label>
                  <p style={{ fontSize:11, color:"#555", margin:"4px 0 8px" }}>Separe slides com linha vazia. Linha 1 = título.</p>
                  <textarea value={batchText} onChange={e=>setBatchText(e.target.value)} style={{...inputStyle,height:100,resize:"vertical",fontFamily:"monospace",fontSize:12}} placeholder={"TÍTULO 1\nCorpo do slide 1\n\nTÍTULO 2\nCorpo do slide 2"} />
                  <button onClick={applyBatch} style={btnPrimary}>Aplicar Lote</button>
                </div>
              </div>
            )}
            {tab==="design" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={labelStyle}>PALETA DE CORES</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {PALETTES.map(p=>(
                      <button key={p.name} onClick={()=>setPalette(p)} title={p.name} style={{ width:40, height:40, borderRadius:8, background:p.bg, border:palette.name===p.name?`2px solid ${p.accent}`:"2px solid #333", cursor:"pointer", position:"relative", overflow:"hidden" }}>
                        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:10, background:p.accent, opacity:0.8 }} />
                      </button>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:10 }}>
                    {[["title","Título"],["body","Corpo"],["bg","Fundo"]].map(([key,label])=>(
                      <div key={key} style={{ flex:1 }}>
                        <label style={{...labelStyle,fontSize:9}}>{label}</label>
                        <input type="color" value={palette[key]} onChange={e=>setPalette(p=>({...p,[key]:e.target.value}))} style={{ width:"100%", height:32, borderRadius:6, border:"1px solid #333", background:"none", cursor:"pointer" }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>FONTE</label>
                  <select value={font.value} onChange={e=>setFont(FONTS.find(f=>f.value===e.target.value))} style={{...inputStyle,cursor:"pointer"}}>
                    {FONTS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>TÍTULO: {titleSize}px</label><input type="range" min={18} max={60} value={titleSize} onChange={e=>setTitleSize(+e.target.value)} style={{ width:"100%", accentColor:"#FF3B3B" }} /></div>
                <div><label style={labelStyle}>CORPO: {bodySize}px</label><input type="range" min={10} max={28} value={bodySize} onChange={e=>setBodySize(+e.target.value)} style={{ width:"100%", accentColor:"#FF3B3B" }} /></div>
                <div>
                  <label style={labelStyle}>IMAGEM DE FUNDO</label>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display:"none" }} />
                  <button onClick={()=>fileRef.current.click()} style={{...btnSecondary,width:"100%"}}>📷 Upload</button>
                  {bgImage && <>
                    <label style={{...labelStyle,marginTop:8}}>ESCURECIMENTO: {Math.round(overlay*100)}%</label>
                    <input type="range" min={0} max={1} step={0.05} value={overlay} onChange={e=>setOverlay(+e.target.value)} style={{ width:"100%", accentColor:"#FF3B3B" }} />
                    <button onClick={()=>setBgImage("")} style={{...btnSecondary,width:"100%",marginTop:6,color:"#c00",borderColor:"#c00"}}>✕ Remover</button>
                  </>}
                </div>
              </div>
            )}
            {tab==="ia" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div style={{ background:"linear-gradient(135deg,#1a0a0a,#0f0a1a)", border:"1px solid #2a1a2a", borderRadius:10, padding:12 }}>
                  <div style={{ fontSize:12, color:"#FF3B3B", fontWeight:700, marginBottom:4 }}>✦ Gerador com IA</div>
                  <div style={{ fontSize:11, color:"#777" }}>Gere um carrossel viral completo em segundos.</div>
                </div>
                <div><label style={labelStyle}>TEMA *</label><input value={topic} onChange={e=>setTopic(e.target.value)} style={inputStyle} placeholder="Ex: Como vender no Instagram sem aparecer" /></div>
                <div><label style={labelStyle}>NICHO</label><input value={niche} onChange={e=>setNiche(e.target.value)} style={inputStyle} placeholder="Ex: Marketing digital, fitness..." /></div>
                <div>
                  <label style={labelStyle}>TOM DE VOZ</label>
                  <select value={tone} onChange={e=>setTone(e.target.value)} style={{...inputStyle,cursor:"pointer"}}>
                    {["educativo e direto","provocativo e polêmico","inspiracional e motivador","técnico e detalhado","descontraído e casual","urgente e persuasivo"].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <button onClick={generateWithAI} disabled={loading||!topic} style={{...btnPrimary,opacity:loading||!topic?0.5:1,cursor:loading||!topic?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {loading?<><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span> Gerando...</>:"⚡ Gerar Carrossel"}
                </button>
                <div style={{ borderTop:"1px solid #1a1a1a", paddingTop:14, marginTop:4 }}>
                  <div style={{ fontSize:12, color:"#FF6B00", fontWeight:700, marginBottom:6 }}>🎨 DALL-E 3 — Imagens IA</div>
                  <div style={{ fontSize:11, color:"#777", marginBottom:10 }}>Gera imagem de fundo exclusiva para o slide atual. Requer OpenAI key em Integrações.</div>
                  <button onClick={()=>generateSlideImage(activeSlide)} disabled={generatingImg!==null} style={{...btnPrimary,background:"linear-gradient(135deg,#FF6B00,#f59e0b)",opacity:generatingImg!==null?0.5:1,cursor:generatingImg!==null?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                    {generatingImg===activeSlide?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span> Gerando imagem...</>:"✨ Gerar imagem para este slide"}
                  </button>
                  {current?.aiImage && <button onClick={()=>updateSlide("aiImage",null)} style={{...btnSecondary,width:"100%",marginTop:6,color:"#c00",borderColor:"#c00"}}>✕ Remover imagem IA</button>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {previewMode && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, flexDirection:"column", gap:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:14, color:"#888" }}>Slide {previewIndex+1} de {slides.length}</span>
            <button onClick={()=>setPreviewMode(false)} style={{ marginLeft:16, background:"#1a1a1a", border:"1px solid #333", color:"#fff", width:30, height:30, borderRadius:6, cursor:"pointer" }}>✕</button>
          </div>
          <div style={{ width:"min(380px,90vw)", aspectRatio:"1/1" }}>
            <SlideCard slide={slides[previewIndex]} index={previewIndex} />
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={()=>setPreviewIndex(i=>Math.max(0,i-1))} disabled={previewIndex===0} style={{...btnSecondary,opacity:previewIndex===0?0.3:1}}>← Anterior</button>
            <div style={{ display:"flex", gap:4 }}>
              {slides.map((_,i)=><div key={i} onClick={()=>setPreviewIndex(i)} style={{ width:i===previewIndex?18:6, height:6, background:i===previewIndex?"#FF3B3B":"#333", borderRadius:3, cursor:"pointer", transition:"all 0.2s" }} />)}
            </div>
            <button onClick={()=>setPreviewIndex(i=>Math.min(slides.length-1,i+1))} disabled={previewIndex===slides.length-1} style={{...btnSecondary,opacity:previewIndex===slides.length-1?0.3:1}}>Próximo →</button>
          </div>
        </div>
      )}
      {showExport && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"#141414", border:"1px solid #2a2a2a", borderRadius:16, padding:28, width:420, maxWidth:"90vw" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Exportar</h2>
              <button onClick={()=>setShowExport(false)} style={{ background:"none", border:"none", color:"#666", fontSize:18, cursor:"pointer" }}>✕</button>
            </div>
            {[
              { icon:"🖼️", label:"Baixar slide atual em PNG", sub:"Alta resolução 2x", action: () => { setShowExport(false); downloadPNG(); } },
              { icon:"📦", label:"Baixar todos os slides em PNG", sub:`${slides.length} arquivos separados`, action: () => { setShowExport(false); downloadAllPNG(); } },
              { icon:"📑", label:"Baixar todos como PDF", sub:"Um arquivo com todos os slides", action: () => { setShowExport(false); downloadPDF(); } },
              { icon:"📋", label:"Copiar todos os textos", sub:"Para colar em qualquer editor", action:()=>{ navigator.clipboard.writeText(slides.map((s,i)=>`[Slide ${i+1}]\n${s.title}\n${s.body}`).join("\n\n")); alert("Copiado!"); } },
              { icon:"📄", label:"Exportar como JSON", sub:"Para reimportar depois", action:()=>{ const a=document.createElement("a"); a.href="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify({slides,palette,font:font.label},null,2)); a.download="carrossel.json"; a.click(); } },
            ].map(opt=>(
              <button key={opt.label} onClick={opt.action} style={{ display:"flex", gap:12, alignItems:"center", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:10, padding:14, cursor:"pointer", textAlign:"left", color:"#fff", width:"100%", marginBottom:8 }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#FF3B3B"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#2a2a2a"}>
                <span style={{ fontSize:24 }}>{opt.icon}</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700 }}>{opt.label}</div>
                  {opt.sub && <div style={{ fontSize:11, color:"#666", marginTop:2 }}>{opt.sub}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
