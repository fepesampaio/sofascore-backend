const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { get } = require('./src/client');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const formatLogPath = (text) => {
  let msg = text;

  if (msg.includes('Lendo:')) {
    return 'Analisando dados brutos extraídos...';
  }
 
  if (msg.includes('Arquivo pronto:') || msg.includes('CSV salvo em:')) {
    return 'Lote de dados formatado e preparado para envio.';
  }
  
  if (msg.includes('Arquivo não encontrado, pulando:')) {
    return 'Aviso: Nenhum dado capturado para este módulo. Pulando etapa...';
  }
  
  // 4. Traduz o início do upload para o Supabase (Node - import.js)
  if (msg.includes('Iniciando:') && msg.includes('-> Tabela:')) {
    const tabela = msg.split('Tabela:')[1]?.trim() || 'banco de dados';
    return `Sincronizando lote de dados -> Tabela: ${tabela}`;
  }

  // 5. Fallback de segurança: Se ainda sobrar algum arquivo .json ou .csv perdido, oculta.
  return msg.replace(/(?:[a-zA-Z]:\\[^\s]+|[a-zA-Z0-9_-]+\.(?:json|csv))/gi, 'lote de dados');
};

/**
 * Função auxiliar para executar scripts (Node ou Python) e transmitir logs via SSE
 */
