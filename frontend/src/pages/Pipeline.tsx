import { Activity, ArrowLeft, BriefcaseBusiness, CalendarDays, Check, ChevronRight, Circle, FileText, History, MessageCircle, Plus, Save, Search, Tag, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PageHead } from "../components";
import { api } from "../lib";

type Zone = "Zona Cinza" | "Zona Verde";
type TagType = { id:string; name:string; color:string };
export type Client = {
  id:number; created_at:string; "Numero do cliente"?:string; "nome do cliente"?:string;
  Cliente?:string; estagio_lead?:string|null; ZONA?:string; resumo_qualificacao?:string;
  cpf?:string|null; birth_date?:string|null; source?:string|null; notes?:string|null;
  tags?:TagType[];
};
type Consultant={id:string;name:string};
type Negotiation={id?:string;course_interest:string|null;amount:number|null;consultant_id:string|null};
type AuditLog={id:number;action:string;field:string|null;old_value:unknown;new_value:unknown;created_at:string;user?:{name:string}|null};
type ClientDetails={client:Client;negotiation:Negotiation|null;logs:AuditLog[];schemaPending?:boolean};
const defaultStages=[
  ["novos_leads","Novos Leads","#4273e8"],["em_qualificacao","Em Qualificação","#e0a12a"],
  ["transferido","Transferido para o Humano","#8d51d8"],["agendado","Agendado para a Reunião","#4d9bbf"],
  ["orcamento_enviado","Orçamento Enviado","#e5683f"],["follow_up","Follow Up","#d94c78"],
  ["matricula_feita","Matrícula Feita","#2ba675"],["pagou","Pagou","#168f63"],
  ["contrato_assinado","Contrato Assinado","#26795c"],["analise","Análise","#6574cd"],
] as const;
type PipelineStage={id?:string;stable_key:string;name:string;color:string;position:number};
const PAGE_SIZE=10;
const clientName=(c:Client)=>c["nome do cliente"]||c.Cliente||"Candidato sem nome";
const whatsappDigits=(phone?:string|null)=>(phone||"").replace(/\D/g,"");
const whatsappUrl=(phone?:string|null)=>{const digits=whatsappDigits(phone);return digits?`https://wa.me/${digits}`:null};
const openWhatsapp=(phone?:string|null)=>{const url=whatsappUrl(phone);if(url)window.open(url,"_blank","noopener,noreferrer")};
const calculateAge=(birthDate?:string|null)=>{if(!birthDate)return null;const birth=new Date(`${birthDate}T12:00:00`);const today=new Date();let age=today.getFullYear()-birth.getFullYear();if(today.getMonth()<birth.getMonth()||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate()))age--;return Math.max(0,age)};
export function Pipeline(){
  const [zone,setZone]=useState<Zone|null>(null); const [clients,setClients]=useState<Client[]>([]);
  const [stages,setStages]=useState<PipelineStage[]>(defaultStages.map(([stable_key,name,color],position)=>({stable_key,name,color,position:position+1})));
  const [search,setSearch]=useState(""); const [selected,setSelected]=useState<Client|null>(null); const [error,setError]=useState("");
  const [tagId,setTagId]=useState(""); const [tagsList,setTagsList]=useState<TagType[]>([]);
  const [pages,setPages]=useState<Record<string,number>>({});
  const kanbanRef=useRef<HTMLDivElement|null>(null); const mirrorRef=useRef<HTMLDivElement|null>(null);
  const [kanbanScrollWidth,setKanbanScrollWidth]=useState(0); const syncingRef=useRef(false);
  const load=async(z:Zone)=>{setError("");try{const qs=new URLSearchParams({zone:z});if(tagId)qs.set("tagId",tagId);setClients(await api(`/crm/clients?${qs}`))}catch(e){setError((e as Error).message)}};
  useEffect(()=>{api<PipelineStage[]>("/configuration/pipeline-stages").then(setStages).catch(()=>{});api<TagType[]>("/crm/tags").then(setTagsList).catch(()=>{})},[]);
  useEffect(()=>{if(zone)void load(zone)},[zone,tagId]);
  useEffect(()=>{setPages({})},[zone,tagId,search]);
  const filtered=useMemo(()=>clients.filter(c=>clientName(c).toLowerCase().includes(search.toLowerCase())),[clients,search]);
  useLayoutEffect(()=>{
    const el=kanbanRef.current; if(!el)return;
    const update=()=>setKanbanScrollWidth(el.scrollWidth);
    update();
    const observer=new ResizeObserver(update);
    observer.observe(el);
    for(const child of Array.from(el.children))observer.observe(child);
    return ()=>observer.disconnect();
  },[zone,stages,filtered,pages]);
  const handleKanbanScroll=()=>{if(syncingRef.current){syncingRef.current=false;return}if(mirrorRef.current&&kanbanRef.current){syncingRef.current=true;mirrorRef.current.scrollLeft=kanbanRef.current.scrollLeft}};
  const handleMirrorScroll=()=>{if(syncingRef.current){syncingRef.current=false;return}if(mirrorRef.current&&kanbanRef.current){syncingRef.current=true;kanbanRef.current.scrollLeft=mirrorRef.current.scrollLeft}};
  async function move(id:number,stage:string){const before=clients;setClients(x=>x.map(c=>c.id===id?{...c,estagio_lead:stage}:c));try{await api(`/crm/clients/${id}/stage`,{method:"PATCH",body:JSON.stringify({stage})})}catch(e){setClients(before);setError((e as Error).message)}}
  if(!zone)return <><PageHead title="Pipelines" subtitle="Escolha a zona comercial que deseja acompanhar."/><div className="zone-grid"><button onClick={()=>setZone("Zona Cinza")} className="zone-card gray"><i><Circle/></i><div><h2>Zona Cinza</h2><p>Leads em entrada, qualificação e preparação.</p></div><ChevronRight/></button><button onClick={()=>setZone("Zona Verde")} className="zone-card green"><i><Check/></i><div><h2>Zona Verde</h2><p>Oportunidades avançadas e matrículas.</p></div><ChevronRight/></button></div></>;
  return <><PageHead title={zone} subtitle="Arraste os candidatos para atualizar a etapa no CRM."><button className="secondary" onClick={()=>setZone(null)}><ArrowLeft/>Trocar zona</button><div className="search compact"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar candidato"/></div><select value={tagId} onChange={e=>setTagId(e.target.value)}><option value="">Todas as etiquetas</option>{tagsList.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></PageHead>{error&&<div className="alert error">{error}</div>}<div className="kanban-scroll-mirror" ref={mirrorRef} onScroll={handleMirrorScroll}><div style={{width:kanbanScrollWidth,height:1}}/></div><div className="kanban" ref={kanbanRef} onScroll={handleKanbanScroll}>{stages.map(({stable_key:key,name:label,color})=>{
    const items=filtered.filter(c=>(c.estagio_lead||"novos_leads")===key);
    const totalPages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));
    const page=Math.min(pages[key]||1,totalPages);
    const pageItems=items.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
    const goToPage=(p:number)=>setPages(prev=>({...prev,[key]:p}));
    return <section className="kanban-col" key={key} onDragOver={e=>e.preventDefault()} onDrop={e=>void move(Number(e.dataTransfer.getData("client")),key)}>
      <header style={{borderColor:color}}><b>{label}</b><span>{items.length}</span></header>
      <div className="kanban-pager"><button className="secondary" disabled={page<=1} onClick={()=>goToPage(page-1)}>{"< Anterior"}</button><span>Página {page} de {totalPages}</span><button className="secondary" disabled={page>=totalPages} onClick={()=>goToPage(page+1)}>{"Próxima >"}</button></div>
      <div className="kanban-col-body">{pageItems.map(c=><article className="lead-card" draggable onDragStart={e=>e.dataTransfer.setData("client",String(c.id))} onClick={()=>setSelected(c)} key={c.id}><div><span className="avatar mini">{clientName(c).slice(0,2).toUpperCase()}</span><b>{clientName(c)}</b></div><p>{c["Numero do cliente"]||"Telefone não informado"}</p><div className="card-tags">{c.tags?.map(t=><span key={t.id} style={{backgroundColor:`${t.color}20`,color:t.color}}>{t.name}</span>)}</div><footer><small>{new Date(c.created_at).toLocaleDateString("pt-BR")}</small><div className="card-footer-right">{whatsappUrl(c["Numero do cliente"])&&<button type="button" className="whatsapp-icon-btn" title="Chamar no WhatsApp" onClick={e=>{e.stopPropagation();openWhatsapp(c["Numero do cliente"])}}><MessageCircle size={16}/></button>}<span>#{c.id}</span></div></footer></article>)}</div>
    </section>
  })}</div>{selected&&<ClientDrawer client={selected} onClose={()=>setSelected(null)} onChanged={()=>zone&&load(zone)}/>}</>
}
export function ClientDrawer({client,onClose,onChanged}:{client:Client;onClose:()=>void;onChanged:()=>void}){
 const emptyNegotiation={course_interest:"",amount:"",consultant_id:""};
 const [details,setDetails]=useState<ClientDetails>({client,negotiation:null,logs:[]});
 const [tags,setTags]=useState<TagType[]>([]);const [consultants,setConsultants]=useState<Consultant[]>([]);
 const [assignedIds,setAssignedIds]=useState(()=>new Set(client.tags?.map(t=>t.id)||[]));
 const [personal,setPersonal]=useState({cpf:"",birth_date:"",source:""});const [negotiation,setNegotiation]=useState(emptyNegotiation);const [notes,setNotes]=useState("");
 const [name,setName]=useState("");const [color,setColor]=useState("#d92f38");const [error,setError]=useState("");const [message,setMessage]=useState("");const [loading,setLoading]=useState(true);
 const applyDetails=(data:ClientDetails)=>{setDetails(data);setPersonal({cpf:data.client.cpf||"",birth_date:data.client.birth_date||"",source:data.client.source||""});setNegotiation({course_interest:data.negotiation?.course_interest||"",amount:data.negotiation?.amount==null?"":String(data.negotiation.amount),consultant_id:data.negotiation?.consultant_id||""});setNotes(data.client.notes||"")};
 const loadDetails=async()=>{setLoading(true);setError("");try{const [data,allTags,allConsultants]=await Promise.all([api<ClientDetails>(`/crm/clients/${client.id}`),api<TagType[]>("/crm/tags"),api<Consultant[]>("/crm/consultants")]);applyDetails(data);setTags(allTags);setConsultants(allConsultants)}catch(e){setError((e as Error).message)}finally{setLoading(false)}};
 useEffect(()=>{void loadDetails()},[client.id]);
 const age=calculateAge(details.client.birth_date);
 const stageName=(value:unknown)=>defaultStages.find(([key])=>key===value)?.[1]||String(value||"Não definida");
 const displayValue=(value:unknown)=>value==null||value===""?"Não informado":typeof value==="object"?JSON.stringify(value):String(value);
 const logValue=(field:string|null,value:unknown)=>{if(field==="consultant_id")return consultants.find(item=>item.id===value)?.name||displayValue(value);if(field==="amount"&&typeof value==="number")return value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});if(field==="birth_date"&&typeof value==="string")return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");return displayValue(value)};
 const fieldLabel:Record<string,string>={cpf:"CPF",birth_date:"Data de nascimento",source:"Origem",notes:"Observações",course_interest:"Curso de interesse",amount:"Valor",consultant_id:"Consultor"};
 const movements=details.logs.filter(log=>log.action==="stage_changed"||log.field==="estagio_lead");const generalLogs=details.logs.filter(log=>log.action!=="stage_changed"&&log.field!=="estagio_lead");
 const whatsappHref=whatsappUrl(details.client["Numero do cliente"]);
 async function saveProfile(){setError("");setMessage("");try{await api(`/crm/clients/${client.id}`,{method:"PATCH",body:JSON.stringify({cpf:personal.cpf||null,birth_date:personal.birth_date||null,source:personal.source||null,negotiation:{course_interest:negotiation.course_interest||null,amount:negotiation.amount===""?null:Number(negotiation.amount),consultant_id:negotiation.consultant_id||null}})});setMessage("Dados atualizados com sucesso.");await loadDetails();onChanged()}catch(e){setError((e as Error).message)}}
 async function saveNotes(){setError("");setMessage("");try{await api(`/crm/clients/${client.id}`,{method:"PATCH",body:JSON.stringify({notes:notes||null})});setMessage("Observação salva com sucesso.");await loadDetails()}catch(e){setError((e as Error).message)}}
 async function create(){try{const tag=await api<TagType>("/crm/tags",{method:"POST",body:JSON.stringify({name,color,linked_stage:null})});await api(`/crm/clients/${client.id}/tags/${tag.id}`,{method:"POST"});setAssignedIds(current=>new Set(current).add(tag.id));setName("");await loadDetails();onChanged()}catch(e){setError((e as Error).message)}}
 async function toggle(tag:TagType){const assigned=assignedIds.has(tag.id);try{await api(`/crm/clients/${client.id}/tags/${tag.id}`,{method:assigned?"DELETE":"POST"});setAssignedIds(current=>{const next=new Set(current);assigned?next.delete(tag.id):next.add(tag.id);return next});await loadDetails();onChanged()}catch(e){setError((e as Error).message)}}
 async function removeClient(){if(!confirm("Excluir este lead?\n\nEsta ação é permanente e não poderá ser desfeita."))return;try{await api(`/crm/clients/${client.id}`,{method:"DELETE"});onClose();onChanged()}catch(e){setError((e as Error).message)}}
 return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer candidate-drawer" onClick={e=>e.stopPropagation()}><header><div><small>CANDIDATO</small><h2>{clientName(details.client)}</h2></div><button title="Fechar" onClick={onClose}><X/></button></header>
 {error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}{details.schemaPending&&<div className="alert warning">A migration de detalhes ainda precisa ser aplicada no Supabase para salvar estes campos.</div>}
 {loading?<div className="drawer-loading">Carregando dados...</div>:<>
 <button type="button" className="whatsapp-button" disabled={!whatsappHref} onClick={()=>openWhatsapp(details.client["Numero do cliente"])}><MessageCircle/> Chamar no WhatsApp</button>
 <section className="drawer-section"><h3><UserRound/> Dados pessoais</h3><div className="drawer-grid"><label className="span-2">Nome<input value={clientName(details.client)} readOnly/></label><label>CPF<input value={personal.cpf} onChange={e=>setPersonal({...personal,cpf:e.target.value})} placeholder="000.000.000-00"/></label><label>Data de nascimento<input type="date" value={personal.birth_date} onChange={e=>setPersonal({...personal,birth_date:e.target.value})}/></label><label>Idade<input value={age==null?"Não informada":`${age} anos`} readOnly/></label><label>Telefone<input value={details.client["Numero do cliente"]||"Não informado"} readOnly/></label></div></section>
 <section className="drawer-section"><h3><BriefcaseBusiness/> Negociação</h3><div className="drawer-grid"><label className="span-2">Curso de interesse<input value={negotiation.course_interest} onChange={e=>setNegotiation({...negotiation,course_interest:e.target.value})} placeholder="Informe o curso"/></label><label>Valor<input type="number" min="0" step="0.01" value={negotiation.amount} onChange={e=>setNegotiation({...negotiation,amount:e.target.value})} placeholder="0,00"/></label><label>Consultor<select value={negotiation.consultant_id} onChange={e=>setNegotiation({...negotiation,consultant_id:e.target.value})}><option value="">Não atribuído</option>{consultants.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Origem<input value={personal.source} onChange={e=>setPersonal({...personal,source:e.target.value})} placeholder="Ex.: Instagram"/></label><label>Zona<input value={details.client.ZONA||"Não informada"} readOnly/></label></div><div className="drawer-actions"><button className="primary" onClick={saveProfile}><Save/>Salvar dados</button></div></section>
 <section className="drawer-section"><h3><FileText/> Observações</h3><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Registre informações relevantes sobre o candidato."/><div className="drawer-actions"><button className="secondary" onClick={saveNotes}><Save/>Salvar observação</button></div></section>
 <section className="drawer-section"><h3>Dados atuais</h3><p><b>Resumo</b>{details.client.resumo_qualificacao||"Ainda não disponível."}</p></section>
 <section className="drawer-section"><h3><Tag/> Etiquetas</h3><div className="tag-list">{tags.map(t=><button key={t.id} onClick={()=>toggle(t)} className={assignedIds.has(t.id)?"selected":""}><i style={{background:t.color}}/>{t.name}{assignedIds.has(t.id)&&<Check/>}</button>)}</div><div className="inline-create"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nova etiqueta"/><input type="color" value={color} onChange={e=>setColor(e.target.value)}/><button className="primary" title="Criar etiqueta" onClick={create} disabled={!name}><Plus/></button></div></section>
 <section className="drawer-section"><h3><History/> Histórico de Movimentações</h3><div className="audit-list">{movements.length?movements.map(log=><article key={log.id}><i/><div><b>{stageName(log.old_value)} <span>→</span> {stageName(log.new_value)}</b><small>{log.user?.name||"Automação"} · {new Date(log.created_at).toLocaleString("pt-BR")}</small></div></article>):<p className="drawer-empty">Nenhuma movimentação registrada.</p>}</div></section>
 <section className="drawer-section"><h3><Activity/> Logs Gerais</h3><div className="audit-list">{generalLogs.length?generalLogs.map(log=><article key={log.id}><i/><div><b>{fieldLabel[log.field||""]||log.action}</b><span>{logValue(log.field,log.old_value)} → {logValue(log.field,log.new_value)}</span><small>{log.user?.name||"Sistema"} · {new Date(log.created_at).toLocaleString("pt-BR")}</small></div></article>):<p className="drawer-empty">Nenhuma alteração registrada.</p>}</div></section>
 <section className="drawer-danger"><div><b>Excluir lead</b><p>Remove permanentemente o candidato e seus dados relacionados.</p></div><button onClick={removeClient}><Trash2/>Excluir lead</button></section>
 </>}</aside></div>
}
