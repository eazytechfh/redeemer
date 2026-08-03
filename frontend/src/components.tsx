import { BarChart3, Columns3, GraduationCap, LayoutDashboard, LogOut, Menu, Settings, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./auth";
import { api, roleLabel } from "./lib";

const links=[
  {to:"/",label:"Visão Geral",icon:LayoutDashboard,restricted:true},
  {to:"/candidatos",label:"Candidatos",icon:Users},
  {to:"/pipeline",label:"Pipelines",icon:Columns3},
  {to:"/configuracoes",label:"Configurações",icon:Settings,restricted:true},
];
export function Layout(){
  const {profile,logout}=useAuth(); const [open,setOpen]=useState(false);
  const [branding,setBranding]=useState<{logoUrl:string|null;colors:Record<string,string>}|null>(null);
  useEffect(()=>{void api<any>("/configuration/appearance").then(data=>{setBranding(data);const root=document.documentElement;root.style.setProperty("--red",data.colors.primary);root.style.setProperty("--red2",data.colors.secondary);root.style.setProperty("--text",data.colors.text);root.style.setProperty("--page-bg",data.colors.background)}).catch(()=>{})},[]);
  const visible=links.filter(x=>!(profile?.role==="consultor"&&x.restricted));
  return <div className="app"><aside className={open?"sidebar open":"sidebar"}>
    <div className="brand">{branding?.logoUrl?<img className="brand-logo" src={branding.logoUrl} alt="Logo"/>:<span className="brand-icon"><GraduationCap/></span>}<div><b>EazyLeads</b><small>CRM EDUCACIONAL</small></div><button className="mobile-close" onClick={()=>setOpen(false)}><X/></button></div>
    <nav>{visible.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==="/"} onClick={()=>setOpen(false)}><Icon size={19}/>{label}</NavLink>)}</nav>
    <div className="profile"><span className="avatar">{profile?.name?.slice(0,2).toUpperCase()}</span><div><b>{profile?.name}</b><small>{profile&&roleLabel[profile.role]}</small></div><button title="Sair" onClick={logout}><LogOut size={18}/></button></div>
  </aside><main><header className="topbar"><button className="menu" onClick={()=>setOpen(true)}><Menu/></button><div/><span className="status-dot"/> <span>Operação online</span></header><div className="content"><Outlet/></div></main></div>
}
export function PageHead({title,subtitle,children}:{title:string;subtitle:string;children?:React.ReactNode}){return <div className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="actions">{children}</div></div>}
export function Badge({children,tone="neutral"}:{children:React.ReactNode;tone?:string}){return <span className={`badge ${tone}`}>{children}</span>}
export function Empty({title,text}:{title:string;text:string}){return <div className="empty"><BarChart3/><h3>{title}</h3><p>{text}</p></div>}
