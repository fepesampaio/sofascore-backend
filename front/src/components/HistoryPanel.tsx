import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";

export function HistoryPanel() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    const url = localStorage.getItem("supabaseUrl");
    const key = localStorage.getItem("supabaseKey");

    try {
      const res = await fetch(`http://localhost:3000/api/historico?urlSupabase=${url}&chaveSupabase=${key}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/20">
        <h3 className="text-xs font-bold uppercase tracking-wider">Registros Recentes</h3>
        <button onClick={fetchHistory} className="text-muted-foreground hover:text-primary transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/10">
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Liga</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Temporada</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma extração registrada.</td></tr>
          ) : (
            history.map(row => (
              <tr key={row.id} className="border-t transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">{row.league}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.season}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="capitalize text-[10px]">{row.type.replace(',', ' & ')}</Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={row.status === "success" ? "success" : row.status === "failed" ? "destructive" : "warning"}>
                    {row.status === "success" ? "Concluído" : row.status === "failed" ? "Falhou" : "Parcial"}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}