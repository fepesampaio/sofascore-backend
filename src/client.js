const https = require("https");

// Configurações do endpoint do Smartproxy
const SCRAPER_API_URL = "scraper-api.decodo.com";
const SCRAPER_API_PATH = "/v2/scrape";

/**
 * TOKEN DE AUTENTICAÇÃO
 * Deve ser configurado no Render (ou seu .env local) como SMARTPROXY_TOKEN.
 * O valor deve ser o "Basic authentication token" que aparece no seu painel.
 */
const AUTH_TOKEN = process.env.SMARTPROXY_TOKEN;

/**
 * Faz uma requisição através da Scraping API do Smartproxy.
 * Envia um POST para a Decodo pedindo para buscar a URL do Sofascore.
 */
function get(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    // 1. Montamos a URL do Sofascore que queremos que a Decodo acesse
    const query = new URLSearchParams(params).toString();
    const targetUrl = `https://api.sofascore.com/api/v1${endpoint}${query ? "?" + query : ""}`;

    // 2. Preparamos o corpo da requisição JSON conforme o seu teste no site
    const postData = JSON.stringify({
      url: targetUrl,
      proxy_pool: "premium", // Usando o pool premium que funcionou no teste
      headless: "html"       // Garante a extração correta dos dados
    });

    const options = {
      hostname: SCRAPER_API_URL,
      path: SCRAPER_API_PATH,
      method: "POST", // A Scraping API exige o método POST
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Basic ${AUTH_TOKEN}` // Seu token de autenticação
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Erro Smartproxy: HTTP ${res.statusCode} - ${data}`));
        }
        try {
          const response = JSON.parse(data);
          
          /**
           * A API do Smartproxy retorna o resultado do SofaScore dentro do campo 'content'.
           * Como o dado original é um JSON, ele vem como uma string dentro da resposta.
           */
          const targetContent = response.content || response;
          
          // Se o conteúdo for uma string, fazemos o parse final para objeto
          resolve(typeof targetContent === 'string' ? JSON.parse(targetContent) : targetContent);
        } catch (e) {
          reject(new Error("Falha ao processar resposta do Smartproxy/SofaScore"));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Erro de rede no túnel Smartproxy: ${err.message}`));
    });

    // Enviamos os dados para a Decodo
    req.write(postData);
    req.end();
  });
}

/**
 * Função de aguardo para respeitar o fluxo da pipeline.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { get, sleep };