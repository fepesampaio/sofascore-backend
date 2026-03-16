import { BarChart3, Settings, History, Sun, Moon, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

const NAV_ITEMS = [
  { id: "extraction" as const, label: "Extração", icon: BarChart3 },
  { id: "settings" as const, label: "Configurações", icon: Settings },
  { id: "history" as const, label: "Histórico", icon: History },
];

type TabId = "extraction" | "settings" | "history";

interface AppSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="sticky top-0 flex h-screen w-16 flex-col items-center border-r bg-card py-4 transition-colors">
      {/* Logo */}
      <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
        <Activity className="h-5 w-5" />
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={item.label}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {isActive && (
                <div className="absolute -left-[1px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        title={theme === "light" ? "Modo escuro" : "Modo claro"}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>
    </aside>
  );
}
