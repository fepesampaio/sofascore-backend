import { useState, useEffect } from "react";
import { Key, Clock, FolderOpen, Hash, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast"; // Unificado com o ExtractionPanel

export function SettingsPanel() {
  const { toast } = useToast();
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [batchSize, setBatchSize] = useState("1000");
  const [uploadDelay, setUploadDelay] = useState("200"); // Nomeado especificamente para Upload
  const [outputDir, setOutputDir] = useState("./output");

  // Carrega os dados do navegador assim que a tela abre
  useEffect(() => {
    setSupabaseUrl(localStorage.getItem("supabaseUrl") || "");
    setSupabaseKey(localStorage.getItem("supabaseKey") || "");
    setBatchSize(localStorage.getItem("batchSize") || "1000");
    setUploadDelay(localStorage.getItem("uploadDelay") || "200");
    setOutputDir(localStorage.getItem("outputDir") || "./output");
  }, []);

  const handleSave = () => {
    // Salva com as chaves que o ExtractionPanel espera encontrar
    localStorage.setItem("supabaseUrl", supabaseUrl);
    localStorage.setItem("supabaseKey", supabaseKey);
    localStorage.setItem("batchSize", batchSize);
    localStorage.setItem("uploadDelay", uploadDelay);
    localStorage.setItem("outputDir", outputDir);
    
    toast({
      title: "Configurações salvas!",
      description: "As preferências de conexão e performance foram atualizadas.",
    });
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* CONEXÃO COM BANCO DE DADOS */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
          <Server className="h-4 w-4 text-primary" /> Conexão com Banco de Dados
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Supabase URL</Label>
            <Input
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              className="bg-background font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
              <Key className="h-3 w-3" /> API Key (Service Role)
            </Label>
            <Input
              value={supabaseKey}
              onChange={e => setSupabaseKey(e.target.value)}
              type="password"
              placeholder="Sua chave secreta do banco"
              className="bg-background font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* PERFORMANCE DE UPLOAD */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
          <Clock className="h-4 w-4 text-primary" /> Performance de Sincronização
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-muted-foreground h-5 tracking-wider">
              <Hash className="h-3 w-3" /> Batch Size
            </Label>
            <Input
              value={batchSize}
              onChange={e => setBatchSize(e.target.value)}
              type="number"
              className="bg-background font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center text-[11px] font-bold uppercase text-muted-foreground h-5 tracking-wider">
              Upload Delay (ms)
            </Label>
            <Input
              value={uploadDelay}
              onChange={e => setUploadDelay(e.target.value)}
              type="number"
              className="bg-background font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* SAÍDA LOCAL */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
          <FolderOpen className="h-4 w-4 text-primary" /> Saída Local
        </h3>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Diretório de Saída</Label>
          <Input
            value={outputDir}
            onChange={e => setOutputDir(e.target.value)}
            className="bg-background font-mono text-sm"
          />
        </div>
      </div>

      <Button variant="engine" size="lg" className="w-full shadow-md" onClick={handleSave}>
        Salvar Configurações
      </Button>
    </div>
  );
}