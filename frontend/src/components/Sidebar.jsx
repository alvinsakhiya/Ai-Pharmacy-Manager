import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  AlertTriangle,
  Settings,
  Brain,
} from "lucide-react";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { name: "Patients", icon: Users, path: "/patients" },
  { name: "Inventory", icon: Package, path: "/inventory" },
  { name: "Dosette", icon: ClipboardList, path: "/dosette" },
  { name: "Picking Lists", icon: ClipboardList, path: "/picking-lists" },
  { name: "Alerts", icon: AlertTriangle, path: "/alerts" },
  { name: "Settings", icon: Settings, path: "/settings" },
  { name: "AI Forecasting", icon: Brain, path: "/forecasts" },
];

function Sidebar() {
  return (
    <aside className="w-72 min-h-screen bg-slate-950 text-white p-6">
      <div className="mb-10">
        <h1 className="text-2xl font-bold">PharmaCare</h1>
        <p className="text-sm text-slate-400 mt-1">Stock & Dosette System</p>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
                  isActive
                    ? "bg-white text-slate-950"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;