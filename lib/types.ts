// ═══════════════════════════════════════════
// TIPOS PRINCIPAIS — GadoControl
// ═══════════════════════════════════════════

export type AnimalStatus = 'Vivo' | 'Vendido' | 'Morto';
export type AnimalCategoria =
  | 'Bezerro'
  | 'Bezerra'
  | 'Desmamado'
  | 'Novilho'
  | 'Novilha'
  | 'Matriz'
  | 'Touro'
  | 'Boi';
export type AnimalSexo = 'Macho' | 'Fêmea' | 'Misto';
export type AnimalTipo = 'individual' | 'grupo';
export type StatusReprodutivo = 'Vazia' | 'Prenhe' | 'Parida';

export interface Animal {
  id: string;
  brinco: string;
  tipo: AnimalTipo;
  nomeGrupo?: string;
  qtdCabecas?: number;
  cabecas?: number;
  categoria: AnimalCategoria;
  sexo?: AnimalSexo;
  raca?: string;
  dataNascimento?: string;
  pesoAtual?: number;
  pesoMedio?: number;
  status: AnimalStatus;
  statusReprodutivo?: StatusReprodutivo;
  dataPrevistoParto?: string;
  dataUltimoParto?: string;
  numeroParto?: number;
  dataVenda?: string;
  precoVenda?: number;
  // Compra
  comprado?: boolean;
  precoCompra?: number;
  dataCompra?: string;
  origemCompra?: string;
  dataDesmame?: string;
  mae?: string;
  pai?: string;
  loteId?: string;
  observacao?: string;
  foto?: string;
  fotoDocumento?: string;
  sisbov?: string;
  gta?: string;
  eccAtual?: number;
  marcaFogo?: string;
  corteOrelha?: string;
  ultimoBanho?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventoTipo =
  | 'Nascimento'
  | 'Desmame'
  | 'Pesagem'
  | 'Venda'
  | 'Morte'
  | 'Tratamento'
  | 'Vacina Clostridioses'
  | 'Vacina Febre Aftosa'
  | 'Vacina Brucelose'
  | 'Vacina Raiva'
  | 'Vacina – Outro'
  | 'Vermífugo'
  | 'Inseminação Artificial'
  | 'Cobertura Natural'
  | 'IATF — D0 (Início Protocolo)'
  | 'IATF — D8 (Prostaglandina)'
  | 'IATF — D17 (Retirada + EB)'
  | 'IATF — Inseminação'
  | 'Diagnóstico de Gestação'
  | 'ECC — Avaliação'
  | 'Banho Carrapaticida'
  | 'Suplementação Mineral'
  | 'Custo / Despesa';

export interface Evento {
  id: string;
  brincoAnimal: string;
  tipo: EventoTipo;
  data: string;
  detalhes?: string;
  peso?: number;
  preco?: number;
  touroDoador?: string;
  foto?: string;
  // Custo / Despesa
  custoCat?: string;
  custoCab?: number;
  // ECC
  ecc?: number;
  // Diagnóstico de Gestação
  diagResult?: string;
  diagMetodo?: string;
  diagDias?: number;
  // Banho Carrapaticida
  carrapProd?: string;
  carrapPA?: string;
  carrapLote?: string;
  // Suplementação Mineral
  suplProd?: string;
  suplCons?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Lancamento {
  id: string;
  tipo: 'receita' | 'despesa';
  cat: string;
  descricao: string;
  valor: number;
  data: string;
  obs?: string;
  createdAt: string;
}

export interface Lote {
  id: string;
  nome: string;
  descricao?: string;
  pastoId?: string;
  createdAt: string;
}

export interface Pasto {
  id: string;
  nome: string;
  areaHa: number;
  forrageira?: string;   // Braquiária, Tifton 85, Mombaça, etc.
  capacidadeUA?: number; // UA/ha máxima configurada pelo produtor
  obs?: string;
  createdAt: string;
}

export type EstoqueCategoria =
  | 'Vacina'
  | 'Medicamento'
  | 'Vermífugo'
  | 'Carrapaticida'
  | 'Suplemento Mineral'
  | 'Ração / Sal'
  | 'Equipamento'
  | 'Outro';

export type EstoqueUnidade = 'kg' | 'L' | 'ml' | 'doses' | 'un.' | 'sacos';

export interface EstoqueItem {
  id: string;
  nome: string;
  categoria: EstoqueCategoria;
  unidade: EstoqueUnidade;
  quantidade: number;
  quantidadeMinima?: number;
  dataValidade?: string;
  lote?: string;
  fornecedor?: string;
  precoUnitario?: number;
  obs?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Meta {
  pesoAlvoVenda?: number;
  precoArroba?: number;
  firstUseDate?: string;
  lastBackup?: string;
  onboardingDone?: boolean;
  demoLoaded?: boolean;
  updatedAt?: string;   // ISO — usado para resolução de conflito no sync
  syncedAt?: string;    // ISO — última sincronização bem-sucedida com Firestore
  // Fazenda
  fazNome?: string;
  fazProprietario?: string;
  fazMunicipio?: string;
  fazEstado?: string;
  fazCAR?: string;
  fazAreaHa?: number;
  fazIE?: string; // Inscrição Estadual
}

export interface ProtocoloSanitario {
  id: string;
  nome: string;
  tipo: EventoTipo;
  intervaloDias: number;
  categorias: AnimalCategoria[];
  ativo: boolean;
  createdAt: string;
}

export interface DB {
  animais: Animal[];
  eventos: Evento[];
  lancamentos: Lancamento[];
  lotes: Lote[];
  pastos: Pasto[];
  estoque: EstoqueItem[];
  protocolos: ProtocoloSanitario[];
  estacoesMonta: EstacaoMonta[];
  meta: Meta;
}

export interface EstacaoMonta {
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  touros: string[];        // IDs or brincos
  matrizesIds: string[];   // IDs
  obs?: string;
  createdAt: string;
}

export type UserPlan = 'free' | 'pro';

export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  plan: UserPlan;
  inTrial: boolean;
  trialDaysLeft: number;
  createdAt?: string;
}

// Constantes
export const PLAN_LIMIT_FREE = 30;
export const BETA_TRIAL_DAYS = 60;
export const GESTACAO_DIAS = 285;
export const ARROBA_KG = 15;

export const CAT_ICON: Record<string, string> = {
  Bezerro: '🐮',
  Bezerra: '🐮',
  Desmamado: '🐄',
  Novilho: '🐂',
  Novilha: '🐄',
  Matriz: '🐄',
  Touro: '🐂',
  Boi: '🐂',
};

export const TIPO_CAT_DESPESA: Record<string, string> = {
  'Vacina Clostridioses': 'Sanidade (vacinas)',
  'Vacina Febre Aftosa': 'Sanidade (vacinas)',
  'Vacina Brucelose': 'Sanidade (vacinas)',
  'Vacina Raiva': 'Sanidade (vacinas)',
  'Vacina – Outro': 'Sanidade (vacinas)',
  'Vermífugo': 'Sanidade (vermífugo)',
  'Inseminação Artificial': 'Reprodução (IATF)',
  'Cobertura Natural': 'Reprodução (monta natural)',
  'IATF — D0 (Início Protocolo)': 'Reprodução (IATF)',
  'IATF — D8 (Prostaglandina)': 'Reprodução (IATF)',
  'IATF — D17 (Retirada + EB)': 'Reprodução (IATF)',
  'IATF — Inseminação': 'Reprodução (IATF)',
  'Banho Carrapaticida': 'Sanidade (carrapaticida)',
  'Suplementação Mineral': 'Nutrição (suplemento)',
  'Tratamento': 'Sanidade (tratamento)',
};
