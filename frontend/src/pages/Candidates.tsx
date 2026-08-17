import { Download, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHead, ToastStack, useToasts } from "../components";
import { api } from "../lib";
import { ClientDrawer } from "./Pipeline";

type Zone = "Zona Cinza" | "Zona Verde";
type TagType = { id:string; name:string; color:string };
type Consultant = { id:string; name:string };
type PipelineStage = { id?:string; stable_key:string; name:string; color:string; position:number };
type Client = {
  id:number; created_at:string; "Numero do cliente"?:string; "nome do cliente"?:string;
  Cliente?:string; estagio_lead?:string|null; ZONA?:string; email?:string|null; source?:string|null;
  course_interest?:string|null; amount?:number|null; consultant_id?:string|null; consultant_name?:string|null;
  tags?:TagType[];
};

const clientName = (c:Client) => c["nome do cliente"] || c.Cliente || "Lead sem nome";
const currency = (value?:number|null) => value==null ? "Não informado" : value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const escapeCsv = (value:string) => /[",\n;]/.test(value) ? `"${value.replace(/"/g,'""')}"` : value;

export function Candidates(){
  const [clients,setClients] = useState<Client[]>([]);
  const [stages,setStages] = useState<PipelineStage[]>([]);
  const [tags,setTags] = useState<TagType[]>([]);
  const [consultants,setConsultants] = useState<Consultant[]>([]);
  const [search,setSearch] = useState("");
  const [zone,setZone] = useState("");
  const [tagId,setTagId] = useState("");
  const [source,setSource] = useState("");
  const [consultantId,setConsultantId] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [showNew,setShowNew] = useState(false);
  const [selected,setSelected] = useState<Client|null>(null);
  const {toasts,push} = useToasts();

  const load = async () => {
    setLoading(true); setError("");
    try {
      const qs = new URLSearchParams();
      if (zone) qs.set("zone", zone);
      if (tagId) qs.set("tagId", tagId);
      const query = qs.toString();
      setClients(await api<Client[]>(`/crm/clients${query ? `?${query}` : ""}`));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [zone, tagId]);
  useEffect(() => {
    api<PipelineStage[]>("/configuration/pipeline-stages").then(setStages).catch(() => {});
    api<TagType[]>("/crm/tags").then(setTags).catch(() => {});
    api<Consultant[]>("/crm/consultants").then(setConsultants).catch(() => {});
  }, []);

  const sources = useMemo(() => Array.from(new Set(clients.map(c => c.source).filter(Boolean))) as string[], [clients]);
  const stageInfo = (key?:string|null) => stages.find(s => s.stable_key === key);
  const filtered = useMemo(() => clients.filter(c => {
    if (source && c.source !== source) return false;
    if (consultantId && c.consultant_id !== consultantId) return false;
    if (search) {
      const q = search.toLowerCase();
      const matches = clientName(c).toLowerCase().includes(q)
        || (c["Numero do cliente"] || "").toLowerCase().includes(q)
        || (c.email || "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  }), [clients, search, source, consultantId]);

  function exportCsv() {
    try {
      const header = ["Nome","Telefone","Email","Zona","Consultor","Curso de Interesse","Estágio","Valor","Data de cadastro"];
      const rows = filtered.map(c => [
        clientName(c),
        c["Numero do cliente"] || "",
        c.email || "",
        c.ZONA || "",
        c.consultant_name || "",
        c.course_interest || "",
        stageInfo(c.estagio_lead)?.name || c.estagio_lead || "",
        c.amount != null ? String(c.amount) : "",
        new Date(c.created_at).toLocaleDateString("pt-BR"),
      ]);
      const csv = [header, ...rows].map(r => r.map(escapeCsv).join(",")).join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      push("CSV exportado com sucesso.", "success");
    } catch {
      push("Não foi possível exportar o CSV.", "error");
    }
  }

  return <>
    <PageHead title="Leads" subtitle="Gerencie contatos e oportunidades de matrícula.">
      <button className="secondary" onClick={exportCsv}><Download/>Exportar CSV</button>
      <button className="primary" onClick={() => setShowNew(true)}><Plus/>Novo Lead</button>
    </PageHead>
    {error && <div className="alert error">{error}</div>}
    <div className="card filters">
      <div className="search"><Search/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou e-mail"/></div>
      <select value={zone} onChange={e => setZone(e.target.value)}>
        <option value="">Todas as zonas</option>
        <option value="Zona Cinza">Zona Cinza</option>
        <option value="Zona Verde">Zona Verde</option>
      </select>
      <select value={tagId} onChange={e => setTagId(e.target.value)}>
        <option value="">Todas as etiquetas</option>
        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select value={source} onChange={e => setSource(e.target.value)}>
        <option value="">Todas as origens</option>
        {sources.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={consultantId} onChange={e => setConsultantId(e.target.value)}>
        <option value="">Todos os consultores</option>
        {consultants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
    <div className="table-card">
      <div className="table-top"><b>{filtered.length} lead{filtered.length===1?"":"s"} encontrado{filtered.length===1?"":"s"}</b></div>
      <div className="table-scroll">
        <table className="clickable-rows">
          <thead><tr><th>Lead</th><th>Zona</th><th>Consultor</th><th>Curso de interesse</th><th>Estágio</th><th>Valor</th></tr></thead>
          <tbody>
            {!loading && filtered.map(c => {
              const stage = stageInfo(c.estagio_lead);
              return <tr key={c.id} onClick={() => setSelected(c)}>
                <td><b>{clientName(c)}</b><small>{c["Numero do cliente"] || "Telefone não informado"} · {new Date(c.created_at).toLocaleDateString("pt-BR")}</small></td>
                <td>{c.ZONA || "Não informada"}</td>
                <td>{c.consultant_name || "Não atribuído"}</td>
                <td>{c.course_interest || "Não informado"}</td>
                <td>{stage ? <span className="badge" style={{backgroundColor:`${stage.color}20`,color:stage.color}}>{stage.name}</span> : <span className="badge neutral">{c.estagio_lead || "Não definida"}</span>}</td>
                <td><b>{currency(c.amount)}</b></td>
              </tr>;
            })}
          </tbody>
        </table>
        {loading && <div className="drawer-loading">Carregando leads...</div>}
        {!loading && !filtered.length && <div className="drawer-loading">Nenhum lead encontrado para os filtros atuais.</div>}
      </div>
    </div>
    {showNew && <NewLeadModal stages={stages} consultants={consultants} onClose={() => setShowNew(false)} onCreated={() => { void load(); push("Lead criado com sucesso.", "success"); }} onError={(msg) => push(msg, "error")}/>}
    {selected && <ClientDrawer client={selected} onClose={() => setSelected(null)} onChanged={() => void load()}/>}
    <ToastStack toasts={toasts}/>
  </>;
}

function NewLeadModal({stages,consultants,onClose,onCreated,onError}:{stages:PipelineStage[];consultants:Consultant[];onClose:()=>void;onCreated:()=>void;onError:(msg:string)=>void}){
  const [form,setForm] = useState({name:"",phone:"",email:"",zone:"Zona Cinza" as Zone,consultant_id:"",course_interest:"",stage:stages[0]?.stable_key || "novos_leads"});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { setError("Nome e telefone são obrigatórios."); return; }
    setBusy(true); setError("");
    try {
      await api("/crm/clients", { method:"POST", body: JSON.stringify({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        zone: form.zone,
        consultant_id: form.consultant_id || null,
        course_interest: form.course_interest.trim() || null,
        stage: form.stage,
      })});
      onCreated();
      onClose();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      onError(message);
    } finally { setBusy(false); }
  }

  return <div className="drawer-backdrop" onClick={onClose}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <header><h2>Novo Lead</h2><button title="Fechar" onClick={onClose}><X/></button></header>
      {error && <div className="alert error">{error}</div>}
      <form className="form-grid" onSubmit={submit}>
        <label>Nome<input value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Nome completo" required/></label>
        <label>Telefone<input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="(00) 00000-0000" required/></label>
        <label>Email<input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="nome@email.com"/></label>
        <label>Zona<select value={form.zone} onChange={e => setForm({...form,zone:e.target.value as Zone})}><option value="Zona Cinza">Zona Cinza</option><option value="Zona Verde">Zona Verde</option></select></label>
        <label>Consultor<select value={form.consultant_id} onChange={e => setForm({...form,consultant_id:e.target.value})}><option value="">Não atribuído</option>{consultants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Curso de interesse<input value={form.course_interest} onChange={e => setForm({...form,course_interest:e.target.value})} placeholder="Informe o curso"/></label>
        <label className="span-2">Estágio<select value={form.stage} onChange={e => setForm({...form,stage:e.target.value})}>{stages.map(s => <option key={s.stable_key} value={s.stable_key}>{s.name}</option>)}</select></label>
        <div className="span-2 form-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar lead"}</button>
        </div>
      </form>
    </div>
  </div>;
}
