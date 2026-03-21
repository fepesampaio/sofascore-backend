const fs       = require("fs");
const path     = require("path");
const readline = require("readline");
const { get, sleep } = require("./src/client");

const GUI_MODE = process.env.SE_GUI_MODE === "1";

let TOURNAMENT_ID = GUI_MODE ? process.env.SE_TOURNAMENT_ID : null;
let SEASON_YEAR   = GUI_MODE ? process.env.SE_SEASON        : null;

const DELAY_MS    = GUI_MODE ? (Number(process.env.SE_DELAY_MS) || 1200) : 1200;
const OUTPUT_DIR  = GUI_MODE ? (process.env.SE_OUTPUT_DIR || "./output")  : "./output";

const LOG_FILE    = path.join(OUTPUT_DIR, "jogos_extraidos.json");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const rl  = GUI_MODE
  ? { close: () => {} }
  : readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = GUI_MODE
  ? () => Promise.resolve("")
  : (q) => new Promise((res) => rl.question(q, res));

function loadProcessedGames() {
  if (fs.existsSync(LOG_FILE)) {
    try {
      const data = fs.readFileSync(LOG_FILE, "utf8");
      return new Set(JSON.parse(data));
    } catch (err) {
      console.warn(`[AVISO] Erro ao carregar jogos processados: ${err.message}`);
      return new Set();
    }
  }
  return new Set();
}

function saveProcessedGames(processedSet) {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(Array.from(processedSet), null, 2), "utf8");
    console.log(`✓ Registro de partidas salvo: ${LOG_FILE}`);
  } catch (err) {
    console.error(`❌ Erro ao salvar registro de partidas: ${err.message}`);
  }
}

// MELHORIA: Validação de variáveis de ambiente obrigatórias
function validateEnvironment() {
  const required = ['SE_TOURNAMENT_ID', 'SE_TOURNAMENT_NAME', 'SE_SEASON'];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`❌ ERRO: Variáveis de ambiente obrigatórias não definidas: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function getTournamentInfo() {
  console.log("Buscando informacoes do campeonato (id: " + TOURNAMENT_ID + ")...");
  try {
    const data = await get("/unique-tournament/" + TOURNAMENT_ID);
    const t = data.uniqueTournament || {};
    console.log("Campeonato: " + (t.name || "Desconhecido"));
    return t;
  } catch (err) {
    console.error(`❌ Erro ao buscar informações do campeonato: ${err.message}`);
    throw err;
  }
}

async function getSeason() {
  console.log("Buscando temporadas disponiveis...");
  try {
    const data    = await get("/unique-tournament/" + TOURNAMENT_ID + "/seasons");
    const seasons = data.seasons || [];

    if (GUI_MODE) {
      const sentSeason = String(SEASON_YEAR);
      const baseYear = sentSeason.substring(0, 4); 
      const shortYear = baseYear.substring(2, 4);  
      const nextYear = String(Number(baseYear) + 1); 
      const nextShort = nextYear.substring(2, 4);  

      const formatosPossiveis = [
        sentSeason, baseYear, `${baseYear}/${nextYear}`, `${shortYear}/${nextShort}`, `${shortYear}/${nextYear}` 
      ];
      
      const found = seasons.find((s) => {
        const apiYear = String(s.year);
        const apiName = s.name ? String(s.name) : "";
        return apiYear === baseYear || formatosPossiveis.some(formato => apiName.includes(formato) || apiYear === formato);
      });

      if (!found) {
        console.error(`\n[ERRO] Temporada '${SEASON_YEAR}' não encontrada!`);
        process.exit(1); 
      }
      
      console.log("Temporada selecionada: " + (found.name || found.year));
      return found;
    }  
    
    const top5 = seasons.slice(0, 5); 
    top5.forEach((s, idx) => console.log(`  ${idx + 1}. ${s.name || s.year}`));

    let opt = -1;
    // CORREÇÃO: Operador lógico correto para validação
    while (![1, 2, 3, 4, 5].includes(opt) || opt > top5.length) {
      const ans = await ask(`\nEscolha a temporada (1 a ${top5.length}): `);
      opt = parseInt(ans);
    }

    const found = top5[opt - 1];
    console.log("\nTemporada selecionada: " + (found.name || found.year));
    return found;
  } catch (err) {
    console.error(`❌ Erro ao buscar temporadas: ${err.message}`);
    throw err;
  }
}

async function getRounds(seasonId) {
  try {
    const data = await get("/unique-tournament/" + TOURNAMENT_ID + "/season/" + seasonId + "/rounds");
    return data.rounds || [];
  } catch (err) {
    console.error(`❌ Erro ao buscar rodadas: ${err.message}`);
    throw err;
  }
}

async function getAllMatches(seasonId, rounds, processedGames) {
  const allMatches = [];
  const total = rounds.length;

  for (let i = 0; i < rounds.length; i++) {
    const roundNum = rounds[i].round;
    process.stdout.write("  Rodada " + roundNum + "/" + total + "...          \r");

    try {
      const data = await get("/unique-tournament/" + TOURNAMENT_ID + "/season/" + seasonId + "/events/round/" + roundNum);
      const filterPostponed  = !GUI_MODE || process.env.SE_FILTER_POSTPONED  !== "0";
      const filterHalftime   = !GUI_MODE || process.env.SE_FILTER_HALFTIME   !== "0";
      const filterNotStarted = !GUI_MODE || process.env.SE_FILTER_NOTSTARTED !== "0";
      
      (data.events || []).forEach((e) => {
        const desc = e.status && e.status.description;
        if (filterPostponed  && desc === "Postponed") return;
        if (filterHalftime   && (desc === "Halftime" || desc === "In progress" || desc === "Live")) return;
        if (filterNotStarted && desc === "Not started") return;
        if (processedGames.has(e.id)) return;

        allMatches.push({
          id: e.id, round: roundNum, home: e.homeTeam.name, away: e.awayTeam.name,
          scoreHome: e.homeScore?.current, scoreAway: e.awayScore?.current,
          status: desc, startTime: e.startTimestamp ? new Date(e.startTimestamp * 1000).toISOString() : null,
        });

        processedGames.add(e.id);
      });
    } catch (err) {
      console.warn(`[AVISO] Erro ao buscar partidas da rodada ${roundNum}: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }
  console.log("\nNovas partidas encontradas: " + allMatches.length);
  return allMatches;
}

