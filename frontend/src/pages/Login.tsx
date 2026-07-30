import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, LockKeyhole, Mail } from "lucide-react";
import { supabase } from "../lib";
import { useAuth } from "../auth";

export function Login(){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const {profile,refresh}=useAuth(); const navigate=useNavigate();
  useEffect(()=>{if(profile)navigate(profile.role==="consultor"?"/candidatos":"/",{replace:true});},[profile]);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error){setError(error.message.toLowerCase().includes("invalid")?"E-mail ou senha incorretos.":"Não foi possível entrar. Verifique seu acesso.");setBusy(false);return;}
    await refresh(); setBusy(false);
  }
  return <div className="login-page"><div className="login-orb one"/><div className="login-orb two"/><form className="login-card" onSubmit={submit}>
    <div className="login-logo"><GraduationCap/></div><h1>EduClick</h1><div className="crm-title">CRM</div><p>Gestão educacional que transforma oportunidades em matrículas.</p>
    {error&&<div className="alert error">{error}</div>}
    <label>E-mail<div className="input-icon"><Mail/><input type="email" placeholder="voce@empresa.com" value={email} onChange={e=>setEmail(e.target.value)} required/></div></label>
    <label>Senha<div className="input-icon"><LockKeyhole/><input type="password" placeholder="Sua senha" value={password} onChange={e=>setPassword(e.target.value)} required/></div></label>
    <button className="primary full" disabled={busy}>{busy?"Entrando…":"Entrar"}</button><small className="secure">Acesso seguro e protegido</small>
  </form></div>
}

