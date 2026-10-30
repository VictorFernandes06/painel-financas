var Painel = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // gas/src/entry.js
  var entry_exports = {};
  __export(entry_exports, {
    api: () => api
  });

  // shared/categories.js
  var TYPES = { INCOME: "receita", EXPENSE: "despesa" };
  var NATURES = ["Essencial", "Não Essencial", "Investimento"];
  var PAYMENT_METHODS = ["Pix", "Cartão", "Débito", "Dinheiro"];
  var STATUSES = ["Pago", "A Pagar", "Atrasado"];
  var MONTH_NAMES = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
  ];

  // server/layout.js
  var LAYOUT = {
    [TYPES.INCOME]: {
      tab: "Receitas",
      fields: {
        date: ["data"],
        category: ["receita", "fonte", "origem"],
        amount: ["valor"],
        description: ["observacao", "observacoes", "descricao"],
        month: ["mes"],
        year: ["ano"],
        account: ["conta"]
      },
      required: ["date", "category", "amount"]
    },
    [TYPES.EXPENSE]: {
      tab: "Despesas",
      fields: {
        date: ["data"],
        group: ["grupo"],
        category: ["despesa"],
        nature: ["tipo"],
        payment: ["forma de pagamento", "pagamento"],
        card: ["cartao"],
        installment: ["parcela"],
        installments: ["total de parcelas", "parcelas"],
        amount: ["valor"],
        description: ["descricao", "detalhes"],
        status: ["status", "situacao"],
        month: ["mes"],
        year: ["ano"],
        account: ["conta"]
      },
      required: ["date", "group", "category", "amount"]
    }
  };
  var CADASTRO_TAB = "Cadastro";

  // server/mapping.js
  var normalize = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  function findHeaderRow(values) {
    for (let i = 0; i < Math.min(values.length, 5); i++) {
      const cells = (values[i] ?? []).map(normalize);
      if (cells.includes("data") && cells.includes("valor")) return i;
    }
    return -1;
  }
  function detectColumns(headerRow, layout) {
    const normalized = (headerRow ?? []).map(normalize);
    const columns = {};
    for (const [field, aliases] of Object.entries(layout.fields)) {
      const index = normalized.findIndex((h) => aliases.includes(h));
      if (index !== -1) columns[field] = index;
    }
    if (layout.fields.group && columns.group === void 0 && columns.category > 0) {
      columns.group = columns.category - 1;
    }
    const missing = layout.required.filter((f) => columns[f] === void 0);
    return { columns, missing };
  }
  function parseAmount(value) {
    if (typeof value === "number") return value;
    let s = String(value ?? "").trim();
    if (!s) return NaN;
    const negative = /^\(.*\)$/.test(s) || s.includes("-");
    s = s.replace(/[^\d.,]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
    const n = Number(s);
    return negative ? -Math.abs(n) : n;
  }
  var pad = (n) => String(n).padStart(2, "0");
  function valid(y, m, d) {
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  function parseDate(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const d = new Date(Math.round((value - 25569) * 86400 * 1e3));
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    const s = String(value ?? "").trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      const year = m[3].length === 2 ? 2e3 + Number(m[3]) : Number(m[3]);
      return valid(year, +m[2], +m[1]);
    }
    return null;
  }
  function toSerial(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 864e5 + 25569;
  }
  var text = (v) => String(v ?? "").trim();
  var intOrNull = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  function rowToTransaction(row, rowNumber, columns, type) {
    const cell = (field) => columns[field] === void 0 ? "" : row[columns[field]];
    if (["date", "amount", "category"].every((f) => text(cell(f)) === "")) return { blank: true };
    const date = parseDate(cell("date"));
    const amount = parseAmount(cell("amount"));
    const problems = [];
    if (!date) problems.push("data inválida");
    if (!Number.isFinite(amount) || amount <= 0) problems.push("valor vazio ou inválido");
    if (problems.length) {
      const tab = type === TYPES.INCOME ? "Receitas" : "Despesas";
      return { error: `${tab}, linha ${rowNumber}: ${problems.join(", ")}` };
    }
    const base = {
      id: `${type}-${rowNumber}`,
      row: rowNumber,
      type,
      date,
      amount: Math.round(amount * 100) / 100,
      category: text(cell("category")) || "Outros",
      description: text(cell("description")),
      account: text(cell("account"))
    };
    if (type === TYPES.INCOME) return { transaction: base };
    return {
      transaction: {
        ...base,
        group: text(cell("group")) || "Outras",
        nature: text(cell("nature")),
        payment: text(cell("payment")),
        card: text(cell("card")),
        installment: intOrNull(cell("installment")),
        installments: intOrNull(cell("installments")),
        status: text(cell("status"))
      }
    };
  }
  function safeText(value) {
    const s = String(value ?? "");
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  }
  function transactionToRow(t, columns, width) {
    const row = Array.from({ length: width }, () => null);
    const [year, month] = t.date.split("-").map(Number);
    const values = {
      date: toSerial(t.date),
      category: safeText(t.category),
      amount: t.amount,
      description: safeText(t.description ?? ""),
      month: MONTH_NAMES[month - 1],
      year,
      group: safeText(t.group ?? ""),
      nature: t.nature ?? "",
      payment: t.payment ?? "",
      card: safeText(t.card ?? ""),
      installment: t.installment ?? "",
      installments: t.installments ?? "",
      status: t.status ?? "",
      account: safeText(t.account ?? "")
    };
    for (const [field, index] of Object.entries(columns)) {
      if (field in values) row[index] = values[field];
    }
    return row;
  }
  function parseCadastro(values) {
    const header = (values[0] ?? []).map(text);
    const column = (name) => {
      const index = header.findIndex((h) => normalize(h) === normalize(name));
      if (index === -1) return [];
      return [...new Set(values.slice(1).map((r) => text(r[index])).filter(Boolean))];
    };
    const groups = column("Grupo");
    return {
      incomeCategories: column("Receitas"),
      groups: Object.fromEntries(groups.map((g) => [g, column(g)])),
      cards: column("Cartão")
    };
  }
  function addMonths(iso, months) {
    const [y, m, d] = iso.split("-").map(Number);
    const total = y * 12 + (m - 1) + months;
    const year = Math.floor(total / 12);
    const month = total % 12 + 1;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
  }
  function expandRepeat(input) {
    const { repeat = 1, ...base } = input;
    const parcelado = base.installments > 1;
    return Array.from({ length: repeat }, (_, i) => ({
      ...base,
      date: addMonths(base.date, i),
      ...parcelado ? { installment: base.installment + i } : {}
    }));
  }

  // server/validation.js
  var MAX_TEXT = 120;
  var MAX_AMOUNT = 1e9;
  var str = (v) => typeof v === "string" ? v.trim() : "";
  function validateTransactionInput(body, options) {
    const input = body && typeof body === "object" ? body : {};
    const errors = [];
    const type = input.type;
    const date = str(input.date);
    const category = str(input.category);
    const description = str(input.description);
    const amount = typeof input.amount === "number" ? input.amount : NaN;
    if (type !== TYPES.INCOME && type !== TYPES.EXPENSE) errors.push("Tipo deve ser receita ou despesa.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("Data inválida.");
    else if (date < "2025-05-02") errors.push("A planilha só aceita datas a partir de 02/05/2025.");
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) errors.push("Valor inválido.");
    if (description.length > MAX_TEXT) errors.push("Descrição muito longa.");
    if (!category) errors.push("Categoria obrigatória.");
    const account = str(input.account);
    if (account && options?.accounts && !options.accounts.includes(account)) errors.push(`Conta "${account}" não está cadastrada.`);
    const value = { type, date, category, description, account, amount: Math.round(amount * 100) / 100 };
    const repeat = input.repeat == null || input.repeat === "" ? 1 : Number(input.repeat);
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 60) errors.push("Repetir: escolha de 1 a 60 meses.");
    else if (repeat > 1) value.repeat = repeat;
    if (type === TYPES.INCOME) {
      if (options?.incomeCategories?.length && category && !options.incomeCategories.includes(category)) {
        errors.push(`"${category}" não está na lista de Receitas do Cadastro.`);
      }
    }
    if (type === TYPES.EXPENSE) {
      const group = str(input.group);
      const nature = str(input.nature);
      const payment = str(input.payment);
      const card = str(input.card);
      const status = str(input.status);
      const installment = input.installment == null || input.installment === "" ? 1 : Number(input.installment);
      const installments = input.installments == null || input.installments === "" ? 1 : Number(input.installments);
      const groups = options?.groups ?? {};
      if (!group) errors.push("Grupo obrigatório.");
      else if (Object.keys(groups).length && !groups[group]) errors.push(`Grupo "${group}" não está no Cadastro.`);
      else if (groups[group]?.length && category && !groups[group].includes(category)) {
        errors.push(`"${category}" não pertence ao grupo ${group} no Cadastro.`);
      }
      if (nature && !NATURES.includes(nature)) errors.push(`Tipo deve ser: ${NATURES.join(", ")}.`);
      if (payment && !PAYMENT_METHODS.includes(payment)) errors.push(`Forma de pagamento deve ser: ${PAYMENT_METHODS.join(", ")}.`);
      if (!STATUSES.includes(status)) errors.push(`Status deve ser: ${STATUSES.join(", ")}.`);
      if (card && options?.cards?.length && !options.cards.includes(card)) errors.push(`Cartão "${card}" não está no Cadastro.`);
      if (!Number.isInteger(installment) || installment < 1 || installment > 360) errors.push("Parcela inválida.");
      if (!Number.isInteger(installments) || installments < 1 || installments > 360) errors.push("Total de parcelas inválido.");
      if (installment > installments) errors.push("A parcela não pode ser maior que o total de parcelas.");
      if (installments > 1 && value.repeat && installment + value.repeat - 1 > installments) {
        errors.push("Há mais meses do que parcelas restantes.");
      }
      Object.assign(value, { group, nature, payment, card, status, installment, installments });
    }
    return errors.length ? { errors } : { value };
  }

  // shared/accounts.js
  var ACCOUNTS_TAB = "Contas";
  var TRANSFERS_TAB = "Transferências";
  var ACCOUNT_KINDS = ["Conta corrente", "Poupança", "Reserva", "Investimento", "Carteira", "Outro"];
  var ACCOUNTS_HEADER = ["Conta", "Banco", "Tipo", "Saldo inicial", "Meta", "Prazo da meta"];
  var BUDGETS_TAB = "Limites";
  var BUDGETS_HEADER = ["Grupo", "Limite mensal"];
  var TRANSFERS_HEADER = ["Data", "De", "Para", "Valor", "Descrição", "Mês", "Ano"];
  var MAX_TEXT2 = 60;
  var MAX_AMOUNT2 = 1e9;
  var str2 = (v) => typeof v === "string" ? v.trim() : "";
  var num = (v) => typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  var money = (v) => Math.round(v * 100) / 100;
  function parseAccounts(values, toISO = () => null) {
    const accounts = [];
    (values ?? []).slice(1).forEach((r, i) => {
      const name = String(r?.[0] ?? "").trim();
      if (!name) return;
      const initial = num(r[3]);
      const goal = num(r[4]);
      accounts.push({
        row: i + 2,
        name,
        bank: String(r[1] ?? "").trim(),
        kind: String(r[2] ?? "").trim() || "Outro",
        initial: Number.isFinite(initial) ? money(initial) : 0,
        goal: Number.isFinite(goal) && goal > 0 ? money(goal) : null,
        deadline: r[5] ? toISO(r[5]) : null
      });
    });
    return accounts;
  }
  function parseTransfers(values, toISO) {
    const transfers = [];
    (values ?? []).slice(1).forEach((r, i) => {
      const date = toISO(r?.[0]);
      const amount = num(r?.[3]);
      const from = String(r?.[1] ?? "").trim();
      const to = String(r?.[2] ?? "").trim();
      if (!date || !from || !to || !Number.isFinite(amount) || amount <= 0) return;
      transfers.push({ row: i + 2, id: `transferencia-${i + 2}`, date, from, to, amount: money(amount), description: String(r[4] ?? "").trim() });
    });
    return transfers;
  }
  function validateAccountInput(body, existingNames = []) {
    const input = body && typeof body === "object" ? body : {};
    const errors = [];
    const name = str2(input.name);
    const bank = str2(input.bank);
    const kind = str2(input.kind);
    const initial = input.initial == null || input.initial === "" ? 0 : num(input.initial);
    const goal = input.goal == null || input.goal === "" ? null : num(input.goal);
    if (!name) errors.push("Dê um nome para a conta.");
    else if (name.length > MAX_TEXT2) errors.push("Nome muito longo.");
    else if (/^[=+\-@]/.test(name)) errors.push("O nome não pode começar com = + - ou @.");
    else if (existingNames.some((n) => n.toLowerCase() === name.toLowerCase())) errors.push(`Já existe uma conta chamada "${name}".`);
    if (bank.length > MAX_TEXT2) errors.push("Nome do banco muito longo.");
    if (!ACCOUNT_KINDS.includes(kind)) errors.push(`Tipo deve ser: ${ACCOUNT_KINDS.join(", ")}.`);
    if (!Number.isFinite(initial) || Math.abs(initial) > MAX_AMOUNT2) errors.push("Saldo inicial inválido.");
    if (goal !== null && (!Number.isFinite(goal) || goal <= 0 || goal > MAX_AMOUNT2)) errors.push("Meta inválida.");
    const deadline = str2(input.deadline);
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) errors.push("Prazo inválido.");
    if (deadline && goal === null) errors.push("Defina a meta para usar o prazo.");
    if (errors.length) return { errors };
    return { value: { name, bank, kind, initial: money(initial), goal: goal === null ? null : money(goal), deadline: deadline || null } };
  }
  function validateTransferInput(body, accountNames = []) {
    const input = body && typeof body === "object" ? body : {};
    const errors = [];
    const date = str2(input.date);
    const from = str2(input.from);
    const to = str2(input.to);
    const description = str2(input.description);
    const amount = typeof input.amount === "number" ? input.amount : NaN;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("Data inválida.");
    if (!accountNames.includes(from)) errors.push("Escolha a conta de origem.");
    if (!accountNames.includes(to)) errors.push("Escolha a conta de destino.");
    if (from && from === to) errors.push("A origem e o destino precisam ser contas diferentes.");
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT2) errors.push("Valor inválido.");
    if (description.length > 120) errors.push("Descrição muito longa.");
    if (errors.length) return { errors };
    return { value: { date, from, to, amount: money(amount), description } };
  }
  function parseBudgets(values) {
    const budgets = {};
    (values ?? []).slice(1).forEach((r) => {
      const group = String(r?.[0] ?? "").trim();
      const limit = num(r?.[1]);
      if (group && Number.isFinite(limit) && limit > 0) budgets[group] = money(limit);
    });
    return budgets;
  }
  function validateBudgets(body, groups = []) {
    const input = body && typeof body === "object" ? body : {};
    const errors = [];
    const value = {};
    for (const [group, raw] of Object.entries(input)) {
      if (raw === "" || raw == null || raw === 0) continue;
      const limit = typeof raw === "number" ? raw : NaN;
      if (groups.length && !groups.includes(group)) errors.push(`Grupo "${group}" não está no Cadastro.`);
      else if (!Number.isFinite(limit) || limit < 0 || limit > MAX_AMOUNT2) errors.push(`Limite inválido para ${group}.`);
      else value[group] = money(limit);
    }
    return errors.length ? { errors } : { value };
  }

  // gas/src/server.js
  var fail = (status, message) => {
    throw new Error(`[${status}] ${message}`);
  };
  function createGasBackend({ SpreadsheetApp: SpreadsheetApp2, Utilities: Utilities2, LockService: LockService2 }) {
    const ss = () => SpreadsheetApp2.getActiveSpreadsheet();
    const tz = () => ss().getSpreadsheetTimeZone();
    const normalizeCell = (v) => Object.prototype.toString.call(v) === "[object Date]" ? Utilities2.formatDate(v, tz(), "yyyy-MM-dd") : v;
    function sheetOrFail(name) {
      const sheet = ss().getSheetByName(name);
      if (!sheet) fail(422, `A planilha não tem a aba "${name}".`);
      return sheet;
    }
    function readTab(type) {
      const layout = LAYOUT[type];
      const sheet = sheetOrFail(layout.tab);
      const values = sheet.getDataRange().getValues().map((r) => r.map(normalizeCell));
      const headerIndex = findHeaderRow(values);
      if (headerIndex === -1) fail(422, `Não achei o cabeçalho (com "Data" e "Valor") na aba ${layout.tab}.`);
      const header = values[headerIndex];
      const { columns, missing } = detectColumns(header, layout);
      if (!missing.length && columns.account === void 0) {
        let last = header.length - 1;
        while (last > 0 && String(header[last] ?? "").trim() === "") last--;
        const target = sheet.getRange(headerIndex + 1, last + 2);
        try {
          sheet.getRange(headerIndex + 1, last + 1).copyTo(target, { formatOnly: true });
        } catch (e) {
        }
        target.setValue("Conta");
        columns.account = last + 1;
      }
      if (missing.length) fail(422, `Faltam colunas na aba ${layout.tab}: ${missing.join(", ")}.`);
      const width = Math.max(...Object.values(columns)) + 1;
      return { sheet, layout, columns, width, firstDataRow: headerIndex + 2, rows: values.slice(headerIndex + 1) };
    }
    function writeRow(sheet, rowNumber, width, row) {
      const range = sheet.getRange(rowNumber, 1, 1, width);
      const formulas = range.getFormulas()[0];
      const current = range.getValues()[0];
      const merged = row.map((v, i) => v === null ? formulas[i] || current[i] : v);
      range.setValues([merged]);
    }
    function prepareRow(input, columns, width) {
      const row = transactionToRow(input, columns, width);
      row[columns.date] = Utilities2.parseDate(input.date, tz(), "yyyy-MM-dd");
      return row;
    }
    function checkRow(type, rowNumber, expected) {
      const tab = readTab(type);
      const current = tab.rows[rowNumber - tab.firstDataRow];
      const parsed = current ? rowToTransaction(current, rowNumber, tab.columns, type).transaction : null;
      const same = parsed && expected && parsed.date === expected.date && parsed.amount === expected.amount && parsed.category === expected.category && parsed.description === (expected.description ?? "");
      if (!same) fail(409, "A planilha foi alterada em outro lugar. Os dados foram recarregados; tente de novo.");
      return tab;
    }
    function withLock(fn) {
      const lock = LockService2.getDocumentLock();
      lock.waitLock(2e4);
      try {
        return fn();
      } finally {
        lock.releaseLock();
      }
    }
    const parseTarget = (type, row) => {
      if (type !== TYPES.INCOME && type !== TYPES.EXPENSE) fail(400, "Tipo inválido.");
      const n = Number(row);
      if (!Number.isInteger(n) || n < 2) fail(400, "Linha inválida.");
      return n;
    };
    function options() {
      const sheet = ss().getSheetByName(CADASTRO_TAB);
      const base = sheet ? parseCadastro(sheet.getDataRange().getValues()) : { incomeCategories: [], groups: {}, cards: [] };
      return { ...base, accounts: readAccounts().map((a) => a.name) };
    }
    function listTransactions() {
      const transactions = [];
      const warnings = [];
      for (const type of [TYPES.INCOME, TYPES.EXPENSE]) {
        const { columns, rows, firstDataRow } = readTab(type);
        rows.forEach((row, i) => {
          const r = rowToTransaction(row, firstDataRow + i, columns, type);
          if (r.transaction) transactions.push(r.transaction);
          else if (r.error) warnings.push(r.error);
        });
      }
      return { transactions, warnings };
    }
    function readValues(name) {
      const sheet = ss().getSheetByName(name);
      return sheet ? sheet.getDataRange().getValues().map((r) => r.map(normalizeCell)) : [];
    }
    const readAccounts = () => parseAccounts(readValues(ACCOUNTS_TAB), parseDate);
    const readBudgets = () => parseBudgets(readValues(BUDGETS_TAB));
    const readTransfers = () => parseTransfers(readValues(TRANSFERS_TAB), parseDate);
    function ensureTab(name, header) {
      let sheet = ss().getSheetByName(name);
      if (!sheet) sheet = ss().insertSheet(name);
      const first = sheet.getRange(1, 1, 1, header.length);
      const current = first.getValues()[0];
      if (current.some((v) => v === "" || v === null)) {
        first.setValues([header.map((h, i) => current[i] === "" || current[i] === null ? h : current[i])]);
        try {
          first.setFontWeight("bold");
          sheet.setFrozenRows(1);
        } catch (e) {
        }
      }
      return sheet;
    }
    function firstEmptyRow(sheet, width) {
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (values[i].slice(0, width).every((v) => v === "" || v === null)) return i + 1;
      }
      return Math.max(values.length, 1) + 1;
    }
    function accountRowOrFail(row, expectedName) {
      const n = Number(row);
      const account = readAccounts().find((a) => a.row === n);
      if (!account || account.name !== expectedName) {
        fail(409, "A aba Contas foi alterada em outro lugar. Os dados foram recarregados; tente de novo.");
      }
      return account;
    }
    function renameAccountEverywhere(oldName, newName) {
      for (const type of [TYPES.INCOME, TYPES.EXPENSE]) {
        const { sheet: sheet2, columns, rows, firstDataRow } = readTab(type);
        rows.forEach((r, i) => {
          if (String(r[columns.account] ?? "").trim() === oldName) sheet2.getRange(firstDataRow + i, columns.account + 1).setValue(newName);
        });
      }
      const sheet = ss().getSheetByName(TRANSFERS_TAB);
      if (!sheet) return;
      sheet.getDataRange().getValues().forEach((r, i) => {
        if (i === 0) return;
        if (String(r[1]).trim() === oldName) sheet.getRange(i + 1, 2).setValue(newName);
        if (String(r[2]).trim() === oldName) sheet.getRange(i + 1, 3).setValue(newName);
      });
    }
    function isAccountUsed(name) {
      if (readTransfers().some((t) => t.from === name || t.to === name)) return true;
      return listTransactions().transactions.some((t) => t.account === name);
    }
    function saveAccount(body, row, expectedName) {
      const accounts = readAccounts();
      const editing = row != null && row !== "";
      const current = editing ? accountRowOrFail(row, expectedName) : null;
      const others = accounts.filter((a) => !current || a.row !== current.row).map((a) => a.name);
      const { value, errors } = validateAccountInput(body, others);
      if (errors) fail(400, errors.join(" "));
      const sheet = ensureTab(ACCOUNTS_TAB, ACCOUNTS_HEADER);
      const rowNumber = current ? current.row : firstEmptyRow(sheet, ACCOUNTS_HEADER.length);
      const range = sheet.getRange(rowNumber, 1, 1, ACCOUNTS_HEADER.length);
      const deadline = value.deadline ? Utilities2.parseDate(value.deadline, tz(), "yyyy-MM-dd") : "";
      range.setValues([[value.name, safeText(value.bank), value.kind, value.initial, value.goal ?? "", deadline]]);
      try {
        sheet.getRange(rowNumber, 4, 1, 2).setNumberFormat("R$ #,##0.00");
        sheet.getRange(rowNumber, 6).setNumberFormat("dd/MM/yyyy");
      } catch (e) {
      }
      if (current && current.name !== value.name) renameAccountEverywhere(current.name, value.name);
      return { ...value, row: rowNumber };
    }
    function removeAccount(row, expectedName) {
      const account = accountRowOrFail(row, expectedName);
      if (isAccountUsed(account.name)) {
        fail(409, `A conta "${account.name}" tem lançamentos ou transferências. Troque a conta deles antes de excluir, ou só renomeie.`);
      }
      const sheet = ss().getSheetByName(ACCOUNTS_TAB);
      sheet.getRange(account.row, 1, 1, ACCOUNTS_HEADER.length).setValues([ACCOUNTS_HEADER.map(() => "")]);
    }
    function saveBudgets(body) {
      const { value, errors } = validateBudgets(body, Object.keys(options().groups));
      if (errors) fail(400, errors.join(" "));
      const sheet = ensureTab(BUDGETS_TAB, BUDGETS_HEADER);
      const old = sheet.getDataRange().getValues().length;
      const rows = Object.entries(value);
      const height = Math.max(old - 1, rows.length);
      if (height > 0) {
        const blank = ["", ""];
        sheet.getRange(2, 1, height, 2).setValues(Array.from({ length: height }, (_, i) => rows[i] ?? blank));
      }
      return value;
    }
    function createTransfer(body) {
      const { value, errors } = validateTransferInput(body, readAccounts().map((a) => a.name));
      if (errors) fail(400, errors.join(" "));
      const sheet = ensureTab(TRANSFERS_TAB, TRANSFERS_HEADER);
      const rowNumber = firstEmptyRow(sheet, 4);
      const [year, month] = value.date.split("-").map(Number);
      sheet.getRange(rowNumber, 1, 1, TRANSFERS_HEADER.length).setValues([[
        Utilities2.parseDate(value.date, tz(), "yyyy-MM-dd"),
        value.from,
        value.to,
        value.amount,
        safeText(value.description),
        MONTH_NAMES[month - 1],
        year
      ]]);
      try {
        sheet.getRange(rowNumber, 1).setNumberFormat("dd/MM/yyyy");
        sheet.getRange(rowNumber, 4).setNumberFormat("R$ #,##0.00");
      } catch (e) {
      }
      return { ...value, row: rowNumber, id: `transferencia-${rowNumber}` };
    }
    function removeTransfer(row, expected) {
      const n = Number(row);
      const current = readTransfers().find((t) => t.row === n);
      const same = current && expected && current.date === expected.date && current.from === expected.from && current.to === expected.to && current.amount === expected.amount;
      if (!same) fail(409, "A aba Transferências foi alterada em outro lugar. Os dados foram recarregados; tente de novo.");
      const sheet = ss().getSheetByName(TRANSFERS_TAB);
      sheet.getRange(n, 1, 1, TRANSFERS_HEADER.length).setValues([TRANSFERS_HEADER.map(() => "")]);
    }
    function validated(body) {
      const { value, errors } = validateTransactionInput(body, options());
      if (errors) fail(400, errors.join(" "));
      return value;
    }
    function create(input) {
      const { sheet, columns, width, rows, firstDataRow } = readTab(input.type);
      const created = [];
      let from = 0;
      for (const item of expandRepeat(input)) {
        let index = rows.findIndex((r, i) => i >= from && rowToTransaction(r, 0, columns, input.type).blank);
        if (index === -1) index = Math.max(rows.length, from);
        from = index + 1;
        const rowNumber = firstDataRow + index;
        writeRow(sheet, rowNumber, width, prepareRow(item, columns, width));
        created.push({ ...item, row: rowNumber, id: `${item.type}-${rowNumber}` });
      }
      return { ...created[0], created: created.length };
    }
    function remove(type, rowNumber, expected) {
      const { sheet, columns, width } = checkRow(type, rowNumber, expected);
      const known = Object.values(columns);
      writeRow(sheet, rowNumber, width, Array.from({ length: width }, (_, i) => known.includes(i) ? "" : null));
    }
    return {
      status: () => ({ mode: "google-apps-script", readOnly: false, demo: false, features: { accounts: true }, spreadsheetTitle: ss().getName() }),
      options,
      list: () => listTransactions(),
      accounts: () => ({ accounts: readAccounts(), transfers: readTransfers(), budgets: readBudgets() }),
      saveBudgets: (body) => withLock(() => saveBudgets(body)),
      saveAccount: (body, row, expectedName) => withLock(() => saveAccount(body, row, expectedName)),
      removeAccount: (row, expectedName) => withLock(() => {
        removeAccount(row, expectedName);
        return null;
      }),
      createTransfer: (body) => withLock(() => createTransfer(body)),
      removeTransfer: (row, expected) => withLock(() => {
        removeTransfer(row, expected);
        return null;
      }),
      create: (body) => withLock(() => create(validated(body))),
      update: (type, row, body, expected) => withLock(() => {
        const rowNumber = parseTarget(type, row);
        const input = validated(body);
        if (input.type !== type) {
          remove(type, rowNumber, expected);
          return create(input);
        }
        const { sheet, columns, width } = checkRow(type, rowNumber, expected);
        writeRow(sheet, rowNumber, width, prepareRow(input, columns, width));
        return { ...input, row: rowNumber, id: `${type}-${rowNumber}` };
      }),
      remove: (type, row, expected) => withLock(() => {
        remove(type, parseTarget(type, row), expected);
        return null;
      })
    };
  }

  // gas/src/entry.js
  var backend = () => (
    // eslint-disable-next-line no-undef
    createGasBackend({ SpreadsheetApp, Utilities, LockService })
  );
  var api = {
    status: () => backend().status(),
    options: () => backend().options(),
    list: () => backend().list(),
    create: (body) => backend().create(body),
    update: (type, row, body, expected) => backend().update(type, row, body, expected),
    remove: (type, row, expected) => backend().remove(type, row, expected),
    accounts: () => backend().accounts(),
    saveBudgets: (body) => backend().saveBudgets(body),
    saveAccount: (body, row, expectedName) => backend().saveAccount(body, row, expectedName),
    removeAccount: (row, expectedName) => backend().removeAccount(row, expectedName),
    createTransfer: (body) => backend().createTransfer(body),
    removeTransfer: (row, expected) => backend().removeTransfer(row, expected)
  };
  return __toCommonJS(entry_exports);
})();