// MELHORIA: Função genérica para reduzir duplicação
async function processMatchesGeneric(matches, fullPath, extractData, processData, label) {
  let results = [];
  
  // Carregar resultados existentes
  try { 
    if (fs.existsSync(fullPath)) {
      results = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      console.log(`✓ Arquivo existente carregado: ${fullPath} (${results.length} registros)`);
    } 
  } catch(err) {
    console.warn(`[AVISO] Não foi possível carregar arquivo existente ${fullPath}: ${err.message}`);
    results = [];
  }

  const total = matches.length;
  for (let i = 0; i < total; i++) {
    const match = matches[i];
    process.stdout.write(`  ${label}: ${i + 1}/${total} | ${match.home} x ${match.away}          \r`);
    
    try {
      const data = await extractData(match.id);
      const processed = processData(data, match);
      
      // Se processData retorna array, fazer spread
      if (Array.isArray(processed)) {
        results.push(...processed);
      } else {
        results.push(processed);
      }
    } catch (err) {
      console.warn(`[AVISO] Erro ao processar ${label} para partida ${match.home} x ${match.away} (ID: ${match.id}): ${err.message}`);
    }
    
    await sleep(DELAY_MS);
  }
  
  try {
    fs.writeFileSync(fullPath, JSON.stringify(results, null, 2), "utf8");
    console.log(`\n✓ ${label} salvo: ${fullPath} (${results.length} registros)`);
  } catch (err) {
    console.error(`❌ Erro ao salvar ${label}: ${err.message}`);
  }
}

async function getAllStatistics(matches, fullPath) {
  await processMatchesGeneric(
    matches,
    fullPath,
    async (matchId) => await get(`/event/${matchId}/statistics`),
    (data, match) => ({
      matchId: match.id,
      round: match.round,
      home: match.home,
      away: match.away,
      scoreHome: match.scoreHome,
      scoreAway: match.scoreAway,
      status: match.status,
      startTime: match.startTime,
      statistics: data.statistics || [],
    }),
    "Estatísticas"
  );
}

