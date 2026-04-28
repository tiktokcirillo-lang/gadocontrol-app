'use client';
import type { DB } from './types';
import { uid, today } from './db';

function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function diasFrente(n: number): string {
  return diasAtras(-n);
}
const now = () => new Date().toISOString();

export function gerarDemoDB(): DB {
  const lote1 = uid();
  const lote2 = uid();

  // ── Animais ────────────────────────────────────────────────────────────────
  const a1  = uid(); // Brinco 1001 — Matriz
  const a2  = uid(); // Brinco 1002 — Matriz
  const a3  = uid(); // Brinco 1003 — Touro
  const a4  = uid(); // Brinco 1004 — Bezerro
  const a5  = uid(); // Brinco 1005 — Bezerro
  const a6  = uid(); // Brinco 1006 — Novilha
  const a7  = uid(); // Brinco 1007 — Novilha
  const a8  = uid(); // Brinco 1008 — Novilho
  const a9  = uid(); // Grupo Bois — Terminação
  const a10 = uid(); // Brinco 1010 — Vendido

  const animais = [
    {
      id: a1, brinco: '1001', tipo: 'individual' as const, categoria: 'Matriz' as const, sexo: 'Fêmea' as const,
      raca: 'Nelore', dataNascimento: diasAtras(1460), pesoAtual: 480, status: 'Vivo' as const,
      statusReprodutivo: 'Prenhe' as const, dataPrevistoParto: diasFrente(42),
      numeroParto: 3, loteId: lote1, createdAt: now(), updatedAt: now(),
    },
    {
      id: a2, brinco: '1002', tipo: 'individual' as const, categoria: 'Matriz' as const, sexo: 'Fêmea' as const,
      raca: 'Nelore', dataNascimento: diasAtras(1825), pesoAtual: 510, status: 'Vivo' as const,
      statusReprodutivo: 'Parida' as const, dataUltimoParto: diasAtras(35),
      numeroParto: 4, loteId: lote1, createdAt: now(), updatedAt: now(),
    },
    {
      id: a3, brinco: '1003', tipo: 'individual' as const, categoria: 'Touro' as const, sexo: 'Macho' as const,
      raca: 'Nelore', dataNascimento: diasAtras(1095), pesoAtual: 820, status: 'Vivo' as const,
      loteId: lote1, createdAt: now(), updatedAt: now(),
    },
    {
      id: a4, brinco: '1004', tipo: 'individual' as const, categoria: 'Bezerro' as const, sexo: 'Macho' as const,
      raca: 'Nelore', dataNascimento: diasAtras(65), pesoAtual: 75, status: 'Vivo' as const,
      mae: '1001', loteId: lote1, createdAt: now(), updatedAt: now(),
    },
    {
      id: a5, brinco: '1005', tipo: 'individual' as const, categoria: 'Bezerra' as const, sexo: 'Fêmea' as const,
      raca: 'Nelore', dataNascimento: diasAtras(35), pesoAtual: 48, status: 'Vivo' as const,
      mae: '1002', loteId: lote1, createdAt: now(), updatedAt: now(),
    },
    {
      id: a6, brinco: '1006', tipo: 'individual' as const, categoria: 'Novilha' as const, sexo: 'Fêmea' as const,
      raca: 'Nelore x Angus', dataNascimento: diasAtras(548), pesoAtual: 310, status: 'Vivo' as const,
      loteId: lote2, createdAt: now(), updatedAt: now(),
    },
    {
      id: a7, brinco: '1007', tipo: 'individual' as const, categoria: 'Novilha' as const, sexo: 'Fêmea' as const,
      raca: 'Nelore x Angus', dataNascimento: diasAtras(520), pesoAtual: 295, status: 'Vivo' as const,
      loteId: lote2, createdAt: now(), updatedAt: now(),
    },
    {
      id: a8, brinco: '1008', tipo: 'individual' as const, categoria: 'Novilho' as const, sexo: 'Macho' as const,
      raca: 'Nelore', dataNascimento: diasAtras(400), pesoAtual: 340, status: 'Vivo' as const,
      loteId: lote2, createdAt: now(), updatedAt: now(),
    },
    {
      id: a9, brinco: 'G001', tipo: 'grupo' as const, nomeGrupo: 'Lote Terminação', qtdCabecas: 25,
      categoria: 'Boi' as const, raca: 'Nelore', pesoMedio: 420, status: 'Vivo' as const,
      loteId: lote2, createdAt: now(), updatedAt: now(),
    },
    {
      id: a10, brinco: '0999', tipo: 'individual' as const, categoria: 'Novilho' as const, sexo: 'Macho' as const,
      raca: 'Nelore', dataNascimento: diasAtras(730), pesoAtual: 450, status: 'Vendido' as const,
      dataVenda: diasAtras(15), precoVenda: 5850, createdAt: now(), updatedAt: now(),
    },
  ];

  // ── Eventos ────────────────────────────────────────────────────────────────
  const eventos = [
    // Pesagens
    { id: uid(), brincoAnimal: '1001', tipo: 'Pesagem' as const, data: diasAtras(90), peso: 455, createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1001', tipo: 'Pesagem' as const, data: diasAtras(30), peso: 478, createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1008', tipo: 'Pesagem' as const, data: diasAtras(60), peso: 290, createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1008', tipo: 'Pesagem' as const, data: diasAtras(10), peso: 340, createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: 'G001', tipo: 'Pesagem' as const, data: diasAtras(30), peso: 390, createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: 'G001', tipo: 'Pesagem' as const, data: today(), peso: 420, createdAt: now(), updatedAt: now() },
    // Nascimentos
    { id: uid(), brincoAnimal: '1004', tipo: 'Nascimento' as const, data: diasAtras(65), peso: 32, detalhes: 'Bezerro sadio, parto normal', createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1005', tipo: 'Nascimento' as const, data: diasAtras(35), peso: 28, detalhes: 'Bezerra sadia', createdAt: now(), updatedAt: now() },
    // Vacinas
    { id: uid(), brincoAnimal: '1001', tipo: 'Vacina Febre Aftosa' as const, data: diasAtras(45), detalhes: 'Campanha estadual', createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1002', tipo: 'Vacina Febre Aftosa' as const, data: diasAtras(45), detalhes: 'Campanha estadual', createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1003', tipo: 'Vacina Febre Aftosa' as const, data: diasAtras(45), createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: 'G001', tipo: 'Vacina Febre Aftosa' as const, data: diasAtras(45), createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1001', tipo: 'Vacina Clostridioses' as const, data: diasAtras(120), createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1002', tipo: 'Vacina Clostridioses' as const, data: diasAtras(120), createdAt: now(), updatedAt: now() },
    // Vermífugo
    { id: uid(), brincoAnimal: '1001', tipo: 'Vermífugo' as const, data: diasAtras(95), detalhes: 'Ivermectina 1%', createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1002', tipo: 'Vermífugo' as const, data: diasAtras(95), createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1008', tipo: 'Vermífugo' as const, data: diasAtras(95), createdAt: now(), updatedAt: now() },
    // Banho
    { id: uid(), brincoAnimal: '1001', tipo: 'Banho Carrapaticida' as const, data: diasAtras(25), carrapProd: 'Cypermix', createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1002', tipo: 'Banho Carrapaticida' as const, data: diasAtras(25), carrapProd: 'Cypermix', createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: 'G001', tipo: 'Banho Carrapaticida' as const, data: diasAtras(25), createdAt: now(), updatedAt: now() },
    // IATF
    { id: uid(), brincoAnimal: '1006', tipo: 'IATF — D0 (Início Protocolo)' as const, data: diasAtras(19), createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1006', tipo: 'IATF — D8 (Prostaglandina)' as const, data: diasAtras(11), createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1007', tipo: 'IATF — D0 (Início Protocolo)' as const, data: diasAtras(19), createdAt: now(), updatedAt: now() },
    { id: uid(), brincoAnimal: '1007', tipo: 'IATF — D8 (Prostaglandina)' as const, data: diasAtras(11), createdAt: now(), updatedAt: now() },
    // Venda
    { id: uid(), brincoAnimal: '0999', tipo: 'Venda' as const, data: diasAtras(15), peso: 450, preco: 5850, detalhes: 'Vendido na feira', createdAt: now(), updatedAt: now() },
    // Tratamento
    { id: uid(), brincoAnimal: '1004', tipo: 'Tratamento' as const, data: diasAtras(10), detalhes: 'Diarreia neonatal — Enrofloxacino 3 dias', createdAt: now(), updatedAt: now() },
  ];

  // ── Lançamentos ────────────────────────────────────────────────────────────
  const lancamentos = [
    { id: uid(), tipo: 'receita' as const, cat: 'Venda de animais', descricao: 'Venda novilho brinco 0999', valor: 5850, data: diasAtras(15), createdAt: now() },
    { id: uid(), tipo: 'receita' as const, cat: 'Venda de leite', descricao: 'Leite — março', valor: 1200, data: diasAtras(28), createdAt: now() },
    { id: uid(), tipo: 'despesa' as const, cat: 'Sanidade', descricao: 'Vacinas aftosa lote', valor: 320, data: diasAtras(45), createdAt: now() },
    { id: uid(), tipo: 'despesa' as const, cat: 'Sanidade', descricao: 'Ivermectina + carrapaticida', valor: 480, data: diasAtras(95), createdAt: now() },
    { id: uid(), tipo: 'despesa' as const, cat: 'Alimentação', descricao: 'Sal mineral 10 sacos', valor: 650, data: diasAtras(60), createdAt: now() },
    { id: uid(), tipo: 'despesa' as const, cat: 'Mão de obra', descricao: 'Funcionários — março', valor: 2800, data: diasAtras(28), createdAt: now() },
    { id: uid(), tipo: 'despesa' as const, cat: 'Manutenção', descricao: 'Cerca elétrica — reparo', valor: 340, data: diasAtras(20), createdAt: now() },
    { id: uid(), tipo: 'receita' as const, cat: 'Outros', descricao: 'Venda de esterco', valor: 180, data: diasAtras(50), createdAt: now() },
    { id: uid(), tipo: 'despesa' as const, cat: 'Combustível', descricao: 'Diesel — trator', valor: 520, data: diasAtras(14), createdAt: now() },
    { id: uid(), tipo: 'despesa' as const, cat: 'Reprodução', descricao: 'Sêmen + nitrogênio IATF', valor: 890, data: diasAtras(22), createdAt: now() },
  ];

  // ── Lotes ──────────────────────────────────────────────────────────────────
  const lotes = [
    { id: lote1, nome: 'Matrizes e Reprodução', descricao: 'Vacas, touro e bezerros', createdAt: now() },
    { id: lote2, nome: 'Recria e Terminação', descricao: 'Novilhas, novilhos e bois', createdAt: now() },
  ];

  // ── Estoque ────────────────────────────────────────────────────────────────
  const estoque = [
    {
      id: uid(), nome: 'Ivermectina 1%', categoria: 'Vermífugo' as const, unidade: 'L' as const,
      quantidade: 2.5, quantidadeMinima: 1, dataValidade: diasFrente(180),
      fornecedor: 'Agropecuária Central', precoUnitario: 45, createdAt: now(), updatedAt: now(),
    },
    {
      id: uid(), nome: 'Vacina Aftosa', categoria: 'Vacina' as const, unidade: 'doses' as const,
      quantidade: 50, quantidadeMinima: 20, dataValidade: diasFrente(90),
      fornecedor: 'Boehringer', precoUnitario: 3.5, createdAt: now(), updatedAt: now(),
    },
    {
      id: uid(), nome: 'Cypermix Carrapaticida', categoria: 'Carrapaticida' as const, unidade: 'L' as const,
      quantidade: 3, quantidadeMinima: 2, dataValidade: diasFrente(365),
      precoUnitario: 28, createdAt: now(), updatedAt: now(),
    },
    {
      id: uid(), nome: 'Sal Mineral Bovino', categoria: 'Suplemento Mineral' as const, unidade: 'sacos' as const,
      quantidade: 8, quantidadeMinima: 5, fornecedor: 'Tortuga', precoUnitario: 65,
      createdAt: now(), updatedAt: now(),
    },
    {
      id: uid(), nome: 'Enrofloxacino 10%', categoria: 'Medicamento' as const, unidade: 'ml' as const,
      quantidade: 100, quantidadeMinima: 50, dataValidade: diasFrente(240),
      precoUnitario: 0.18, createdAt: now(), updatedAt: now(),
    },
    {
      id: uid(), nome: 'Oxitocina', categoria: 'Medicamento' as const, unidade: 'ml' as const,
      quantidade: 30, quantidadeMinima: 50, dataValidade: diasFrente(120),
      detalhes: 'Abaixo do estoque mínimo!', precoUnitario: 0.25,
      obs: 'Repor urgente', createdAt: now(), updatedAt: now(),
    },
  ];

  // ── Protocolos Sanitários ─────────────────────────────────────────────────
  const protocolos = [
    {
      id: uid(), nome: 'Vermifugação Geral', tipo: 'Vermífugo' as const, intervaloDias: 90,
      categorias: ['Bezerro', 'Bezerra', 'Desmamado', 'Novilho', 'Novilha', 'Matriz', 'Touro', 'Boi'] as const,
      ativo: true, createdAt: now(),
    },
    {
      id: uid(), nome: 'Banho Carrapaticida', tipo: 'Banho Carrapaticida' as const, intervaloDias: 30,
      categorias: ['Matriz', 'Touro', 'Novilho', 'Novilha', 'Boi'] as const,
      ativo: true, createdAt: now(),
    },
    {
      id: uid(), nome: 'Vacina Febre Aftosa', tipo: 'Vacina Febre Aftosa' as const, intervaloDias: 180,
      categorias: ['Bezerro', 'Bezerra', 'Desmamado', 'Novilho', 'Novilha', 'Matriz', 'Touro', 'Boi'] as const,
      ativo: true, createdAt: now(),
    },
    {
      id: uid(), nome: 'Clostridioses — Reforço', tipo: 'Vacina Clostridioses' as const, intervaloDias: 365,
      categorias: ['Matriz', 'Touro', 'Novilha', 'Novilho'] as const,
      ativo: true, createdAt: now(),
    },
  ];

  // ── Meta ───────────────────────────────────────────────────────────────────
  const meta = {
    fazNome: 'Fazenda Demo — Santa Cruz',
    fazProprietario: 'João da Silva',
    fazMunicipio: 'Goiânia',
    fazEstado: 'GO',
    fazAreaHa: 350,
    pesoAlvoVenda: 450,
    precoArroba: 315,
    firstUseDate: diasAtras(180),
    demoLoaded: true,
  };

  return { animais, eventos, lancamentos, lotes, estoque, protocolos, meta } as unknown as DB;
}
