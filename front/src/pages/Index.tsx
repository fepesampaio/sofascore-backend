import { useState } from "react";
import { ExtractionPanel } from "@/components/ExtractionPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { AppSidebar } from "@/components/AppSidebar";
import sofascoreIcon from "@/assets/sofascore-icon.png";

type TabId = "extraction" | "settings" | "history";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("extraction");

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1">
        {/* Header */}
        <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b bg-primary px-6">
		<img src={sofascoreIcon} alt="Ícone" className="w-8 h-8" />
          <span className="text-sm font-bold uppercase tracking-wider text-primary-foreground">
            Sofascore
          </span>
          <span className="text-sm font-light uppercase tracking-wider text-primary-foreground/70">
            Extractor
          </span>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-[1200px] p-6">
          {activeTab === "extraction" && <ExtractionPanel />}
          {activeTab === "settings" && <SettingsPanel />}
          {activeTab === "history" && <HistoryPanel />}
        </main>
      </div>
    </div>
  );
};

export default Index;
