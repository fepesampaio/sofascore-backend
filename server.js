require('dotenv').config(); // 1. CARREGA O TOKEN DO ARQUIVO .ENV LOCAL
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { get } = require('./src/client'); // O seu client.js atualizado

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Tradutor de logs para deixar o terminal bonito no Front
const formatLogPath = (text) => {
  let msg = text;
  if (msg.includes('Lendo:')) return 'Analisando dados brutos extraídos...';
  if (msg.includes('Arquivo pronto:') || msg.includes('CSV salvo em:')) return 'Lote de dados formatado e preparado para envio.';
  if (msg.includes('Arquivo não encontrado, pulando:')) return 'Aviso: Nenhum dado capturado para este módulo. Pulando etapa...';
  if (msg.includes('Iniciando:') && msg.includes('-> Tabela:')) {
    const tabela = msg.split('Tabela:')[1]?.trim() || 'banco de dados';
    return `Sincronizando lote de dados -> Tabela: ${tabela}`;
  }
  return msg.replace(/(?:[a-zA-Z]:\\[^\s]+|[a-zA-Z0-9_-]+\.(?:json|csv))/gi, 'lote de dados');
};

/**
 * Função auxiliar para executar scripts e transmitir logs via SSE
 */
const runScript = (command, args, envs, res, label) => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { 
      env: envs, // Aqui as variáveis de ambiente são injetadas no script
      windowsHide: true 
    });

    process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          const cleanLine = formatLogPath(line.trim());
          res.write(`data: ${JSON.stringify({ type: 'info', message: `[${label}] ${cleanLine}` })}\n\n`);
        }
      });
    });

    process.stderr.on('data', (data) => {
      const errorMsg = data.toString().trim();
      if (errorMsg) {
        const cleanLine = formatLogPath(errorMsg);
        res.write(`data: ${JSON.stringify({ type: 'warn', message: `[${label}-AVISO] ${cleanLine}` })}\n\n`);
      }
    });

    process.on('close', (code) => {
      code === 0 ? resolve() : reject(new Error(`O script ${label} falhou (código ${code})`));
    });

    process.on('error', (err) => reject(new Error(`Falha ao iniciar ${label}: ${err.message}`)));
  });
};

// --- ROTAS ---

app.get('/api/status', (req, res) => {
  res.json({ status: 'online', message: 'Motor Node.js operando!' });
});

app.post('/api/status-painel', async (req, res) => {
  const { urlSupabase, chaveSupabase } = req.body;
  let apiHealth = "Offline", apiPing = 0, supabaseStatus = "Aguardando Credenciais", totalRows = 0;

  const startPing = Date.now();
  try {
    // Agora o ping também passa pelo Smartproxy para evitar o 403
    await get("/unique-tournament/325");
    apiPing = Date.now() - startPing;
    apiHealth = apiPing < 1500 ? "Excelente" : "Lenta"; // Aumentamos a margem por causa do proxy
  } catch (e) { 
    apiHealth = "Offline"; 
    console.error("Erro no Ping:", e.message);
  }

  if (urlSupabase && chaveSupabase) {
    try {
      const supabase = createClient(urlSupabase, chaveSupabase);
      const tables = ['statistics', 'lineups', 'incidents'];
      const counts = await Promise.all(tables.map(t => 
        supabase.from(t).select('*', { count: 'exact', head: true })
      ));
      if (!counts.some(r => r.error && r.error.code !== '42P01')) {
        supabaseStatus = "Sincronizado";
        totalRows = counts.reduce((acc, curr) => acc + (curr.count || 0), 0);
      } else { supabaseStatus = "Erro de Conexão"; }
    } catch (e) { supabaseStatus = "Erro Crítico"; }
  }
  res.json({ apiHealth, apiPing, supabaseStatus, totalRows });
});

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

  // 2. REPASSE DAS VARIÁVEIS DE AMBIENTE PARA OS SCRIPTS FILHOS
  const envs = {
    ...process.env,
    SMARTPROXY_TOKEN: process.env.SMARTPROXY_TOKEN, // GARANTE QUE O EXTRACT.JS RECEBA O TOKEN
    SE_GUI_MODE: "1",
    SE_TOURNAMENT_NAME: torneio,
    SE_SEASON: temporada,
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
  let supabase = (urlSupabase && chaveSupabase) ? createClient(urlSupabase, chaveSupabase) : null;

  try {
    if (supabase) {
      const { data } = await supabase.from('extraction_history').insert([{
        league: torneio, season: temporada, type: modulo === 'all' ? 'Todos' : modulo, status: 'warning'
      }]).select().single();
      if (data) logId = data.id;
    }

    res.write(`data: ${JSON.stringify({ type: 'system', message: 'Iniciando extração via Smartproxy...', stepIndex: 0, progress: 5 })}\n\n`);
    await runScript('node', ['extract.js'], envs, res, 'EXTRACT');
    
    // Processamento de módulos (Stats, Incidents, Lineups)
    const modulos = (modulo || "").split(",");
    const hasAll = modulos.includes("all");
    if (hasAll || modulos.includes("stats")) await runScript('node', ['conv-stats.js'], envs, res, 'JS-STATS');
    if (hasAll || modulos.includes("incidents")) await runScript('node', ['conv-incidents.js'], envs, res, 'JS-INCIDENTS');
    if (hasAll || modulos.includes("lineups")) await runScript('node', ['conv-lineups.js'], envs, res, 'JS-LINEUPS');

    // Sincronização final
    res.write(`data: ${JSON.stringify({ type: 'system', message: 'Sincronizando com Supabase...', stepIndex: 3, progress: 85 })}\n\n`);
    await runScript('node', ['import.js'], envs, res, 'SYNC-DB');

    if (logId && supabase) await supabase.from('extraction_history').update({ status: 'success' }).eq('id', logId);
    res.write(`data: ${JSON.stringify({ type: 'success', message: 'PROCESSO CONCLUÍDO COM SUCESSO!', progress: 100 })}\n\n`);

  } catch (err) {
    if (logId && supabase) await supabase.from('extraction_history').update({ status: 'failed' }).eq('id', logId);
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