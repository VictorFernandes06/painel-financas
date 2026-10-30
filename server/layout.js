import { TYPES } from '../shared/categories.js';

/**
 * Como o painel enxerga a planilha "Oxigênio Financeiro".
 * As colunas são achadas pelo nome do cabeçalho (sem acento, sem caixa),
 * então mudar a ordem das colunas na planilha não quebra nada.
 */
export const LAYOUT = {
  [TYPES.INCOME]: {
    tab: 'Receitas',
    fields: {
      date: ['data'],
      category: ['receita', 'fonte', 'origem'],
      amount: ['valor'],
      description: ['observacao', 'observacoes', 'descricao'],
      month: ['mes'],
      year: ['ano'],
      account: ['conta'],
      receivedAt: ['recebido em', 'recebido', 'data do recebimento'],
    },
    required: ['date', 'category', 'amount'],
  },
  [TYPES.EXPENSE]: {
    tab: 'Despesas',
    fields: {
      date: ['data'],
      group: ['grupo'],
      category: ['despesa'],
      nature: ['tipo'],
      payment: ['forma de pagamento', 'pagamento'],
      card: ['cartao'],
      installment: ['parcela'],
      installments: ['total de parcelas', 'parcelas'],
      amount: ['valor'],
      description: ['descricao', 'detalhes'],
      status: ['status', 'situacao'],
      month: ['mes'],
      year: ['ano'],
      account: ['conta'],
    },
    required: ['date', 'group', 'category', 'amount'],
  },
};

export const CADASTRO_TAB = 'Cadastro';
