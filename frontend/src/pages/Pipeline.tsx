import { ArrowLeft, Check, ChevronRight, Circle, Plus, Search, Tag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHead } from "../components";
import { api } from "../lib";

type Zone = "Zona Cinza" | "Zona Verde";
type TagType = { id:string; name:string; color:string };
type Client = {
  id:number; created_at:string; "Numero do cliente"?:string; "nome do cliente"?:string;
  Cliente?:string; estagio_lead?:string|null; ZONA?:string; resumo_qualificacao?:string;
  tags?:TagType[];
};
const defaultStages=[
  ["novos_leads","Novos Leads","#4273e8"],["em_qualificacao","Em Qualificação","#e0a12a"],
  ["transferido","Transferido para o Humano","#8d51d8"],["agendado","Agendado para a Reunião","#4d9bbf"],
  ["orcamento_enviado","Orçamento Enviado","#e5683f"],["follow_up","Follow Up","#d94c78"],
  ["matricula_feita","Matrícula Feita","#2ba675"],["pagou","Pagou","#168f63"],
  ["contrato_assinado","Contrato Assinado","#26795c"],["analise","Análise","#6574cd"],
] as const;
type PipelineStage={id?:string;stable_key:string;name:string;color:string;position:number};
const clientName=(c:Client)=>c["nome do cliente"]||c.Cliente||"Candidato sem nome";
export function Pipeline(){
  const [zone,setZone]=useState<Zone|null>(null); const [clients,setClients]=useState<Client[]>([]);
  const [stages,setStages]=useState<PipelineStage[]>(defaultStages.map(([stable_key,name,color],position)=>({stable_key,name,color,position:position+1})));
  const [search,setSearch]=useState(""); const [selected,setSelected]=useState<Client|null>(null); const [error,setError]=useState("");
  const load=async(z:Zone)=>{setError("");try{setClients(await api(`/crm/clients?zone=${encodeURIComponent(z)}`))}catch(e){setError((e as Error).message)}};
  useEffect(()=>{api<PipelineStage[]>("/configuration/pipeline-stages").then(setStages).catch(()=>{});if(zone)void load(zone)},[zone]);
  const filtered=useMemo(()=>clients.filter(c=>clientName(c).toLowerCase().includes(search.toLowerCase())),[clients,search]);
  async function move(id:number,stage:string){const before=clients;setClients(x=>x.map(c=>c.id===id?{...c,estagio_lead:stage}:c));try{await api(`/crm/clients/${id}/stage`,{method:"PATCH",body:JSON.stringify({stage})})}catch(e){setClients(before);setError((e as Error).message)}}
  if(!zone)return <><PageHead title="Pipelines" subtitle="Escolha a zona comercial que deseja acompanhar."/><div className="zone-grid"><button onClick={()=>setZone("Zona Cinza")} className="zone-card gray"><i><Circle/></i><div><h2>Zona Cinza</h2><p>Leads em entrada, qualificação e preparação.</p></div><ChevronRight/></button><button onClick={()=>setZone("Zona Verde")} className="zone-card green"><i><Check/></i><div><h2>Zona Verde</h2><p>Oportunidades avançadas e matrículas.</p></div><ChevronRight/></button></div></>;
  return <><PageHead title={zone} subtitle="Arraste os candidatos para atualizar a etapa no CRM."><button className="secondary" onClick={()=>setZone(null)}><ArrowLeft/>Trocar zona</button><div className="search compact"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar candidato"/></div></PageHead>{error&&<div className="alert error">{error}</div>}<div className="kanban">{stages.map(({stable_key:key,name:label,color})=>{const items=filtered.filter(c=>(c.estagio_lead||"novos_leads")===key);return <section className="kanban-col" key={key} onDragOver={e=>e.preventDefault()} onDrop={e=>void move(Number(e.dataTransfer.getData("client")),key)}><header style={{borderColor:color}}><b>{label}</b><span>{items.length}</span></header>{items.map(c=><article className="lead-card" draggable onDragStart={e=>e.dataTransfer.setData("client",String(c.id))} onClick={()=>setSelected(c)} key={c.id}><div><span className="avatar mini">{clientName(c).slice(0,2).toUpperCase()}</span><b>{clientName(c)}</b></div><p>{c["Numero do cliente"]||"Telefone não informado"}</p><div className="card-tags">{c.tags?.map(t=><span key={t.id} style={{backgroundColor:`${t.color}20`,color:t.color}}>{t.name}</span>)}</div><footer><small>{new Date(c.created_at).toLocaleDateString("pt-BR")}</small><span>#{c.id}</span></footer></article>)}</section>})}</div>{selected&&<ClientDrawer client={selected} onClose={()=>setSelected(null)} onChanged={()=>zone&&load(zone)}/>}</>
}
function ClientDrawer({client,onClose,onChanged}:{client:Client;onClose:()=>void;onChanged:()=>void}){
 const [tags,setTags]=useState<TagType[]>([]);const [name,setName]=useState("");const [color,setColor]=useState("#d92f38");const [error,setError]=useState("");
 const load=()=>api<TagType[]>("/crm/tags").then(setTags).catch(e=>setError(e.message));useEffect(()=>{void load()},[]);
 async function create(){try{const tag=await api<TagType>("/crm/tags",{method:"POST",body:JSON.stringify({name,color})});await api(`/crm/clients/${client.id}/tags/${tag.id}`,{method:"POST"});setName("");await load();onChanged()}catch(e){setError((e as Error).message)}}
 async function toggle(tag:TagType){const assigned=client.tags?.some(t=>t.id===tag.id);try{await api(`/crm/clients/${client.id}/tags/${tag.id}`,{method:assigned?"DELETE":"POST"});onChanged()}catch(e){setError((e as Error).message)}}
 return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={e=>e.stopPropagation()}><header><div><small>CANDIDATO</small><h2>{clientName(client)}</h2></div><button onClick={onClose}><X/></button></header>{error&&<div className="alert error">{error}</div>}<div className="drawer-section"><h3>Dados do contato</h3><p><b>Telefone</b>{client["Numero do cliente"]||"Não informado"}</p><p><b>Zona</b>{client.ZONA}</p><p><b>Resumo</b>{client.resumo_qualificacao||"Ainda não disponível."}</p></div><div className="drawer-section"><h3><Tag/> Etiquetas</h3><div className="tag-list">{tags.map(t=><button key={t.id} onClick={()=>toggle(t)} className={client.tags?.some(x=>x.id===t.id)?"selected":""}><i style={{background:t.color}}/>{t.name}{client.tags?.some(x=>x.id===t.id)&&<Check/>}</button>)}</div><div className="inline-create"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nova etiqueta"/><input type="color" value={color} onChange={e=>setColor(e.target.value)}/><button className="primary" onClick={create} disabled={!name}><Plus/></button></div></div></aside></div>
}
