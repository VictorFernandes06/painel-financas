// Painel de Finanças Pessoais — carregador.
// Cole este arquivo UMA vez no Código.gs do Apps Script da planilha.
// O código do painel é baixado do seu repositório no GitHub; quando ele muda,
// o painel se atualiza sozinho (em até 10 minutos). Seus dados ficam só na planilha.
//
// Repositório privado: em Configurações do projeto (engrenagem) > Propriedades do script,
// crie a propriedade GITHUB_TOKEN com uma chave de leitura do repositório.

var PAINEL_REPO = 'VictorFernandes06/painel-financas';
var PAINEL_RAMO = 'main';
var PAINEL_MINUTOS_CACHE = 10;
var painelCache_ = null;

function painelBaixar_(caminho) {
  var cache = CacheService.getScriptCache();
  var chave = 'painel:' + caminho;
  var partes = Number(cache.get(chave + ':n') || 0);
  if (partes > 0) {
    var nomes = [];
    for (var i = 0; i < partes; i++) nomes.push(chave + ':' + i);
    var achados = cache.getAll(nomes);
    if (Object.keys(achados).length === partes) return nomes.map(function (n) { return achados[n]; }).join('');
  }
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  var cabecalhos = { Accept: 'application/vnd.github.raw' };
  if (token) cabecalhos.Authorization = 'Bearer ' + token;
  var url = 'https://api.github.com/repos/' + PAINEL_REPO + '/contents/' + caminho + '?ref=' + PAINEL_RAMO;
  var resposta = UrlFetchApp.fetch(url, { headers: cabecalhos, muteHttpExceptions: true });
  if (resposta.getResponseCode() !== 200) {
    throw new Error('[502] Não consegui baixar o painel do GitHub (' + resposta.getResponseCode() + '). Confira o repositório ' + PAINEL_REPO + (token ? '' : ' ou crie a chave GITHUB_TOKEN se ele for privado') + '.');
  }
  var texto = resposta.getContentText('UTF-8');
  var pedacos = {};
  var n = 0;
  for (var p = 0; p < texto.length; p += 90000) pedacos[chave + ':' + n++] = texto.slice(p, p + 90000);
  pedacos[chave + ':n'] = String(n);
  try {
    cache.putAll(pedacos, PAINEL_MINUTOS_CACHE * 60);
  } catch (e) {
    // sem cache, tudo bem
  }
  return texto;
}

function painel_() {
  if (!painelCache_) painelCache_ = new Function(painelBaixar_('gas/dist/painel-server.js') + '\nreturn Painel;')();
  return painelCache_;
}

function doGet() {
  var html = painelBaixar_('gas/dist/index.html');
  var painel = painel_();
  // O título, o ícone e o resto da página vêm do GitHub (painel.web).
  if (painel.web) return painel.web(html);
  return HtmlService.createHtmlOutput(html)
    .setTitle('Fôlego · Finanças')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function apiCall(name, args) {
  var api = painel_().api;
  if (!Object.prototype.hasOwnProperty.call(api, name)) throw new Error('[404] Função desconhecida: ' + name);
  return api[name].apply(null, args || []);
}

// Nomes antigos: se o navegador ainda abrir a tela antiga, ela continua funcionando.
function apiStatus() { return apiCall('status', []); }
function apiOptions() { return apiCall('options', []); }
function apiList() { return apiCall('list', []); }
function apiCreate(b) { return apiCall('create', [b]); }
function apiUpdate(t, r, b, e) { return apiCall('update', [t, r, b, e]); }
function apiRemove(t, r, e) { return apiCall('remove', [t, r, e]); }
function apiAccounts() { return apiCall('accounts', []); }
function apiSaveBudgets(b) { return apiCall('saveBudgets', [b]); }
function apiSaveAccount(b, r, n) { return apiCall('saveAccount', [b, r, n]); }
function apiRemoveAccount(r, n) { return apiCall('removeAccount', [r, n]); }
function apiCreateTransfer(b) { return apiCall('createTransfer', [b]); }
function apiRemoveTransfer(r, e) { return apiCall('removeTransfer', [r, e]); }

// Rode esta função uma vez no editor para autorizar o acesso à internet e à planilha.
function autorizar() {
  painelBaixar_('gas/dist/painel-server.js');
  SpreadsheetApp.getActiveSpreadsheet().getName();
}
