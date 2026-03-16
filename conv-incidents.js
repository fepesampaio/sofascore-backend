const fs = require("fs");
const path = require("path");

const GUI_MODE = process.env.SE_GUI_MODE === "1";

// ── 1. FILTRO DE COLUNAS (LISTA NEGRA) ───────────────────────────────
const IGNORE_KEYS = [ ];

// ── Selecionar arquivo (AJUSTADO PARA INTEGRAÇÃO) ────────────────────
let inputJson = "";

if (GUI_MODE) {
    inputJson = process.env.SE_JSON_PATH || "";
    if (!inputJson) {
        const tournamentRaw = process.env.SE_TOURNAMENT_NAME || "dados";
        const seasonRaw = process.env.SE_SEASON || "2026";
        const filename = `incidents_${tournamentRaw}_${seasonRaw}.json`.replace(/ /g, "_");
        inputJson = path.join(process.cwd(), "output", filename);
    }
} else {
    // Fallback: Permite passar o caminho do arquivo JSON como argumento no terminal
    inputJson = process.argv[2] || "";
    if (!inputJson) {
        console.error("Forneça o caminho do JSON. Ex: node conv-incidents.js ./output/arquivo.json");
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

console.log("Total de incidentes originais: " + data.length);

// ── 2. FILTRO DE LINHAS (LANCES INDESEJADOS) ─────────────────────────
const filteredRows = data.filter(row => {
    const incType = row.incident_type;
    const incClass = row.incident_class;

    // Se o tipo do incidente for VAR ou Substituição, a linha é ignorada
    if (["varDecision", "substitution"].includes(incType)) return false;
    
    // Se a classe do incidente for Lesão, a linha é ignorada
    if (incClass === "injury") return false;

    return true; // Mantém o incidente na lista
});

console.log("Total de incidentes válidos (após o filtro): " + filteredRows.length);

// ── Colunas Originais ─────────────────────────────────────────────────
const FIELDNAMES = [
    "match_id", "tournament_name", "season", "round",
    "home_team", "away_team", "incident_type", "incident_class",
    "minute", "added_time", "is_home", "player_name", "player_id",
    "assist_name", "assist_id", "player_out_name", "player_out_id",
    "card_reason", "rescinded", "substitution_injury", "var_decision",
    "goal_body_part", "goal_type", "penalty_reason", "score_home", "score_away"
];

// Aplica o filtro removendo as colunas indesejadas
const FINAL_FIELDNAMES = FIELDNAMES.filter(col => !IGNORE_KEYS.includes(col));

// ── Salvar CSV na mesma pasta do JSON (Sem bibliotecas externas) ──────
const parsedPath = path.parse(inputJson);
const outputCsv = path.join(parsedPath.dir, `${parsedPath.name}_supabase.csv`);

// Montando o cabeçalho do CSV
let csvContent = FINAL_FIELDNAMES.join(",") + "\n";

// Montando as linhas iterando sobre as propriedades mantidas
filteredRows.forEach(row => {
    const rowValues = FINAL_FIELDNAMES.map(field => {
        let val = row[field];
        if (val === null || val === undefined) val = "";
        
        // Converte para string e lida com campos que possam ter vírgulas ou aspas
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