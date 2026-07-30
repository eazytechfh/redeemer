import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, Protected } from "./auth";
import { Layout } from "./components";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Candidates } from "./pages/Candidates";
import { Pipeline } from "./pages/Pipeline";
import { Courses } from "./pages/Courses";
import { Settings } from "./pages/Settings";
export default function App(){return <BrowserRouter><AuthProvider><Routes><Route path="/login" element={<Login/>}/><Route element={<Protected><Layout/></Protected>}><Route index element={<Protected roles={["gestor","admin","admin_master"]}><Dashboard/></Protected>}/><Route path="candidatos" element={<Candidates/>}/><Route path="pipeline" element={<Pipeline/>}/><Route path="cursos" element={<Protected roles={["gestor","admin","admin_master"]}><Courses/></Protected>}/><Route path="configuracoes" element={<Protected roles={["gestor","admin","admin_master"]}><Settings/></Protected>}/></Route></Routes></AuthProvider></BrowserRouter>}

