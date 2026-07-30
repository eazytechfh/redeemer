import { Download, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Badge, PageHead } from "../components";
const rows=[
 ["Mariana Costa","(11) 98765-4321","Instagram","Ana Souza","MBA em Gestão de Projetos","Em negociação","R$ 890"],
 ["Rafael Oliveira","(21) 99872-1144","Google Ads","Carlos Lima","Mestrado em Administração","Qualificação","R$ 1.490"],
 ["Juliana Martins","(31) 98841-7732","Indicação","Ana Souza","Doutorado em Educação","Novo contato","R$ 1.890"],
 ["Lucas Ferreira","(41) 99712-5821","WhatsApp","Beatriz Alves","Especialização em Liderança","Follow-up","R$ 690"],
];
export function Candidates(){return <><PageHead title="Candidatos" subtitle="Gerencie contatos e oportunidades de matrícula."><button className="secondary"><Download/>Exportar CSV</button><button className="primary"><Plus/>Novo candidato</button></PageHead>
<div className="card filters"><div className="search"><Search/><input placeholder="Buscar por nome, telefone ou e-mail"/></div><select><option>Todas as origens</option></select><select><option>Todos os consultores</option></select><button className="secondary"><SlidersHorizontal/>Filtros</button></div>
<div className="table-card"><div className="table-top"><b>1.248 candidatos encontrados</b><div className="pills"><button className="active">30 dias</button><button>90 dias</button><button>Todos</button></div></div><div className="table-scroll"><table><thead><tr><th>Candidato</th><th>Origem</th><th>Consultor</th><th>Curso de interesse</th><th>Estágio</th><th>Valor</th></tr></thead><tbody>{rows.map(r=><tr key={r[0]}><td><b>{r[0]}</b><small>{r[1]} · Hoje, 10:32</small></td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td><Badge tone="red">{r[5]}</Badge></td><td><b>{r[6]}</b></td></tr>)}</tbody></table></div></div></>}

