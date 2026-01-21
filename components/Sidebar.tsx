"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isJournalist, setIsJournalist] = useState(false);

  useEffect(() => {
    // Carrega dados do usuário do localStorage
    if (typeof window !== "undefined") {
      const userJson = localStorage.getItem("revoada_user");
      if (userJson) {
        const userData = JSON.parse(userJson);
        setUser(userData);
      }

      const journalistStatus = localStorage.getItem("revoada_is_journalist");
      setIsJournalist(journalistStatus === "true");
    }
  }, []);

  // Não mostrar Sidebar na home pública
  useEffect(() => {
    if (pathname === "/") {
      document.body.classList.remove("with-sidebar");
    } else {
      document.body.classList.add("with-sidebar");
    }
    return () => {
      document.body.classList.remove("with-sidebar");
    };
  }, [pathname]);

  if (pathname === "/") {
    return null;
  }

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img
          src="/images/Logo_policia.png"
          alt="Logo Polícia"
          className="sidebar-logo"
          style={{ width: "80px", height: "auto", marginBottom: "15px", objectFit: "contain", filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))" }}
        />
        <h2>INTRANET<br />POLICIAL</h2>
      </div>

      <ul className="sidebar-menu">
        <li>
          <Link
            href="/dashboard"
            className={isActive("/dashboard") ? "active" : ""}
          >
            <i className="fa-solid fa-gauge-high"></i> Painel Operacional
          </Link>
        </li>

        <li className="sidebar-section-title">DEPARTAMENTOS</li>
        <li>
          <Link href="/pcerj">
            <i className="fa-solid fa-magnifying-glass"></i> PCERJ
          </Link>
        </li>
        <li>
          <Link href="/pmerj">
            <i className="fa-solid fa-person-military-rifle"></i> PMERJ
          </Link>
        </li>
        <li>
          <Link href="/prf">
            <i className="fa-solid fa-road"></i> PRF
          </Link>
        </li>
        <li>
          <Link href="/pf">
            <i className="fa-solid fa-building-shield"></i> PF
          </Link>
        </li>

        <li className="sidebar-section-title">SERVIÇOS</li>
        <li>
          <Link href="/#boletim">
            <i className="fa-solid fa-clipboard"></i> Registrar B.O.
          </Link>
        </li>

        <li className="sidebar-section-title">INTERNO</li>
        <li>
          <Link href="/#cursos">
            <i className="fa-solid fa-graduation-cap"></i> Cursos e Treinamentos
          </Link>
        </li>

        {isJournalist && (
          <li>
            <Link href="/#jornalistas">
              <i className="fa-solid fa-camera"></i> Área Jornalista
            </Link>
          </li>
        )}

        <li style={{ marginTop: "20px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <Link href="/">
            <i className="fa-solid fa-power-off"></i> Sair / Voltar ao Início
          </Link>
        </li>
      </ul>

      <div className="user-mini-profile" id="sidebar-user">
        {user && (
          <>
            <img
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
              alt={user.username}
              style={{ width: "40px", height: "40px", borderRadius: "50%" }}
            />
            <div>
              <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                {user.username}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Online
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
