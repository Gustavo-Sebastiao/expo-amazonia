import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { enviarIngressoPorEmail } from './emailService.js';
import {
  mascararCPF,
  mascararCartao,
  validarCPF,
  validarCartaoLuhn,
  sanitizarObjeto,
  safeLogger,
  criptografarTexto,
  descriptografarTexto
} from './securityUtils.js';

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

// ------------------------------------------------------------------
// SEGURANÇA DEFENSIVA: RATE LIMITING (LIMITAÇÃO DE REQUISIÇÕES)
// ------------------------------------------------------------------

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    sucesso: false,
    mensagem: 'Muitas requisições originadas deste IP. Por favor, tente novamente mais tarde.'
  }
});

const ingressosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    sucesso: false,
    mensagem: 'Limite de envio de ingressos/e-mails atingido para este IP. Aguarde 15 minutos.'
  }
});

app.use('/api/', apiLimiter);
app.use('/api/ingressos/', ingressosLimiter);

// ------------------------------------------------------------------
// SEGURANÇA DEFENSIVA: SCHEMAS DE VALIDAÇÃO ESTRITA COM ZOD
// ------------------------------------------------------------------

// Schema para validação do ingresso pelo fiscal
const validarIngressoSchema = z.object({
  codigo_validacao: z.string({
    required_error: 'O campo codigo_validacao é obrigatório.'
  }).min(1, 'O campo codigo_validacao não pode ser vazio.').max(100, 'Código de validação inválido.')
});

// Schema para geração de ingresso pós-reserva
const gerarIngressoSchema = z.object({
  reserva_id: z.string({
    required_error: 'reserva_id é obrigatório.'
  }).min(1, 'reserva_id não pode ser vazio.').max(100),
  evento_id: z.string().max(100).optional().default('expo-amazonia-2026')
});

// Schema para disparo de e-mail com Validação Matemática Rígida de CPF
const enviarEmailSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório.').max(150),
  cpf: z.string({ required_error: 'CPF é obrigatório.' })
    .refine(validarCPF, { message: 'CPF inválido ou inexistente. Verifique o número digitado.' }),
  email: z.string().email('Endereço de e-mail inválido.'),
  dataViagem: z.string().min(1, 'Data da viagem é obrigatória.'),
  horarioSaida: z.string().optional(),
  valorTotal: z.number({ invalid_type_error: 'valorTotal deve ser um número.' }).nonnegative('valorTotal deve ser positivo.'),
  formaPagamento: z.string().min(1, 'Forma de pagamento é obrigatória.'),
  codigoReserva: z.string().min(1, 'Código da reserva é obrigatório.'),
  codigoValidacao: z.string().min(1, 'Código de validação é obrigatório.')
});

// Schema para Processamento de Pagamento com Validação Luhn e Padrão PCI-DSS (Tokenização)
const pagamentoTokenizadoSchema = z.object({
  nomeTitular: z.string().min(1, 'Nome do titular é obrigatório.').max(150),
  cpf: z.string().refine(validarCPF, { message: 'CPF do titular é inválido.' }),
  // Em conformidade com o PCI-DSS, o backend deve preferencialmente receber um Token do Gateway
  tokenCartao: z.string().optional(),
  // Caso venha o número do cartão para validação direta, valida obrigatoriamente com o Algoritmo de Luhn
  numeroCartao: z.string().optional().refine(num => !num || validarCartaoLuhn(num), {
    message: 'Número de cartão de crédito inválido (Falha na verificação de Luhn).'
  }),
  valor: z.number().positive('O valor deve ser positivo.')
});

// Middleware auxiliar reutilizável de validação Zod
function validarSchema(schema) {
  return (req, res, next) => {
    // Registra o log da requisição recebida de forma sanitizada
    safeLogger.info(`[REQUISIÇÃO] ${req.method} ${req.path}`, req.body);

    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues || result.error.errors || [];
      const errosDetalhados = issues.map(err => err.message);
      safeLogger.warn(`[VALIDAÇÃO ZOD FALHOU] ${req.path}`, { erros: errosDetalhados });
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Dados de requisição inválidos.',
        erros: errosDetalhados
      });
    }
    req.body = result.data;
    next();
  };
}

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
    safeLogger.warn('⚠️ Erro ao inicializar cliente Supabase:', { erro: e.message });
  }
} else {
  safeLogger.warn('⚠️ AVISO: SUPABASE_URL ou SUPABASE_SECRET_KEY ainda não preenchidos no .env.local.');
}

/**
 * ------------------------------------------------------------------
 * 1. ROTA DE VALIDAÇÃO DO FISCAL (POST /api/ingressos/validar)
 * ------------------------------------------------------------------
 */
app.post('/api/ingressos/validar', validarSchema(validarIngressoSchema), async (req, res, next) => {
  try {
    const { codigo_validacao } = req.body;

    if (!supabaseAdmin) {
      return res.status(503).json({
        sucesso: false,
        mensagem: 'Servidor Supabase não configurado no .env.local (SUPABASE_URL e SUPABASE_SECRET_KEY necessárias).'
      });
    }

    const { data: resultado, error } = await supabaseAdmin.rpc('validar_ingresso_atomico', {
      p_codigo_validacao: codigo_validacao
    });

    if (error) {
      safeLogger.error('Erro na RPC de validação:', { erro: error.message });
      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro interno ao processar a validação do ingresso.'
      });
    }

    return res.status(resultado.status_code).json(resultado);

  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------
 * 2. GERAÇÃO DE INGRESSO E ENVIO DE E-MAIL PÓS-PAGAMENTO
 * ------------------------------------------------------------------
 */
app.post('/api/ingressos/gerar', validarSchema(gerarIngressoSchema), async (req, res, next) => {
  try {
    const { reserva_id, evento_id } = req.body;

    if (!supabaseAdmin) {
      return res.status(503).json({
        sucesso: false,
        mensagem: 'Servidor Supabase não configurado no .env.local.'
      });
    }

    const { data: reserva, error: reservaError } = await supabaseAdmin
      .from('reservas')
      .select('*')
      .eq('id', reserva_id)
      .single();

    if (reservaError || !reserva) {
      return res.status(404).json({ sucesso: false, mensagem: 'Reserva não encontrada.' });
    }

    const codigoValidacao = uuidv4();

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
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao gerar registro de ingresso no banco.' });
    }

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
    next(err);
  }
});

