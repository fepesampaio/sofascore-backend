const fs = require("fs");
const path = require("path");

const GUI_MODE = process.env.SE_GUI_MODE === "1";

// ── FILTRO DE COLUNAS (LISTA NEGRA) ──────────────────────────────────
const IGNORE_KEYS = [
    "expected_assists"
];

// ── Selecionar arquivo (AJUSTADO PARA INTEGRAÇÃO) ────────────────────
let inputJson = "";

if (GUI_MODE) {
    inputJson = process.env.SE_JSON_PATH || "";
    if (!inputJson) {
        const tournamentRaw = process.env.SE_TOURNAMENT_NAME || "dados";
        const seasonRaw = process.env.SE_SEASON || "2026";
        const filename = `lineups_${tournamentRaw}_${seasonRaw}.json`.replace(/ /g, "_");
        inputJson = path.join(process.cwd(), "output", filename);
    }
} else {
    inputJson = process.argv[2] || "";
    if (!inputJson) {
        console.error("Forneça o caminho do JSON. Ex: node conv-lineups.js ./output/arquivo.json");
        process.exit(1);
    }
}

if (!fs.existsSync(inputJson)) {
    console.error("Arquivo não encontrado: " + inputJson);
    process.exit(1);
}

console.log("Lendo: " + inputJson);
const rawData = fs.readFileSync(inputJson, "utf-8");
const data = JSON.parse(rawData);

// ── Colunas ───────────────────────────────────────────────────────────
const FIELDNAMES = [
    "match_id", "tournament_name", "season", "round",
    "home_team", "away_team", "is_home", "confirmed",
    "player_id", "player_name", "player_position", "shirt_number", "substitute",
    "minutes_played", "rating", "goals", "assists",
    "total_pass", "accurate_pass",
    "total_shots", "on_target",
    "total_tackle", "won_tackle",
    "duel_won", "duel_lost",
    "aerial_won", "aerial_lost",
    "total_clearance", "ball_recovery",
    "fouls", "was_fouled",
    "touches", "possession_lost",
    "expected_goals", "expected_assists",
    "saves", "key_pass", "dispossessed",
];

const FINAL_FIELDNAMES = FIELDNAMES.filter(col => !IGNORE_KEYS.includes(col));

const rows = [];

// ── Lógica de Achatamento (Flatten) ──────────────────────────────────
data.forEach(match => {
    const lineups = match.lineups;
    if (!lineups) return; // Equivalente ao "continue" do Python

    const match_id = match.matchId;
    const tournament_name = match.tournamentName;
    const season = match.season;
    const match_round = match.round;
    const home_team = match.home;
    const away_team = match.away;
    const confirmed = lineups.confirmed;

    function processTeam(teamData, isHome) {
        if (!teamData || !teamData.players) return;

        teamData.players.forEach(p => {
            const playerInfo = p.player || {};
            const stats = p.statistics || {};

            // --- FILTRO DE MINUTOS JOGADOS ---
            const minutos = stats.minutesPlayed;
            if (minutos === null || minutos === undefined || minutos <= 15) {
                return; // Equivalente ao "continue" dentro do forEach
            }

            const rowData = {
                "match_id": match_id,
                "tournament_name": tournament_name,
                "season": season,
                "round": match_round,
                "home_team": home_team,
                "away_team": away_team,
                "is_home": isHome,
                "confirmed": confirmed,
                "player_id": playerInfo.id,
                "player_name": playerInfo.name,
                "player_position": p.position,
                "shirt_number": p.shirtNumber,
                "substitute": p.substitute || false,
                "minutes_played": stats.minutesPlayed,
                "rating": stats.rating,
                "goals": stats.goals,
                "assists": stats.goalAssist,
                "total_pass": stats.totalPass,
                "accurate_pass": stats.accuratePass,
                "total_shots": stats.totalShots,
                "on_target": stats.onTarget,
                "total_tackle": stats.totalTackle,
                "won_tackle": stats.wonTackle,
                "duel_won": stats.duelWon,
                "duel_lost": stats.duelLost,
                "aerial_won": stats.aerialWon,
                "aerial_lost": stats.aerialLost,
                "total_clearance": stats.totalClearance,
                "ball_recovery": stats.ballRecovery,
                "fouls": stats.fouls,
                "was_fouled": stats.wasFouled,
                "touches": stats.touches,
                "possession_lost": stats.possessionLostCtrl,
                "expected_goals": stats.expectedGoals,
                "expected_assists": stats.expectedAssists,
                "saves": stats.saves,
                "key_pass": stats.keyPass,
                "dispossessed": stats.dispossessed,
            };
            
            rows.push(rowData);
        });
    }

    processTeam(lineups.home, true);
    processTeam(lineups.away, false);
});

console.log("Total de jogadores processados (após o filtro): " + rows.length);

if (rows.length === 0) {
    console.log("Nenhum dado de lineup encontrado para exportar.");
    process.exit(0);
}

// ── Salvar CSV na mesma pasta do JSON ─────────────────────────────────
const parsedPath = path.parse(inputJson);
const outputCsv = path.join(parsedPath.dir, `${parsedPath.name}_supabase.csv`);

let csvContent = FINAL_FIELDNAMES.join(",") + "\n";

rows.forEach(row => {
    const rowValues = FINAL_FIELDNAMES.map(field => {
        let val = row[field];
        if (val === null || val === undefined) val = "";
        
        let strVal = String(val).replace(/"/g, '""');
        if (strVal.includes(",")) {
            strVal = `"${strVal}"`;
        }
        return strVal;
    });
    csvContent += rowValues.join(",") + "\n";
});

fs.writeFileSync(outputCsv, csvContent, "utf-8");

console.log("CSV salvo em: " + outputCsv);
console.log("Pronto para importar no Supabase!");