const https = require("https");

const BASE_URL = "api.sofascore.com";

// Headers que imitam um navegador real
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Origin": "https://www.sofascore.com",
  "Referer": "https://www.sofascore.com/",
};

function get(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString();
    const path = `/api/v1${endpoint}${query ? "?" + query : ""}`;

    const options = {
      hostname: BASE_URL,
      path,
      method: "GET", // Voltamos para o GET direto
      headers: DEFAULT_HEADERS,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode} em ${endpoint}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Resposta inválida (não é JSON)"));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`Erro de rede: ${err.message}`)));
    req.end();
  });
}

module.exports = { get, sleep: (ms) => new Promise(r => setTimeout(r, ms)) };