/**
 * ------------------------------------------------------------------
 * 3. ROTA DE ENVIO DE E-MAIL (POST /api/ingressos/enviar-email)
 * ------------------------------------------------------------------
 */
app.post('/api/ingressos/enviar-email', validarSchema(enviarEmailSchema), async (req, res, next) => {
  try {
    const dadosCompra = req.body;
    
    // Dispara o envio de e-mail
    const resultado = await enviarIngressoPorEmail(dadosCompra);

    // Retorna a resposta com Mascaramento de Dados (Data Masking) no CPF
    return res.status(resultado.sucesso ? 200 : 500).json({
      ...resultado,
      resumoCompra: {
        nome: dadosCompra.nome,
        cpfMascarado: mascararCPF(dadosCompra.cpf),
        email: dadosCompra.email,
        codigoReserva: dadosCompra.codigoReserva
      }
    });

  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------
 * 4. DEMONSTRAÇÃO: MASCARAMENTO DE DADOS DO USUÁRIO (DATA MASKING)
 * ------------------------------------------------------------------
 */
app.get('/api/usuario/perfil-exemplo', (req, res) => {
  // Exemplo de dados brutos armazenados internamente no banco
  const usuarioDoBanco = {
    id: 'usr_987654',
    nome: 'Gustavo Sebastião',
    email: 'gustavo@exemplo.com.br',
    cpfBruto: '12345678901',
    cartaoCadastradoBruto: '4111222233334444'
  };

  // Exemplo de criptografia reversível em repouso com AES-256-GCM para salvar no banco
  const cpfCriptografado = criptografarTexto(usuarioDoBanco.cpfBruto);
  const cpfDescriptografado = descriptografarTexto(cpfCriptografado);

  // Aplica MASCARAMENTO estrito antes de entregar qualquer resposta ao Frontend
  const respostaMascarada = {
    id: usuarioDoBanco.id,
    nome: usuarioDoBanco.nome,
    email: usuarioDoBanco.email,
    cpf: mascararCPF(cpfDescriptografado), // Retorna ***.***.789-**
    cartao: mascararCartao(usuarioDoBanco.cartaoCadastradoBruto), // Retorna •••• •••• •••• 4444
    exemploCriptografiaBanco: cpfCriptografado // Exemplo visual da string segura no DB (iv:tag:ciphertext)
  };

  return res.json({
    sucesso: true,
    usuario: respostaMascarada
  });
});

/**
 * ------------------------------------------------------------------
 * 5. DEMONSTRAÇÃO: PROCESSAMENTO PCI-DSS E ALGORITMO DE LUHN
 * ------------------------------------------------------------------
 */
app.post('/api/pagamento/processar-exemplo', validarSchema(pagamentoTokenizadoSchema), (req, res) => {
  const { nomeTitular, cpf, tokenCartao, numeroCartao, valor } = req.body;

  // Em conformidade com o PCI-DSS:
  // Nunca armazene o número do cartão (PAN) ou CVV no seu banco de dados.
  // Utilize a Tokenização do gateway de pagamento (ex: MercadoPago, Stripe, Pagar.me).
  const tokenFinal = tokenCartao || `tok_pci_${uuidv4().substring(0, 8)}`;
  const cartaoExibicao = numeroCartao ? mascararCartao(numeroCartao) : '•••• •••• •••• 8888';

  safeLogger.info('Pagamento processado via Tokenização PCI-DSS com sucesso', {
    titular: nomeTitular,
    cpf: cpf, // O logger seguro mascarará automaticamente no console
    cartao: cartaoExibicao,
    valor: valor
  });

  return res.json({
    sucesso: true,
    mensagem: 'Pagamento processado com segurança conforme normas PCI-DSS.',
    comprovante: {
      titular: nomeTitular,
      cpfMascarado: mascararCPF(cpf),
      cartaoMascarado: cartaoExibicao,
      tokenProcessamento: tokenFinal,
      valor: valor
    }
  });
});

// ------------------------------------------------------------------
// TRATAMENTO DE ERROS CENTRALIZADO E SEGURO (SEM STACK TRACE EM PROD)
// ------------------------------------------------------------------
app.use((err, req, res, next) => {
  safeLogger.error('🔥 [Erro Interno no Servidor]', { erro: err.message, stack: err.stack });

  const isProd = process.env.NODE_ENV === 'production';
  const status = err.status || err.statusCode || 500;
  const mensagem = isProd 
    ? 'Ocorreu um erro interno no servidor.' 
    : (err.message || 'Erro interno no servidor.');

  return res.status(status).json({
    sucesso: false,
    mensagem: mensagem,
    ...(isProd ? {} : { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  safeLogger.info(`Servidor Back-end de Validação e E-mails rodando na porta ${PORT}`);
});
