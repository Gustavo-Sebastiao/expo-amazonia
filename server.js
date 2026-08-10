import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { enviarIngressoPorEmail } from './emailService.js';

// Carrega variáveis do arquivo .env.local se existir, senão carrega do .env
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

const app = express();
app.use(express.json());

// Servir arquivos estáticos do site (index.html, styles.css, script.js)
app.use(express.static(path.resolve('.')));

// Habilita CORS básico para requisições do navegador
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Configuração do Supabase Administrativo no Servidor
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY; // Chave sb_secret_...

let supabaseAdmin = null;
if (SUPABASE_URL && SUPABASE_SECRET_KEY && !SUPABASE_URL.includes('seu-projeto')) {
  try {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  } catch (e) {
    console.warn('⚠️ Erro ao inicializar cliente Supabase:', e.message);
  }
} else {
  console.warn('⚠️ AVISO: SUPABASE_URL ou SUPABASE_SECRET_KEY ainda não preenchidos. O servidor rodará em modo local para testes de e-mail.');
}

/**
 * ------------------------------------------------------------------
 * 1. ROTA DE VALIDAÇÃO DO FISCAL (POST /api/ingressos/validar)
 * ------------------------------------------------------------------
 * Consumido pelo aplicativo/scanner do fiscal na entrada do evento.
 */
app.post('/api/ingressos/validar', async (req, res) => {
  try {
    const { codigo_validacao } = req.body;

    if (!codigo_validacao) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O campo codigo_validacao é obrigatório.'
      });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({
        sucesso: false,
        mensagem: 'Servidor Supabase não configurado no .env.local (SUPABASE_URL e SUPABASE_SECRET_KEY necessárias).'
      });
    }

    // Executa a função PL/pgSQL atômica com SELECT ... FOR UPDATE no PostgreSQL
    const { data: resultado, error } = await supabaseAdmin.rpc('validar_ingresso_atomico', {
      p_codigo_validacao: codigo_validacao
    });

    if (error) {
      console.error('Erro na RPC de validação:', error.message);
      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro interno ao processar a validação do ingresso.'
      });
    }

    // Retorna a resposta com o código HTTP adequado (200, 400 ou 404)
    return res.status(resultado.status_code).json(resultado);

  } catch (err) {
    console.error('Exceção na validação:', err.message);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno no servidor.'
    });
  }
});

/**
 * ------------------------------------------------------------------
 * 2. GERAÇÃO DE INGRESSO E ENVIO DE E-MAIL PÓS-PAGAMENTO
 * ------------------------------------------------------------------
 */
app.post('/api/ingressos/gerar', async (req, res) => {
  try {
    const { reserva_id, evento_id } = req.body;

    if (!reserva_id) {
      return res.status(400).json({ sucesso: false, mensagem: 'reserva_id é obrigatório.' });
    }

    // Busca os dados da reserva para preencher o e-mail
    const { data: reserva, error: reservaError } = await supabaseAdmin
      .from('reservas')
      .select('*')
      .eq('id', reserva_id)
      .single();

    if (reservaError || !reserva) {
      return res.status(404).json({ sucesso: false, mensagem: 'Reserva não encontrada.' });
    }

    const codigoValidacao = uuidv4();

    // Insere o ingresso no banco
    const { data: ingresso, error: ingressoError } = await supabaseAdmin
      .from('ingressos')
      .insert([{
        codigo_validacao: codigoValidacao,
        usuario_id: reserva_id,
        evento_id: evento_id || 'expo-amazonia-2026',
        status: 'valido'
      }])
      .select('id, codigo_validacao, status')
      .single();

    if (ingressoError) {
      return res.status(500).json({ sucesso: false, mensagem: ingressoError.message });
    }

    // Dispara o e-mail de forma assíncrona (não trava a resposta)
    enviarIngressoPorEmail({
      nome: reserva.nome,
      cpf: reserva.cpf,
      email: reserva.email,
      dataViagem: new Date(reserva.data_viagem).toLocaleDateString('pt-BR'),
      horarioSaida: reserva.horario_saida,
      valorTotal: parseFloat(reserva.valor_total),
      formaPagamento: reserva.forma_pagamento,
      codigoReserva: reserva.codigo_reserva,
      codigoValidacao: codigoValidacao
    });

    return res.json({
      sucesso: true,
      ingressoId: ingresso.id,
      codigoValidacao: ingresso.codigo_validacao,
      status: ingresso.status,
      mensagem: 'Ingresso gerado e e-mail enviado com sucesso.'
    });

  } catch (err) {
    return res.status(500).json({ sucesso: false, mensagem: err.message });
  }
});

/**
 * ------------------------------------------------------------------
 * 3. ROTA MANUAL DE DISPARO DE E-MAIL (POST /api/ingressos/enviar-email)
 * ------------------------------------------------------------------
 */
app.post('/api/ingressos/enviar-email', async (req, res) => {
  try {
    const dadosCompra = req.body;
    const resultado = await enviarIngressoPorEmail(dadosCompra);
    return res.status(resultado.sucesso ? 200 : 500).json(resultado);
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Back-end de Validação e E-mails rodando na porta ${PORT}`);
});
