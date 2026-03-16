import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// --- CONFIGURAÇÃO DE URL DINÂMICA ---
// Mantendo a mesma lógica do painel para consistência total
const API_BASE_URL = "http://localhost:3000" 

// Interface para cada entrada de log
interface LogEntry { 
  time: string; 
  level: "info" | "warn" | "error" | "success" | "system"; 
  message: string; 
}

type PipelineStep = { 
  label: string; 
  subtitle: string; 
  status: "pending" | "running" | "done" | "error"; 
};

interface ExtractionContextData {
  isRunning: boolean;
  progress: number;
  logs: LogEntry[];
  pipeline: PipelineStep[];
  league: string;
  setLeague: (v: string) => void;
  season: string;
  setSeason: (v: string) => void;
  tournamentId: string;
  setTournamentId: (v: string) => void;
  delay: string;
  setDelay: (v: string) => void;
  selectedModules: string[];
  setSelectedModules: React.Dispatch<React.SetStateAction<string[]>>;
  filters: { postponed: boolean; live: boolean; notStarted: boolean; };
  setFilters: React.Dispatch<React.SetStateAction<{ postponed: boolean; live: boolean; notStarted: boolean; }>>;
  startExtraction: (params: URLSearchParams) => void;
  cancelExtraction: () => void;
  clearLogs: () => void; 
}

const ExtractionContext = createContext<ExtractionContextData | undefined>(undefined);

export function ExtractionProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([{ 
    time: "", 
    level: "system", 
    message: "[SYSTEM]: Central de Comando pronta." 
  }]);
  
  const [league, setLeague] = useState("");
  const [season, setSeason] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [delay, setDelay] = useState("1200");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [filters, setFilters] = useState({ postponed: true, live: true, notStarted: true });

  const [pipeline, setPipeline] = useState<PipelineStep[]>([
    { label: "Mapeamento de partidas", subtitle: "Fila: 0 partidas", status: "pending" },
    { label: "Extração de dados JSON", subtitle: "Status: Aguardando", status: "pending" },
    { label: "Processamento CSV Engine", subtitle: "Status: Pendente", status: "pending" },
    { label: "Sincronização Supabase", subtitle: "Status: Pendente", status: "pending" },
  ]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const addLog = (level: LogEntry["level"], message: string) => {
    const time = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    setLogs(prev => [...prev, { time, level, message }]);
  };

  const clearLogs = () => {
    setLogs([{ 
      time: "", 
      level: "system", 
      message: "[SYSTEM]: Terminal limpo e pronto para nova extração." 
    }]);
  };

  const startExtraction = (searchParams: URLSearchParams) => {
    setIsRunning(true);
    setProgress(5);
    setLogs([]); 
    addLog("system", "[SYSTEM]: Iniciando processo persistente...");
    setPipeline(p => p.map(s => ({ ...s, status: "pending", subtitle: "Aguardando..." })));

    // Atualizado para usar API_BASE_URL dinâmica
    const sse = new EventSource(`${API_BASE_URL}/api/extrair-stream?${searchParams.toString()}`);
    eventSourceRef.current = sse;

    sse.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.message) addLog(data.type, data.message);
      if (data.progress !== undefined) setProgress(data.progress);
      
      if (data.stepIndex !== undefined && data.stepIndex !== null) {
        setPipeline(p => p.map((s, i) => {
          if (i < data.stepIndex) return { ...s, status: "done", subtitle: "Concluído" };
          if (i === data.stepIndex) return { ...s, status: "running", subtitle: "Processando..." };
          return s;
        }));
      }

      if (data.progress === 100) {
        sse.close();
        setIsRunning(false);
        setPipeline(p => p.map(s => ({ ...s, status: "done", subtitle: "Concluído" })));
        toast({ title: "Concluído!", description: "Dados sincronizados com sucesso." });
      }
    };

    sse.onerror = () => {
      sse.close(); 
      setIsRunning(false);
      addLog("error", "✗ Conexão perdida com o motor.");
    };
  };

  const cancelExtraction = () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setIsRunning(false);
    addLog("error", "✗ Extração interrompida.");
  };

  return (
    <ExtractionContext.Provider value={{ 
      isRunning, progress, logs, pipeline, startExtraction, cancelExtraction, clearLogs,
      league, setLeague, season, setSeason, tournamentId, setTournamentId,
      delay, setDelay, selectedModules, setSelectedModules, filters, setFilters
    }}>
      {children}
    </ExtractionContext.Provider>
  );
}

export const useExtraction = () => {
  const context = useContext(ExtractionContext);
  if (context === undefined) throw new Error("useExtraction deve ser usado dentro de um ExtractionProvider");
  return context;
};