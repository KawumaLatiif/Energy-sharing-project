import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { clearAdminSession, getAdminRole } from "../lib/auth";

const NAV = [
  { to: "/dashboard",    label: "Dashboard",      icon: "📊", roles: ["CUSTOMER_SERVICE","OPERATOR","ADMIN"] },
  { to: "/users",        label: "Users",           icon: "👥", roles: ["CUSTOMER_SERVICE","OPERATOR","ADMIN"] },
  { to: "/support",      label: "Support Queue",   icon: "📞", roles: ["CUSTOMER_SERVICE","OPERATOR","ADMIN"] },
  { to: "/meters",       label: "Meters",          icon: "🔌", roles: ["CUSTOMER_SERVICE","OPERATOR","ADMIN"] },
  { to: "/tokens",       label: "Tokens",          icon: "🎟️", roles: ["CUSTOMER_SERVICE","OPERATOR","ADMIN"] },
  { to: "/transactions", label: "Transactions",    icon: "💳", roles: ["CUSTOMER_SERVICE","OPERATOR","ADMIN"] },
  { to: "/credit-loans", label: "Credit & Loans",  icon: "🏦", roles: ["OPERATOR","ADMIN"] },
  { to: "/reports",      label: "Reports",         icon: "📈", roles: ["OPERATOR","ADMIN"] },
  { to: "/financials",   label: "Financial Stats", icon: "💹", roles: ["OPERATOR","ADMIN"] },
  { to: "/health",       label: "System Health",   icon: "🩺", roles: ["OPERATOR","ADMIN"] },
  { to: "/audit",        label: "Audit Log",       icon: "🔍", roles: ["ADMIN"] },
  { to: "/staff",        label: "Staff Accounts",  icon: "🛡️", roles: ["ADMIN"] },
  { to: "/settings",     label: "Settings",        icon: "⚙️", roles: ["ADMIN"] },
];

const BOTTOM_NAV = [
  { to: "/dashboard",    label: "Home",   icon: "📊" },
  { to: "/users",        label: "Users",  icon: "👥" },
  { to: "/support",      label: "Support", icon: "📞" },
  { to: "/transactions", label: "Txns",   icon: "💳" },
];

const ROLE_LEVEL: Record<string, number> = { CUSTOMER_SERVICE: 1, OPERATOR: 2, ADMIN: 3 };

function RoleBadge({ role, compact }: { role: string | null; compact?: boolean }) {
  return (
    <span className={`font-semibold rounded-full ${
      compact ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
    } ${
      role === "ADMIN" ? "bg-gpawa-blue text-white"
      : role === "OPERATOR" ? "bg-gpawa-cyan/20 text-gpawa-cyan"
      : "bg-white/10 text-gray-300"
    }`}>
      {role}
    </span>
  );
}

function NavItem({ to, label, icon, onNavigate }: {
  to: string; label: string; icon: string; onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors rounded-lg mx-2 ${
          isActive
            ? "bg-gpawa-blue text-white md:border-r-2 md:border-gpawa-cyan md:rounded-none md:mx-0"
            : "text-gray-300 hover:bg-white/8 hover:text-white"
        }`
      }
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function SidebarContent({ role, onNavigate, onLogout }: {
  role: string | null;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const visibleNav = NAV.filter(n =>
    n.roles.some(r => (ROLE_LEVEL[role ?? ""] ?? 0) >= ROLE_LEVEL[r])
  );

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 shrink-0">
        <img src="/logo.jpeg" alt="gPawa" className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 shrink-0" />
        <div className="min-w-0">
          <span className="text-lg font-bold tracking-tight block leading-none">gPawa</span>
          <p className="text-[10px] text-gpawa-cyan mt-0.5 leading-none">Admin Panel</p>
        </div>
      </div>

      <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
        <RoleBadge role={role} />
      </div>

      <nav className="flex-1 py-3 overflow-y-auto space-y-0.5">
        {visibleNav.map(item => (
          <NavItem key={item.to} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      <button
        onClick={onLogout}
        className="m-3 py-2.5 px-4 text-xs text-gray-400 hover:text-white border border-white/15 rounded-lg hover:border-gpawa-cyan/40 transition-colors shrink-0"
      >
        Sign Out
      </button>
    </>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getAdminRole();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  function logout() { clearAdminSession(); navigate("/login"); }
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex flex-col min-h-screen h-[100dvh] bg-gray-100">

      {/* Mobile header */}
      <header
        className="md:hidden shrink-0 flex items-center justify-between h-14 px-3 shadow-md z-30 safe-top"
        style={{ background: "linear-gradient(180deg, #071A3E 0%, #0D2657 100%)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-white/70 hover:text-white p-1 -ml-1"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
            </svg>
          </button>
          <NavLink to="/dashboard" className="flex items-center gap-2 min-w-0">
            <img src="/logo.jpeg" alt="gPawa" className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shrink-0" />
            <span className="text-white font-bold text-sm truncate">gPawa Admin</span>
          </NavLink>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RoleBadge role={role} compact />
          <button onClick={logout} className="text-white/60 hover:text-white p-1.5" aria-label="Sign out">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 100-2H4V5h9a1 1 0 100-2H3zm14.293 4.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L18.586 12H9a1 1 0 110-2h9.586l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">

        {/* Mobile drawer backdrop */}
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 top-14 bg-black/40 z-40 md:hidden"
            onClick={closeMobile}
            aria-label="Close menu"
          />
        )}

        {/* Sidebar : drawer on mobile, fixed on desktop */}
        <aside
          className={[
            "fixed md:static left-0 z-50 md:z-auto top-14 md:top-auto",
            "h-[calc(100dvh-3.5rem)] md:h-auto",
            "w-[min(280px,88vw)] md:w-64",
            "text-white flex flex-col shrink-0 shadow-xl",
            "transition-transform duration-200 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          ].join(" ")}
          style={{ background: "linear-gradient(180deg, #071A3E 0%, #0D2657 100%)" }}
        >
          <SidebarContent role={role} onNavigate={closeMobile} onLogout={logout} />
        </aside>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 pb-24 md:pb-8 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 safe-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
          {BOTTOM_NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors active:scale-95 ${
                  isActive ? "text-gpawa-blue" : "text-gray-500"
                }`
              }
            >
              <span className="text-lg leading-none">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-gray-500 active:scale-95"
          >
            <span className="text-lg leading-none">☰</span>
            <span>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
