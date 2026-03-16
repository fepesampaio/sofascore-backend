const https = require("https");

const BASE_URL = "api.sofascore.com";

// Reforçamos os headers para parecerem 100% um navegador Chrome moderno
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Origin": "https://www.sofascore.com",
  "Referer": "https://www.sofascore.com/",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
};

/**
 * Faz uma requisição GET à API do Sofascore.
 */
function get(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString();
    const path = `/api/v1${endpoint}${query ? "?" + query : ""}`;

    const options = {
      hostname: BASE_URL,
      path,
      method: "GET",
      headers: DEFAULT_HEADERS,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          // Se o erro persistir, incluímos o Path no erro para facilitar o debug
          return reject(new Error(`HTTP ${res.statusCode} em ${endpoint}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Resposta inválida (não é JSON)"));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Erro de rede: ${err.message}`));
    });
    
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { get, sleep };