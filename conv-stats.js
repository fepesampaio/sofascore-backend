const fs = require("fs");
const path = require("path");

const GUI_MODE = process.env.SE_GUI_MODE === "1";

// ── FILTRO DE ESTATÍSTICAS ───────────────────────────────────────────
const IGNORE_KEYS = [];
// ─────────────────────────────────────────────────────────────────────

// ── Localizar arquivo de entrada (JSON) ──────────────────────────────
let inputJson = "";

if (GUI_MODE) {
    inputJson = process.env.SE_JSON_PATH || "";
    if (!inputJson) {
        const tournamentRaw = process.env.SE_TOURNAMENT_NAME || "dados";
        const seasonRaw = process.env.SE_SEASON || "2026";
        const filename = `results_${tournamentRaw}_${seasonRaw}.json`.replace(/ /g, "_");
        inputJson = path.join(process.cwd(), "output", filename);
    }
} else {
    inputJson = process.argv[2] || "";
    if (!inputJson) {
        console.error("Forneça o caminho do JSON. Ex: node conv-stats.js ./output/arquivo.json");
        process.exit(1);
    }
}

if (!fs.existsSync(inputJson)) {
    console.error(`[ERRO]: Arquivo não encontrado em: ${inputJson}`);
    process.exit(1);
}

console.log(`Lendo: ${inputJson}`);
const rawData = fs.readFileSync(inputJson, "utf-8");
const data = JSON.parse(rawData);

if (!data || data.length === 0) {
    console.log("[AVISO]: O arquivo JSON está vazio.");
    process.exit(0);
}

console.log(`Total de partidas para processar: ${data.length}`);

// ── Mapeamento Dinâmico de Colunas ───────────────────────────────────
const allKeysSet = new Set();

data.forEach(match => {
    if (!match.statistics) return;

    // Procura o bloco com period = "ALL"
    const allBlock = match.statistics.find(block => block.period === "ALL");
    if (!allBlock || !allBlock.groups) return;

    allBlock.groups.forEach(group => {
        if (!group.statisticsItems) return;
        group.statisticsItems.forEach(item => {
            const key = item.key.toLowerCase();
            if (!IGNORE_KEYS.includes(key)) {
                allKeysSet.add(key);
            }
        });
    });
});

const allKeys = Array.from(allKeysSet);

// ── Construção das Linhas do CSV ──────────────────────────────────────
const rows = [];
const tournamentName = process.env.SE_TOURNAMENT_NAME || "";
const seasonName = process.env.SE_SEASON || "";

data.forEach(match => {
    // Tratamento da data (remove T e corta para 19 caracteres)
    let startTime = "";
    if (match.startTime) {
        startTime = match.startTime.replace("T", " ").substring(0, 19);
    }

    const row = {
        "match_id": match.matchId,
        "round": match.round,
        "home_team": match.home,
        "away_team": match.away,
        "score_home": match.scoreHome,
        "score_away": match.scoreAway,
        "status": match.status,
        "start_time": startTime,
        "tournament_name": tournamentName,
        "season": seasonName
    };

    // Inicializa colunas dinâmicas como vazio
    allKeys.forEach(key => {
        row[`home_${key}`] = "";
        row[`away_${key}`] = "";
    });

    // Preenche com dados reais se existirem
    if (match.statistics) {
        const allBlock = match.statistics.find(block => block.period === "ALL");
        if (allBlock && allBlock.groups) {
            allBlock.groups.forEach(group => {
                if (group.statisticsItems) {
                    group.statisticsItems.forEach(item => {
                        const k = item.key.toLowerCase();
                        if (allKeys.includes(k)) {
                            // Verifica null/undefined para não printar "null" no CSV
                            row[`home_${k}`] = (item.homeValue !== null && item.homeValue !== undefined) ? item.homeValue : "";
                            row[`away_${k}`] = (item.awayValue !== null && item.awayValue !== undefined) ? item.awayValue : "";
                        }
                    });
                }
            });
        }
    }

    rows.push(row);
});

// ── Geração do Arquivo de Saída ──────────────────────────────────────
const parsedPath = path.parse(inputJson);
const outputCsv = path.join(parsedPath.dir, `${parsedPath.name}_supabase.csv`);

if (rows.length > 0) {
    // As colunas finais serão a junção das chaves base + as dinâmicas
    const fieldnames = Object.keys(rows[0]);
    let csvContent = fieldnames.join(",") + "\n";

    rows.forEach(row => {
        const rowValues = fieldnames.map(field => {
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

    console.log(`\nSucesso: ${rows.length} partidas convertidas.`);
    console.log(`Colunas geradas: ${fieldnames.length}`);
    console.log(`Arquivo pronto: ${outputCsv}`);
} else {
    console.log("[ERRO]: Nenhuma linha processada para gerar o CSV.");
}