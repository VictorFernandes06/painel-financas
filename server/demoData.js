import { MONTH_NAMES } from '../shared/categories.js';
import { toSerial } from './mapping.js';

// Listas no formato da aba Cadastro (linha 1 = nome da lista).
const CADASTRO = {
  Cartão: ['Nubank', 'Inter', 'BB'],
  Receitas: ['Salário', '13º Salário', 'Freelance', 'Extras', 'Reembolso', 'Outros'],
  Grupo: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Pessoais', 'Educação', 'Financeiras', 'Outras'],
  Moradia: ['Aluguel', 'Energia', 'Água', 'Internet', 'Condomínio'],
  Alimentação: ['Mercado', 'Feira', 'Restaurantes', 'Padaria'],
  Transporte: ['Combustível', 'Transporte por App', 'Manutenção'],
  Saúde: ['Farmácia', 'Plano de Saúde / Odontológico'],
  Lazer: ['Cinema / Teatro / Show', 'Viagens', 'Restaurantes / Lanchonetes'],
  Pessoais: ['Vestuário / Calçados', 'Cuidados pessoais', 'Compras diversas'],
  Educação: ['Cursos complementares', 'Livros'],
  Financeiras: ['Tarifas bancárias', 'Juros'],
  Outras: ['Doações', 'Outros - Outras despesas'],
};

function cadastroRows() {
  const names = Object.keys(CADASTRO);
  const height = Math.max(...Object.values(CADASTRO).map((l) => l.length));
  const rows = [names];
  for (let i = 0; i < height; i++) rows.push(names.map((n) => CADASTRO[n][i] ?? ''));
  return rows;
}

const pad = (n) => String(n).padStart(2, '0');
const VARIATION = [1, 0.92, 1.08, 0.97, 1.12, 0.95];

/** Abas Cadastro, Receitas e Despesas com 6 meses de exemplo. */
export function createDemoTabs(today = new Date()) {
  const receitas = [['RECEITAS'], ['Data', 'Receita', 'Valor', 'Observação', 'Mês', 'Ano', 'Conta', 'Recebido em']];
  const despesas = [
    ['DESPESAS'],
    ['Data', 'Grupo', 'Despesa', 'Tipo', 'Forma de pagamento', 'Cartão', 'Parcela', 'Total de parcelas', 'Valor', 'Descrição', 'Status', 'Mês', 'Ano'],
  ];
  const EXPENSES = [
    [10, 'Moradia', 'Aluguel', 'Essencial', 'Pix', '', 1800, ''],
    [12, 'Moradia', 'Energia', 'Essencial', 'Pix', '', 220, ''],
    [7, 'Alimentação', 'Mercado', 'Essencial', 'Cartão', 'Nubank', 850, ''],
    [21, 'Alimentação', 'Restaurantes', 'Não Essencial', 'Cartão', 'Nubank', 380, 'Delivery'],
    [9, 'Transporte', 'Combustível', 'Essencial', 'Débito', '', 400, ''],
    [15, 'Lazer', 'Cinema / Teatro / Show', 'Não Essencial', 'Pix', '', 160, ''],
    [20, 'Saúde', 'Farmácia', 'Essencial', 'Débito', '', 140, ''],
  ];

  for (let offset = 5; offset >= 0; offset--) {
    const month = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const y = month.getFullYear();
    const m = month.getMonth() + 1;
    const serial = (day) => toSerial(`${y}-${pad(m)}-${pad(day)}`);
    const monthName = MONTH_NAMES[m - 1];
    const isFuture = (day) => offset === 0 && day > today.getDate();

    if (!isFuture(5)) receitas.push([serial(5), 'Salário', 6500, '', monthName, y]);
    if (offset % 2 === 0 && !isFuture(18)) receitas.push([serial(18), 'Freelance', 1200, 'Projeto', monthName, y]);

    for (const [day, group, item, nature, payment, card, base, desc] of EXPENSES) {
      if (isFuture(day)) continue;
      const status = offset === 0 && day > today.getDate() - 3 ? 'A Pagar' : 'Pago';
      despesas.push([serial(day), group, item, nature, payment, card, 1, 1, Math.round(base * VARIATION[offset]), desc, status, monthName, y]);
    }
  }
  return { Cadastro: cadastroRows(), Receitas: receitas, Despesas: despesas };
}
