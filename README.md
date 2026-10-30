# Painel de Finanças Pessoais · Google Sheets

Painel em React que lê e grava suas transações direto numa planilha do Google. Você pode inserir, editar em linha e excluir pela interface, e a mudança vai na hora para o Sheets.

## Como funciona

```
Navegador (React)  ──/api──▶  Servidor Node (Express)  ──Service Account──▶  Google Sheets
```

O navegador nunca vê as credenciais do Google. Elas ficam só no `.env`, que é lido pelo servidor em `server/`.

## Passo a passo

### 1. Requisitos
- Node.js 22 ou mais novo.
- A planilha precisa estar no formato **Planilhas Google**. Um arquivo `.xlsx` guardado no Drive não funciona. Para converter, abra o arquivo no Drive e use **Arquivo → Salvar como Planilhas Google**. O link novo tem `/spreadsheets/d/`.

### 2. Criar a Service Account (uma vez só, cerca de 5 minutos)
1. Acesse https://console.cloud.google.com e crie um projeto. Pode ser com o nome "painel-financas".
2. Em **APIs e serviços → Biblioteca**, ative a **Google Sheets API**.
3. Em **IAM e administrador → Contas de serviço**, crie uma conta de serviço. Ela não precisa de nenhum papel.
4. Abra a conta criada e vá em **Chaves → Adicionar chave → JSON**. O download começa sozinho.
5. Salve esse arquivo como `credentials/service-account.json`.
6. Na sua planilha, clique em **Compartilhar** e adicione o e-mail da conta de serviço como **Editor**. O e-mail termina em `@...iam.gserviceaccount.com`.

### 3. Configurar e rodar
```bash
copy .env.example .env    # Windows (no Mac/Linux: cp .env.example .env)
# abra o .env e cole o link da sua planilha em GOOGLE_SHEET_URL
npm install
npm run dev
```
O painel abre em http://localhost:5173.

Para testar sem planilha, use `npm run dev:demo`. Ele usa dados de exemplo em memória e nada vai para o Google.

## Formato da planilha (modelo Oxigênio Financeiro)

O painel trabalha com três abas da planilha. As outras (Mapa, Cartão, Orçamento, Dashboard…) continuam funcionando sozinhas, porque as fórmulas delas leem as abas Receitas e Despesas.

| Aba | O painel usa | Colunas |
| --- | --- | --- |
| **Receitas** | lê e grava | Data, Receita, Valor, Observação, Mês, Ano |
| **Despesas** | lê e grava | Data, Grupo, Despesa, Tipo, Forma de pagamento, Cartão, Parcela, Total de parcelas, Valor, Descrição, Status, Mês, Ano |
| **Cadastro** | só lê | listas de Receitas, Grupos (e as despesas de cada grupo) e Cartões |

- As colunas são achadas pelo nome do cabeçalho, então a ordem pode mudar.
- **Mês** e **Ano** são preenchidos automaticamente a partir da data. As fórmulas do Mapa e do Orçamento dependem deles.
- As opções do formulário vêm da aba **Cadastro**. Para criar uma categoria nova, adicione na aba Cadastro e clique em recarregar no painel.
- Um lançamento novo ocupa a primeira linha vazia da aba. Assim ele aproveita a formatação e as listas suspensas que já estão lá.
- Excluir apaga só os valores da linha. A formatação e as validações continuam.
- A planilha só aceita datas a partir de 02/05/2025, e o painel avisa antes de enviar.
- Linhas com data ou valor inválido (ou zerado) são ignoradas, e o painel mostra quais são.

## Segurança

- As credenciais ficam só no servidor (`.env` e `credentials/`), e os dois estão no `.gitignore`.
- O servidor escuta só em `127.0.0.1`, então ele não fica exposto na rede.
- Todo dado recebido do navegador é validado no servidor: tipo, tamanho e formato.
- Textos que começam com `=`, `+`, `-` ou `@` são gravados como texto. Isso bloqueia a injeção de fórmulas na planilha.
- Antes de editar ou excluir, o servidor confere se a linha ainda tem os dados que você viu. Se alguém mudou a planilha nesse meio tempo, a operação é recusada e os dados são recarregados. Assim o painel nunca apaga a linha errada.

## Estrutura

```
server/
  index.js                     Inicia a API (e serve o site compilado em produção)
  app.js                       Rotas: GET /api/options, GET/POST /api/transactions, PUT/DELETE /api/transactions/:tipo/:linha
  config.js                    Lê o .env e extrai o ID do link da planilha
  layout.js                    Abas e nomes de colunas do modelo Oxigênio Financeiro
  mapping.js                   Detecta colunas, converte linha ⇄ lançamento, lê o Cadastro
  validation.js                Valida o que chega do navegador
  repositories/googleSheets.js Leitura e escrita no Google Sheets
  repositories/memorySheetsClient.js  Planilha em memória (modo demonstração e testes)
  test/                        Testes (npm test)
shared/categories.js           Tipos e categorias usados pelos dois lados
src/
  api/client.js                Chamadas à API
  hooks/useTransactions.js     Carrega, cria, edita e exclui (e relê a planilha após cada mudança)
  hooks/useLocalStorage.js     Guarda só a meta mensal no navegador
  components/                  Dashboard, SummaryCards, AnalyticsCharts, TransactionTable, TransactionModal
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | API e site com recarga automática |
| `npm run dev:demo` | O mesmo, com dados de exemplo e sem Google |
| `npm test` | Roda os testes do servidor |
| `npm run build` e depois `npm start` | Versão de produção em http://127.0.0.1:3001 |
