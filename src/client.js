const https = require("https");

const BASE_URL = "api.sofascore.com";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Origin: "https://www.sofascore.com",
  Referer: "https://www.sofascore.com/",
};

/**
 * Faz uma requisição GET à API do Sofascore.
 * @param {string} endpoint  - Ex: '/team/1961/players'
 * @param {object} params    - Query params opcionais (ex: { limit: 10 })
 * @returns {Promise<object>}
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
          return reject(new Error(`HTTP ${res.statusCode} em ${endpoint}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Resposta inválida (não é JSON)"));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

/**
 * Aguarda N milissegundos (para respeitar o rate limit).
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { get, sleep };
