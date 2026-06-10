import { LayoutDashboard, Users, Package, ClipboardList, AlertTriangle, Settings } from "lucide-react";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Patients", icon: Users },
  { name: "Inventory", icon: Package },
  { name: "Picking Lists", icon: ClipboardList },
  { name: "Alerts", icon: AlertTriangle },
  { name: "Settings", icon: Settings },
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
            <button
              key={item.name}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;