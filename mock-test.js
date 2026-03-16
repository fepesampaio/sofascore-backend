const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = './output';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// O Mock agora usa EXATAMENTE o que o server.js limpou e enviou
const tournament = process.env.SE_TOURNAMENT_NAME || "campeonato";
const season = process.env.SE_SEASON || "2026";

async function runMock() {
  console.log("=== MOCK EXTRACTOR ATIVO ===");
  
  // Nomes de arquivos idênticos ao que o Python espera
  const fileStats = `results_${tournament}_${season}.json`;
  const fileIncidents = `incidents_${tournament}_${season}.json`;
  const fileLineups = `lineups_${tournament}_${season}.json`;

  console.log("Buscando informacoes...");
  await new Promise(r => setTimeout(r, 500));

  console.log("Buscando rodadas...");
  await new Promise(r => setTimeout(r, 500));

  console.log("Novas partidas encontradas: 1");

  const mockData = [{
    matchId: 999999,
    round: 1,
    home: "Time Casa",
    away: "Time Fora",
    startTime: new Date().toISOString(),
    statistics: [],
    lineups: { home: { players: [] }, away: { players: [] } }
  }];

  // Criando os arquivos físicos na pasta output
  fs.writeFileSync(path.join(OUTPUT_DIR, fileStats), JSON.stringify(mockData, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, fileIncidents), JSON.stringify([], null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, fileLineups), JSON.stringify(mockData, null, 2));

  console.log("Estatisticas: 1/1 | Simulado");
  console.log("Incidentes: 1/1 | Simulado");
  console.log("Lineups: 1/1 | Simulado");

  console.log("=== CONCLUIDO ===");
}

runMock();