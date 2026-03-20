const https    = require("https");
const fs       = require("fs");
const path     = require("path");
const readline = require("readline");

// ── Configuração Base ────────────────────────────────────────────────
const BATCH_SIZE   = 1000;
const DELAY_MS     = 300;

const TABLES = ["statistics", "incidents", "lineups"];

const GUI_MODE = process.env.SE_GUI_MODE === "1";
const _BATCH = GUI_MODE ? (parseInt(process.env.SE_BATCH_SIZE) || BATCH_SIZE) : BATCH_SIZE;
const _DELAY = GUI_MODE ? (parseInt(process.env.IMPORT_DELAY_MS)   || DELAY_MS)   : DELAY_MS;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines   = content.split("\n").filter((l) => l.trim());
  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = [];
    let current  = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { values.push(current); current = ""; continue; }
      current += char;
    }
    values.push(current);

    const obj = {};
    headers.forEach((h, i) => {

      if (h === "id") return; 

      const val = (values[i] || "").trim();

      if (val === "") {
        obj[h] = null;
      } else if (!isNaN(val) && val !== "" && h !== "match_id") {
        obj[h] = Number(val);
      } else if (val === "true") {
        obj[h] = true;
      } else if (val === "false") {
        obj[h] = false;
      } else {
        obj[h] = val;
      }
    });
    return obj;
  });
}

// 🆕 NOVA FUNÇÃO: Obter colunas válidas da tabela
async function getTableColumns(tableName, dbUrl, dbKey) {
  return new Promise((resolve, reject) => {
    // Query para pegar o schema da tabela
    const url = new URL(`/rest/v1/${tableName}?limit=0`, dbUrl);
    
    const options = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   "HEAD",
      headers: {
        "apikey":          dbKey,
        "Authorization":   `Bearer ${dbKey}`,
      },
    };

    const req = https.request(options, (res) => {
      // O Supabase retorna as colunas no header "Content-Range"
      // ou podemos fazer um SELECT para pegar a estrutura
      
      // Alternativa mais confiável: fazer um SELECT com limit 1
      const selectUrl = new URL(`/rest/v1/${tableName}?limit=1`, dbUrl);
      const selectOptions = {
        hostname: selectUrl.hostname,
        path:     selectUrl.pathname + selectUrl.search,
        method:   "GET",
        headers: {
          "apikey":          dbKey,
          "Authorization":   `Bearer ${dbKey}`,
        },
      };

      const selectReq = https.request(selectOptions, (selectRes) => {
        let data = "";
        selectRes.on("data", (chunk) => (data += chunk));
        selectRes.on("end", () => {
          try {
            const rows = JSON.parse(data);
            if (rows.length > 0) {
              const columns = Object.keys(rows[0]);
              resolve(columns);
            } else {
              // Se tabela vazia, tenta outro método
              resolve([]);
            }
          } catch (e) {
            reject(new Error(`Erro ao parsear colunas: ${e.message}`));
          }
        });
      });

      selectReq.on("error", reject);
      selectReq.end();
    });

    req.on("error", reject);
    req.end();
  });
}

// 🆕 NOVA FUNÇÃO: Filtrar apenas colunas válidas
function filterRowColumns(rows, validColumns) {
  return rows.map(row => {
    const filtered = {};
    validColumns.forEach(col => {
      if (col in row) {
        filtered[col] = row[col];
      }
    });
    return filtered;
  });
}

function insertBatch(rows, tableName, dbUrl, dbKey, conflictKey) {
  return new Promise((resolve, reject) => {
    const body    = JSON.stringify(rows);
    
    const url     = new URL(`/rest/v1/${tableName}?on_conflict=${conflictKey}`, dbUrl);
    
    const options = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   "POST",
      headers: {
        "Content-Type":    "application/json",
        "apikey":          dbKey,
        "Authorization":   `Bearer ${dbKey}`,
        "Prefer":          "return=minimal, resolution=merge-duplicates",
        "Content-Length":  Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        else resolve();
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log("=== IMPORTADOR SUPABASE (ESTEIRA AUTOMÁTICA) ===\n");

  let supabaseUrl, supabaseKey, tasks = [];

  if (GUI_MODE) {
    supabaseUrl = process.env.SUPABASE_URL;
    supabaseKey = process.env.SUPABASE_KEY;

    const tournament = (process.env.SE_TOURNAMENT_NAME || "dados");
    const season = process.env.SE_SEASON || "2026";
    const baseDir = path.join(process.cwd(), "output");

    const fileConfigs = [
      { file: `results_${tournament}_${season}_supabase.csv`, table: "statistics", conflict: "match_id" },
      { file: `incidents_${tournament}_${season}_supabase.csv`, table: "incidents", conflict: "id" },
      { file: `lineups_${tournament}_${season}_supabase.csv`, table: "lineups", conflict: "id" }
    ];

    for (const config of fileConfigs) {
      const fullPath = path.join(baseDir, config.file);
      if (fs.existsSync(fullPath)) {

        tasks.push({ path: fullPath, table: config.table, conflict: config.conflict });
      } else {
        console.log(`[AVISO]: Arquivo não encontrado, pulando: ${config.file}`);
      }
    }

    if (tasks.length === 0) {
      console.error("Nenhum CSV foi encontrado para importação.");
      process.exit(1);
    }
  }

  for (const task of tasks) {
    console.log(`\nIniciando: ${path.basename(task.path)} -> Tabela: ${task.table}`);
    
    try {
      // 🆕 Obter colunas válidas da tabela
      console.log(`  Validando colunas da tabela ${task.table}...`);
      const validColumns = await getTableColumns(task.table, supabaseUrl, supabaseKey);
      console.log(`  Colunas encontradas: ${validColumns.length}`);
      
      const rows = parseCSV(task.path);
      
      // 🆕 Filtrar apenas colunas que existem na tabela
      const filteredRows = filterRowColumns(rows, validColumns);
      console.log(`  Colunas no CSV: ${Object.keys(rows[0] || {}).length}`);
      console.log(`  Colunas válidas para envio: ${Object.keys(filteredRows[0] || {}).length}`);
      
      const uniqueRows = task.table === "statistics" 
        ? Array.from(new Map(filteredRows.map(item => [item['match_id'], item])).values())
        : filteredRows;

      const total = uniqueRows.length;
      const batches = Math.ceil(total / _BATCH);
      
      let inserted = 0;

      for (let i = 0; i < batches; i++) {
        const batch = uniqueRows.slice(i * _BATCH, (i + 1) * _BATCH);
        process.stdout.write(`  Lote ${i + 1}/${batches} (${inserted}/${total})...\r`);

        try {

          await insertBatch(batch, task.table, supabaseUrl, supabaseKey, task.conflict);
          inserted += batch.length;
        } catch (err) {
          console.log(`\n  [ERRO] Lote ${i + 1} na tabela ${task.table}: ${err.message}`);
        }
        await sleep(_DELAY);
      }
      console.log(`\n✓ ${task.table} finalizada. (${inserted} registros inseridos)`);
    } catch (err) {
      console.log(`\n✗ ERRO ao processar ${task.table}: ${err.message}`);
    }
  }

  console.log("\n=== TODAS AS IMPORTAÇÕES CONCLUÍDAS ===");
  rl.close();
}

main().catch((err) => {
  console.error("\nErro: " + err.message);
  rl.close();
  process.exit(1);
});