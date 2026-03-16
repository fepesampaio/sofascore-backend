import { useState, useRef, useEffect } from "react";
import { Trophy, Calendar, Play, Square, BarChart3, Zap, Layers, FileText, Database, CircleDot, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox as CheckboxUI } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useExtraction } from "@/components/ExtractionContext";

const LEAGUES_DATA = [
  { name: "Brasileirão Série A", id: "325", format: "br" },
  { name: "Brasileirão Série B", id: "390", format: "br" },
  { name: "Copa do Brasil", id: "373", format: "br" },
  { name: "Copa Libertadores", id: "384", format: "br" },
  { name: "Copa Sul-Americana", id: "480", format: "br" },
  { name: "Premier League (Inglaterra)", id: "17", format: "eu" },
  { name: "La Liga (Espanha)", id: "8", format: "eu" },
  { name: "Bundesliga (Alemanha)", id: "35", format: "eu" },
  { name: "Serie A (Itália)", id: "23", format: "eu" },
  { name: "Ligue 1 (França)", id: "34", format: "eu" },
  { name: "UEFA Champions League", id: "7", format: "eu" },
  { name: "UEFA Europa League", id: "679", format: "eu" }
];

const SEASONS_EU = ["2025/26", "2024/25", "2023/24", "2022/23", "2021/22"];
const SEASONS_BR = ["2026", "2025", "2024", "2023", "2022"];

const DATA_MODULES = [
  { id: "stats", label: "Estatísticas", icon: BarChart3 },
  { id: "incidents", label: "Incidentes", icon: Zap },
  { id: "lineups", label: "Lineups", icon: FileText },
  { id: "all", label: "Todos", icon: Layers },
];

