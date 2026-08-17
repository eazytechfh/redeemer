import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, type Profile, type Role, supabase } from "./lib";

type AuthValue={ profile:Profile|null; loading:boolean; refresh:()=>Promise<void>; logout:()=>Promise<void> };
const AuthContext=createContext<AuthValue>(null!);
export function AuthProvider({children}:{children:React.ReactNode}){
  const [profile,setProfile]=useState<Profile|null>(null); const [loading,setLoading]=useState(true);
  const refresh=async()=>{ try { setProfile(await api<Profile>("/me")); } catch { setProfile(null); } finally { setLoading(false); } };
  useEffect(()=>{ void refresh(); const {data}=supabase.auth.onAuthStateChange(()=>setTimeout(refresh,0)); return()=>data.subscription.unsubscribe(); },[]);
  const logout=async()=>{ await supabase.auth.signOut(); setProfile(null); };
  return <AuthContext.Provider value={{profile,loading,refresh,logout}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
export function Protected({children,roles}:{children:React.ReactNode;roles?:Role[]}){
  const {profile,loading}=useAuth(); const location=useLocation();
  if(loading)return <div className="splash">Carregando…</div>;
  if(!profile)return <Navigate to="/login" replace state={{from:location}}/>;
  if(roles&&!roles.includes(profile.role))return <Navigate to={profile.role==="consultor"?"/candidatos":"/"} replace/>;
  return children;
}

