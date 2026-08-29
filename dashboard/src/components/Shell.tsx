import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { logout } from "../lib/api/auth";

export const navItems = [
  { to: "/", label: "Overview" },
  { to: "/devices", label: "Devices" },
  { to: "/control", label: "Control" },
  { to: "/resources", label: "Resources" },
  { to: "/settings", label: "Settings" },
  { to: "/docs", label: "Documentation" },
];

export function Shell({ children }: { children: ReactNode }) {
  const admin = useAuthStore((s) => s.admin);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // best-effort — clear the local session regardless
    }
    clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="leading-tight">
              <span className="text-lg font-semibold tracking-tight text-primary-800">IoTStack</span>
              <span className="block text-[11px] font-medium text-slate-400">v{__APP_VERSION__}</span>
            </div>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary-800 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{admin?.email}</span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
