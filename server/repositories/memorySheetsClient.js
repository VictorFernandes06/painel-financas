/**
 * Imitação em memória da API do Google Sheets (só o que o painel usa).
 * Serve para o modo demonstração (sem credenciais) e para os testes:
 * assim o mesmo GoogleSheetsRepository roda nos dois casos.
 */
export class MemorySheetsClient {
  /** tabs: { 'Receitas': [[...linha1], [...]], ... } */
  constructor({ title = 'Planilha de demonstração', tabs = {} } = {}) {
    this.title = title;
    this.tabs = Object.fromEntries(Object.entries(tabs).map(([k, rows]) => [k, rows.map((r) => [...r])]));
    this.calls = [];

    const parse = (range) => {
      const m = range.match(/^'((?:[^']|'')+)'(?:!\$?[A-Z]+\$?(\d+))?/);
      return { tab: m[1].replace(/''/g, "'"), row: m[2] ? Number(m[2]) : null };
    };

    this.spreadsheets = {
      get: async () => ({
        data: {
          properties: { title: this.title },
          sheets: Object.keys(this.tabs).map((t, i) => ({ properties: { sheetId: i, title: t } })),
        },
      }),
      values: {
        get: async ({ range }) => {
          const { tab } = parse(range);
          if (!this.tabs[tab]) throw Object.assign(new Error('Unable to parse range'), { code: 400 });
          return { data: { values: this.tabs[tab].map((r) => [...r]) } };
        },
        update: async ({ range, requestBody }) => {
          this.calls.push(['update', range, requestBody.values]);
          const { tab, row } = parse(range);
          const rows = this.tabs[tab];
          requestBody.values.forEach((values, i) => {
            const target = row - 1 + i;
            while (rows.length <= target) rows.push([]);
            values.forEach((v, j) => {
              if (v === null) return;
              rows[target][j] = this.coerce(v);
            });
          });
          return { data: {} };
        },
      },
    };
  }

  // Imita o USER_ENTERED: "'texto" vira texto.
  coerce(value) {
    if (typeof value === 'string' && value.startsWith("'")) return value.slice(1);
    return value;
  }
}