const runScript = (command, args, envs, res, label) => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { 
      env: envs,
      windowsHide: true 
    });

    process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          const cleanLine = formatLogPath(line.trim());
          res.write(`data: ${JSON.stringify({ 
            type: 'info', 
            message: `[${label}] ${cleanLine}` 
          })}\n\n`);
        }
      });
    });

    process.stderr.on('data', (data) => {
      const errorMsg = data.toString().trim();
      if (errorMsg) {
        const cleanLine = formatLogPath(errorMsg);
        res.write(`data: ${JSON.stringify({ 
          type: 'warn', 
          message: `[${label}-AVISO] ${cleanLine}` 
        })}\n\n`);
      }
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`O script ${label} falhou (código ${code})`));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Falha ao iniciar ${label}: ${err.message}`));
    });
  });
};

// --- ROTAS DE STATUS E HISTÓRICO ---

app.get('/api/status', (req, res) => {
  res.json({ status: 'online', message: 'Motor Node.js operando!' });
});

// Busca os logs reais para o HistoryPanel
app.get('/api/historico', async (req, res) => {
  const { urlSupabase, chaveSupabase } = req.query;
  if (!urlSupabase || !chaveSupabase) return res.status(400).json({ error: "Credenciais ausentes" });

  try {
    const supabase = createClient(urlSupabase, chaveSupabase);
    const { data, error } = await supabase
      .from('extraction_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/status-painel', async (req, res) => {
  const { urlSupabase, chaveSupabase } = req.body;
  let apiHealth = "Offline", apiPing = 0, supabaseStatus = "Aguardando Credenciais", totalRows = 0;

  const startPing = Date.now();
  try {
    await get("/unique-tournament/325");
    apiPing = Date.now() - startPing;
    apiHealth = apiPing < 800 ? "Excelente" : "Lenta";
  } catch (e) { apiHealth = "Offline"; }

  if (urlSupabase && chaveSupabase) {
    try {
      const supabase = createClient(urlSupabase, chaveSupabase);
      const tables = ['statistics', 'lineups', 'incidents'];
      const counts = await Promise.all(tables.map(t => 
        supabase.from(t).select('*', { count: 'exact', head: true })
      ));
      
      const hasError = counts.some(r => r.error && r.error.code !== '42P01');
      if (!hasError) {
        supabaseStatus = "Sincronizado";
        totalRows = counts.reduce((acc, curr) => acc + (curr.count || 0), 0);
      } else { 
        supabaseStatus = "Erro de Conexão"; 
      }
    } catch (e) { supabaseStatus = "Erro Crítico"; }
  }
  res.json({ apiHealth, apiPing, supabaseStatus, totalRows });
});

// --- ROTA PRINCIPAL DE EXTRAÇÃO ---

app.get('/api/extrair-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { 
    torneio, temporada, tournamentId, modulo,
    delay, uploadDelay, batchSize, outputDir,
    filterPostponed, filterLive, filterNotStarted,
    urlSupabase, chaveSupabase  
  } = req.query;
  
  const sanitize = (str) => {
    if (!str) return "dados";
    return str
      .normalize("NFD") 
      .replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-zA-Z0-9]/g, "_") 
      .replace(/_+/g, "_") 
      .replace(/^_|_$/g, ""); 
  };

  const torneioLimpo = sanitize(torneio);
  const temporadaLimpa = sanitize(temporada);
  const modulosSelecionados = (modulo || "").split(",");
  
  const envs = {
    ...process.env,
    SE_GUI_MODE: "1",
    SE_TOURNAMENT_NAME: torneioLimpo,
    SE_SEASON: temporadaLimpa,
    SE_TOURNAMENT_ID: tournamentId,
    SE_DELAY_MS: delay,
    SE_MODULO: modulo,
    SE_OUTPUT_DIR: outputDir,
    SE_FILTER_POSTPONED: filterPostponed,
    SE_FILTER_HALFTIME: filterLive,
    SE_FILTER_NOTSTARTED: filterNotStarted,
    IMPORT_BATCH_SIZE: batchSize,
    IMPORT_DELAY_MS: uploadDelay,
    SUPABASE_URL: urlSupabase, 
    SUPABASE_KEY: chaveSupabase
  };

  let logId = null;
  let supabase = null;

  // 1. INICIA O LOG COMO "PROCESSANDO" (warning)
  if (urlSupabase && chaveSupabase) {
    try {
      supabase = createClient(urlSupabase, chaveSupabase);
      const { data: logData, error } = await supabase.from('extraction_history').insert([{
        league: torneio,
        season: temporada,
        type: modulo === 'all' ? 'Todos' : modulo,
        status: 'warning' // warning mapeia para "Parcial / Processando" no Frontend
      }]).select().single();
      
      if (logData) logId = logData.id;
    } catch (logErr) {
      console.error("Erro ao iniciar log de histórico:", logErr.message);
    }
  }

  // 2. DETECTA SE O USUÁRIO CANCELOU OU FECHOU A ABA
  req.on('close', async () => {
    if (logId && supabase) {
      try {
        // Se a conexão fechar e o logId ainda existir, significa que não terminou com sucesso.
        await supabase.from('extraction_history').update({ status: 'failed' }).eq('id', logId);
      } catch (e) {
        console.error("Erro ao atualizar log para falha:", e.message);
      }
    }
  });

  try {
    // PASSO 1: Extração JSON
    res.write(`data: ${JSON.stringify({ type: 'system', message: 'Iniciando extração de dados...', stepIndex: 0, progress: 5 })}\n\n`);
    await runScript('node', ['extract.js'], envs, res, 'EXTRACT');
    res.write(`data: ${JSON.stringify({ type: 'success', message: '✓ JSONs baixados.', stepIndex: 1, progress: 40 })}\n\n`);

    res.write(`data: ${JSON.stringify({ type: 'system', message: 'Iniciando processamento dos módulos selecionados...', stepIndex: 2, progress: 45 })}\n\n`);
    
    // PASSO 2: Conversão Condicional
    const hasAll = modulosSelecionados.includes("all");

    if (hasAll || modulosSelecionados.includes("stats")) {
        await runScript('python', ['conv-stats.py'], envs, res, 'PY-STATS');
    }
    if (hasAll || modulosSelecionados.includes("incidents")) {
        await runScript('python', ['conv-incidents.py'], envs, res, 'PY-INCIDENTS');
    }
    if (hasAll || modulosSelecionados.includes("lineups")) {
        await runScript('python', ['conv-lineups.py'], envs, res, 'PY-LINEUPS');
    }

    res.write(`data: ${JSON.stringify({ type: 'success', message: '✓ Processamento de módulos concluído.', progress: 80 })}\n\n`);

    // PASSO 3: Sincronização
    res.write(`data: ${JSON.stringify({ type: 'system', message: 'Iniciando upload para o banco...', stepIndex: 3, progress: 85 })}\n\n`);
    await runScript('node', ['import.js'], envs, res, 'SYNC-DB');

    // 3. ATUALIZA O LOG PARA "CONCLUÍDO" (success)
    if (logId && supabase) {
      try {
        await supabase.from('extraction_history').update({ status: 'success' }).eq('id', logId);
        logId = null; // Zera o logId para o evento 'close' não marcá-lo como falha!
      } catch (logErr) {
        console.error("Erro ao atualizar log de histórico:", logErr.message);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'success', message: 'PROCESSO CONCLUÍDO COM SUCESSO!', progress: 100 })}\n\n`);

  } catch (err) {
    // 4. ATUALIZA O LOG PARA "FALHA" EM CASO DE ERRO DE SCRIPT
    if (logId && supabase) {
      try {
        await supabase.from('extraction_history').update({ status: 'failed' }).eq('id', logId);
        logId = null; 
      } catch (e) {}
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: `ERRO NA PIPELINE: ${err.message}` })}\n\n`);
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log("===========================================");
  console.log(` Servidor ONLINE: http://localhost:${PORT} `);
  console.log("===========================================");
});