async function getAllIncidents(matches, tournamentName, seasonLabel, fullPath) {
  await processMatchesGeneric(
    matches,
    fullPath,
    async (matchId) => await get(`/event/${matchId}/incidents`),
    (data, match) => {
      const incidents = data.incidents || [];
      return incidents
        .filter(inc => inc.incidentType !== "period" && inc.incidentType !== "injuryTime")
        .map(inc => ({
          match_id: match.id,
          tournament_name: tournamentName,
          season: seasonLabel,
          round: match.round,
          home_team: match.home,
          away_team: match.away,
          incident_type: inc.incidentType,
          incident_class: inc.incidentClass,
          minute: inc.time,
          added_time: inc.addedTime !== 999 ? inc.addedTime : null,
          is_home: inc.isHome,
          player_name: inc.player?.name,
          player_id: inc.player?.id,
          score_home: inc.homeScore,
          score_away: inc.awayScore
        }));
    },
    "Incidentes"
  );
}

async function getAllLineups(matches, tournamentName, seasonLabel, fullPath) {
  await processMatchesGeneric(
    matches,
    fullPath,
    async (matchId) => await get(`/event/${matchId}/lineups`),
    (data, match) => ({
      matchId: match.id,
      tournamentName,
      season: seasonLabel,
      round: match.round,
      home: match.home,
      away: match.away,
      scoreHome: match.scoreHome,
      scoreAway: match.scoreAway,
      status: match.status,
      startTime: match.startTime,
      lineups: data || null
    }),
    "Lineups"
  );
}

async function main() {
  console.log("=== MOTOR DE EXTRAÇÃO REAL ATIVO ===\n");
  
  // MELHORIA: Validar ambiente no início
  validateEnvironment();
  
  const processedGames = loadProcessedGames();

  // MELHORIA 1 e 2: Parsing da lista de módulos do Painel
  const modulosStr = process.env.SE_MODULO || "all";
  const listaModulos = modulosStr.split(",");
  const hasAll = listaModulos.includes("all");

  const extrairStats = hasAll || listaModulos.includes("stats");
  const extrairIncidents = hasAll || listaModulos.includes("incidents");
  const extrairLineups = hasAll || listaModulos.includes("lineups");

  const tournament = await getTournamentInfo();
  await sleep(DELAY_MS);
  const season = await getSeason();
  await sleep(DELAY_MS);

  console.log("Buscando rodadas...");
  const rounds = await getRounds(season.id);
  await sleep(DELAY_MS);

  const matches = await getAllMatches(season.id, rounds, processedGames);
  if (matches.length === 0) {
    console.log("\n✅ Base de dados já está atualizada!");
    console.log(`Estatísticas: ${processedGames.size} partidas processadas no total`);
    return;
  }

  // MELHORIA 3: Padronização definitiva dos nomes dos arquivos
  const seasonLabel = season.name || season.year;
  const fileNameBase = `${process.env.SE_TOURNAMENT_NAME}_${process.env.SE_SEASON}`;

  console.log(`\n📊 Iniciando processamento de ${matches.length} novas partidas...\n`);

  if (extrairStats) {
    console.log("Extraindo Estatísticas...");
    await getAllStatistics(matches, path.join(OUTPUT_DIR, `results_${fileNameBase}.json`));
  }

  if (extrairIncidents) {
    console.log("\nExtraindo Incidentes...");
    await getAllIncidents(matches, tournament.name, seasonLabel, path.join(OUTPUT_DIR, `incidents_${fileNameBase}.json`));
  }

  if (extrairLineups) {
    console.log("\nExtraindo Lineups...");
    await getAllLineups(matches, tournament.name, seasonLabel, path.join(OUTPUT_DIR, `lineups_${fileNameBase}.json`));
  }

  matches.forEach(m => processedGames.add(m.id));
  saveProcessedGames(processedGames);

  console.log("\n" + "=".repeat(50));
  console.log("✅ PROCESSO CONCLUÍDO COM SUCESSO!");
  console.log("=".repeat(50));
  console.log(`📈 Resumo Final:`);
  console.log(`  • Partidas processadas: ${matches.length}`);
  console.log(`  • Total acumulado: ${processedGames.size}`);
  console.log(`  • Diretório de saída: ${OUTPUT_DIR}`);
  console.log(`  • Módulos extraídos: ${[extrairStats && 'Estatísticas', extrairIncidents && 'Incidentes', extrairLineups && 'Lineups'].filter(Boolean).join(', ')}`);
  console.log("=".repeat(50) + "\n");
}

main().catch((err) => {
  console.error("\n❌ Erro Crítico: " + err.message);
  process.exit(1);
});