export function ExtractionPanel() {
  const { toast } = useToast();
  const { 
    isRunning, progress, logs, pipeline, startExtraction, cancelExtraction,
    league, setLeague, season, setSeason, tournamentId, setTournamentId,
    delay, setDelay, selectedModules, setSelectedModules, filters, setFilters
  } = useExtraction();

  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [apiHealth, setApiHealth] = useState("Aguardando...");
  const [apiPing, setApiPing] = useState(0);
  const [supabaseStatus, setSupabaseStatus] = useState("Aguardando...");
  const [totalRows, setTotalRows] = useState(0);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(true);
  const [lastSync, setLastSync] = useState(localStorage.getItem("lastSyncTime") || "Nunca");
  const terminalRef = useRef<HTMLDivElement>(null);

  const fetchPainelStatus = async () => {
    setIsLoadingStats(true);
    try {
      const savedUrl = localStorage.getItem("supabaseUrl") || "";
      const savedKey = localStorage.getItem("supabaseKey") || "";
      const resposta = await fetch("http://localhost:3000/api/status-painel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlSupabase: savedUrl, chaveSupabase: savedKey }) 
      });
      const data = await resposta.json();
      setApiHealth(data.apiHealth);
      setApiPing(data.apiPing);
      setSupabaseStatus(data.supabaseStatus);
      setTotalRows(data.totalRows);
    } catch (error) {
      setApiHealth("Offline");
      setSupabaseStatus("Erro de Conexão");
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => { fetchPainelStatus(); }, []);

  useEffect(() => {
    if (progress === 100) {
      const agora = new Date().toLocaleString("pt-BR", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
      setLastSync(agora);
      localStorage.setItem("lastSyncTime", agora);
      fetchPainelStatus();
    }
  }, [progress]);

  useEffect(() => {
    if (terminalRef.current && isTerminalExpanded) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, isTerminalExpanded]);

  const toggleModule = (id: string) => {
    setSelectedModules(prev => {
      if (id === "all") return prev.includes("all") ? [] : ["all"];
      const semAll = prev.filter(m => m !== "all");
      return semAll.includes(id) ? semAll.filter(m => m !== id) : [...semAll, id];
    });
  };
  
  const handleLeagueChange = (val: string) => {
    setLeague(val); setSeason("");
    const found = LEAGUES_DATA.find(l => l.name === val);
    if (found) setTournamentId(found.id);
  };

  const handleStartRequest = () => {
    const savedUrl = localStorage.getItem("supabaseUrl") || "";
    const savedKey = localStorage.getItem("supabaseKey") || "";
    const savedBatchSize = localStorage.getItem("batchSize") || "1000";
    const savedUploadDelay = localStorage.getItem("uploadDelay") || "200";
    const savedOutputDir = localStorage.getItem("outputDir") || "./output";

    const params = new URLSearchParams({
      torneio: league, temporada: season, tournamentId, delay,
      uploadDelay: savedUploadDelay, batchSize: savedBatchSize, outputDir: savedOutputDir,
      modulo: selectedModules.join(","), urlSupabase: savedUrl, chaveSupabase: savedKey,
      filterPostponed: filters.postponed ? "1" : "0",
      filterLive: filters.live ? "1" : "0",
      filterNotStarted: filters.notStarted ? "1" : "0"
    });

    startExtraction(params);
    setIsTerminalExpanded(true);
  };

  const currentLeagueData = LEAGUES_DATA.find(l => l.name === league);
  const availableSeasons = currentLeagueData?.format === "br" ? SEASONS_BR : SEASONS_EU;

  const levelColor = (l: string) => {
    const colors: any = { info: "text-blue-400", warn: "text-yellow-400", error: "text-red-400", success: "text-emerald-400", system: "text-gray-500" };
    return colors[l] || "text-white";
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <Database className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total Extraído</p>
            {isLoadingStats ? <div className="h-7 w-24 animate-pulse rounded bg-muted" /> : <p className="text-xl font-bold">{totalRows.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">linhas</span></p>}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", apiHealth === "Excelente" ? "bg-success/10" : "bg-destructive/10")}>
            {!isLoadingStats && <div className={cn("h-2.5 w-2.5 rounded-full", apiHealth === "Excelente" ? "bg-success" : apiHealth === "Lenta" ? "bg-yellow-500" : "bg-destructive")} />}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Saúde da API</p>
            {isLoadingStats ? <div className="h-7 w-24 animate-pulse rounded bg-muted" /> : <p className="text-xl font-bold">{apiHealth} {apiPing > 0 && <span className="text-sm font-normal text-success">{apiPing}ms</span>}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <Zap className="h-5 w-5 text-primary" />
          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Conexão Supabase</p>
            {isLoadingStats ? <div className="h-7 w-28 animate-pulse rounded bg-muted" /> : <p className={cn("text-lg font-bold", supabaseStatus === "Sincronizado" ? "text-foreground" : "text-sm mt-1")}>{supabaseStatus}</p>}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Último Sync</p>
          <div className="mt-2 h-2 w-20 rounded-full bg-secondary">
            <div className={cn("h-full rounded-full bg-primary transition-all duration-500", isRunning && "animate-pulse")} style={{ width: `${progress}%` }} />
          </div>
          <p className={cn("mt-1 text-xs font-medium transition-colors", isRunning ? "text-primary animate-pulse" : "text-muted-foreground")}>
            {isRunning ? "Sincronizando..." : lastSync}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 space-y-3">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-4 text-xs font-bold uppercase text-foreground">Configuração de Campeonato</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex h-5 items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground"><Trophy className="h-3.5 w-3.5" /> Liga</Label>
                <Select value={league} onValueChange={handleLeagueChange} disabled={isRunning}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Escolher liga..." /></SelectTrigger>
                  <SelectContent>{LEAGUES_DATA.map(l => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex h-5 items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Temporada</Label>
                <Select value={season} onValueChange={setSeason} disabled={isRunning}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Definir temporada..." /></SelectTrigger>
                  <SelectContent>{availableSeasons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">ID do Campeonato</Label>
                <Input value={tournamentId} readOnly className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Delay (MS)</Label>
                <Input value={delay} onChange={e => setDelay(e.target.value)} type="number" disabled={isRunning} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-4 text-xs font-bold uppercase text-foreground">Módulos de Extração</h3>
            <div className="grid grid-cols-4 gap-3">
              {DATA_MODULES.map(mod => (
                <button key={mod.id} onClick={() => toggleModule(mod.id)} disabled={isRunning}
                  className={cn("flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 transition-all duration-200",
                    (selectedModules.includes(mod.id) || selectedModules.includes("all")) ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-secondary/50 text-muted-foreground hover:bg-secondary",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}>
                  <mod.icon className="h-5 w-5" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">{mod.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-3 border-t pt-4">
              <div className="flex items-start gap-3">
                <CheckboxUI id="p" checked={filters.postponed} onCheckedChange={(v) => setFilters(f => ({...f, postponed: v as boolean}))} disabled={isRunning} />
                <label htmlFor="p" className="text-sm font-medium cursor-pointer">Ignorar jogos adiados</label>
              </div>
              <div className="flex items-start gap-3">
                <CheckboxUI id="l" checked={filters.live} onCheckedChange={(v) => setFilters(f => ({...f, live: v as boolean}))} disabled={isRunning} />
                <label htmlFor="l" className="text-sm font-medium cursor-pointer">Ignorar jogos em andamento</label>
              </div>
              <div className="flex items-start gap-3">
                <CheckboxUI id="n" checked={filters.notStarted} onCheckedChange={(v) => setFilters(f => ({...f, notStarted: v as boolean}))} disabled={isRunning} />
                <label htmlFor="n" className="text-sm font-medium cursor-pointer">Ignorar jogos não iniciados</label>
              </div>
            </div>
          </div>

          <Button variant={isRunning ? "danger" : "engine"} size="lg" className="w-full" onClick={isRunning ? cancelExtraction : handleStartRequest} disabled={!league || !season}>
            {isRunning ? <Square className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
            {isRunning ? "Cancelar Extração" : "Iniciar a extração"}
          </Button>
        </div>

        <div className="col-span-2 space-y-3">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-1 text-xs font-bold uppercase text-foreground">Pipeline</h3>
            <div className="mb-4 flex items-center justify-between"><p className="text-sm font-medium">Progresso</p><span className="text-sm font-bold text-primary">{progress}%</span></div>
            <div className="mb-5 h-1.5 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} /></div>
            <div className="space-y-4">
              {pipeline.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  {step.status === "done" ? <CheckCircle2 className="h-4 w-4 text-success" /> : step.status === "running" ? <Loader2 className="h-4 w-4 text-info animate-spin" /> : <CircleDot className="h-4 w-4 text-muted-foreground/40" />}
                  <div><p className="text-sm font-medium">{step.label}</p><p className="text-xs text-muted-foreground">{step.subtitle}</p></div>
                </div>
              ))} 
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card flex flex-col h-[270px]">
            <div className="flex items-center justify-between border-b px-4 py-2 bg-card">
              <span className="text-xs font-bold uppercase text-primary">Terminal Live</span>
              <button onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}>{isTerminalExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
            </div>
            {isTerminalExpanded && (
              <div ref={terminalRef} className="flex-1 overflow-y-auto bg-terminal-bg p-3 pr-4 terminal-scroll">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2 font-mono text-xs leading-relaxed">
                    {log.time && <span className="text-gray-600 shrink-0">{log.time}</span>}
                    <span className={levelColor(log.level)}>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}