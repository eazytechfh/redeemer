import { Clock3, DollarSign, Users, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useState } from "react";
import { PageHead } from "../components";
import { api } from "../lib";

type Range = "today" | "7" | "30" | "90" | "custom";
type StageCount = { stage:string; name:string; color:string; count:number };
type DashboardData = {
  total:number; conversionRate:number; negotiationAmount:number; avgAttendanceMinutes:number|null;
  series:{date:string;count:number}[]; stageCounts:StageCount[];
};
const empty:DashboardData = { total:0, conversionRate:0, negotiationAmount:0, avgAttendanceMinutes:null, series:[], stageCounts:[] };

const currency = (value:number) => value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const formatDay = (date:string) => { const [,m,d] = date.split("-"); return `${d}/${m}`; };
const formatMinutes = (minutes:number|null) => {
  if (minutes == null) return "Não disponível";
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours ? `${hours}h ${mins}min` : `${mins}min`;
};

export function Dashboard(){
  const [range,setRange] = useState<Range>("30");
  const [dateFrom,setDateFrom] = useState("");
  const [dateTo,setDateTo] = useState("");
  const [data,setData] = useState<DashboardData>(empty);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);

  useEffect(() => {
    if (range === "custom" && (!dateFrom || !dateTo)) return;
    setLoading(true); setError("");
    const qs = new URLSearchParams({ range });
    if (range === "custom") { qs.set("dateFrom", dateFrom); qs.set("dateTo", dateTo); }
    api<DashboardData>(`/crm/dashboard?${qs}`)
      .then(setData)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [range, dateFrom, dateTo]);

  const metrics: [string,string,typeof Users][] = [
    ["Total de candidatos", String(data.total), Users],
    ["Taxa de conversão", `${data.conversionRate.toLocaleString("pt-BR")}%`, Zap],
    ["Em negociação", currency(data.negotiationAmount), DollarSign],
    ["Tempo até atendimento", formatMinutes(data.avgAttendanceMinutes), Clock3],
  ];
  const maxStageCount = Math.max(1, ...data.stageCounts.map(s => s.count));

  return <>
    <PageHead title="Visão Geral" subtitle="Acompanhe o desempenho da sua operação comercial.">
      <select value={range} onChange={e => setRange(e.target.value as Range)}>
        <option value="today">Hoje</option>
        <option value="7">7 dias</option>
        <option value="30">30 dias</option>
        <option value="90">90 dias</option>
        <option value="custom">Personalizado</option>
      </select>
      {range === "custom" && <div className="date-filter">
        <label>De<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/></label>
        <label>Até<input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}/></label>
      </div>}
    </PageHead>
    {error && <div className="alert error">{error}</div>}
    <div className="metrics">
      {metrics.map(([label,value,Icon]) => <div className="metric" key={label}>
        <div><span>{label}</span><strong>{loading ? "…" : value}</strong></div>
        <i><Icon/></i>
      </div>)}
    </div>
    <div className="dashboard-grid">
      <section className="card chart-card">
        <div className="card-title"><div><h2>Entrada de candidatos</h2><p>Novos contatos ao longo do período</p></div><b>{data.total} candidato{data.total===1?"":"s"}</b></div>
        {data.series.length ? <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.series.map(s => ({d:formatDay(s.date),v:s.count}))}>
            <defs><linearGradient id="red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e5373f" stopOpacity=".28"/><stop offset="1" stopColor="#e5373f" stopOpacity="0"/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
            <XAxis dataKey="d"/><YAxis allowDecimals={false}/><Tooltip/>
            <Area type="monotone" dataKey="v" stroke="#e5373f" strokeWidth={3} fill="url(#red)"/>
          </AreaChart>
        </ResponsiveContainer> : <div className="drawer-loading">Nenhum cadastro no período selecionado.</div>}
      </section>
      <section className="card">
        <div className="card-title"><div><h2>Estágios do funil</h2><p>Distribuição atual</p></div></div>
        {data.stageCounts.length ? data.stageCounts.map(s => <div className="progress" key={s.stage}>
          <span>{s.name}<b>{s.count}</b></span>
          <i><em style={{width:`${(s.count/maxStageCount)*100}%`,background:s.color}}/></i>
        </div>) : <div className="drawer-loading">Nenhum lead cadastrado.</div>}
      </section>
    </div>
  </>;
}
