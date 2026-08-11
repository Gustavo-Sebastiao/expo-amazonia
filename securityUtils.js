import crypto from 'crypto';

/**
 * ------------------------------------------------------------------
 * 1. MASCARAMENTO DE RESPOSTAS (DATA MASKING)
 * ------------------------------------------------------------------
 */

/**
 * Mascara um CPF mantendo apenas o final ou início visível.
 * Exemplo: '123.456.789-01' ou '12345678901' -> '***.***.789-**'
 */
export function mascararCPF(cpf) {
  if (!cpf || typeof cpf !== 'string') return '';
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11) return '***.***.***-**';
  
  const visivel = limpo.slice(6, 9);
  return `***.***.${visivel}-**`;
}

/**
 * Mascara um número de cartão de crédito mostrando apenas os últimos 4 dígitos.
 * Exemplo: '4111 2222 3333 4444' -> '•••• •••• •••• 4444'
 */
export function mascararCartao(cartao) {
  if (!cartao || typeof cartao !== 'string') return '';
  const limpo = cartao.replace(/\D/g, '');
  if (limpo.length < 13) return '•••• •••• •••• ••••';
  
  const ultimosQuatro = limpo.slice(-4);
  return `•••• •••• •••• ${ultimosQuatro}`;
}

/**
 * ------------------------------------------------------------------
 * 2. VALIDAÇÃO MATEMÁTICA E RÍGIDA (CPF & LUHN)
 * ------------------------------------------------------------------
 */

/**
 * Valida se uma string é um CPF brasileiro matematicamente válido.
 * Rejeita dígitos repetidos (ex: 111.111.111-11) e valida os 2 dígitos verificadores.
 */
export function validarCPF(cpf) {
  if (!cpf || typeof cpf !== 'string') return false;
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11) return false;

  // Rejeita sequências conhecidas de dígitos repetidos
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  // Validação do primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9), 10)) return false;

  // Validação do segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(10), 10)) return false;

  return true;
}

/**
 * Valida o número de um cartão de crédito usando o Algoritmo de Luhn (Módulo 10).
 */
export function validarCartaoLuhn(cartao) {
  if (!cartao || typeof cartao !== 'string') return false;
  const limpo = cartao.replace(/\D/g, '');
  if (limpo.length < 13 || limpo.length > 19) return false;

  let soma = 0;
  let deveDobrar = false;

  for (let i = limpo.length - 1; i >= 0; i--) {
    let digito = parseInt(limpo.charAt(i), 10);

    if (deveDobrar) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }

    soma += digito;
    deveDobrar = !deveDobrar;
  }

  return soma % 10 === 0;
}

/**
 * ------------------------------------------------------------------
 * 3. SANITIZAÇÃO DE LOGS (PREVENÇÃO DE VAZAMENTO)
 * ------------------------------------------------------------------
 */

const CAMPOS_SENSIVEIS = ['cpf', 'senha', 'password', 'cartao', 'numerocartao', 'cvv', 'cvc', 'secret', 'secretkey', 'token', 'apikey'];

/**
 * Varre um objeto ou array e produz uma cópia sanitizada com dados sensíveis ocultos.
 */
export function sanitizarObjeto(dados) {
  if (!dados || typeof dados !== 'object') return dados;

  if (Array.isArray(dados)) {
    return dados.map(item => sanitizarObjeto(item));
  }

  const copiaSanitizada = {};
  for (const [chave, valor] of Object.entries(dados)) {
    const chaveMinuscula = chave.toLowerCase();
    
    if (CAMPOS_SENSIVEIS.some(campo => chaveMinuscula.includes(campo))) {
      if (chaveMinuscula.includes('cpf') && typeof valor === 'string') {
        copiaSanitizada[chave] = mascararCPF(valor);
      } else if (chaveMinuscula.includes('cartao') && typeof valor === 'string') {
        copiaSanitizada[chave] = mascararCartao(valor);
      } else {
        copiaSanitizada[chave] = '*** [DADO CONFIDENCIAL OCULTO] ***';
      }
    } else if (valor && typeof valor === 'object') {
      copiaSanitizada[chave] = sanitizarObjeto(valor);
    } else {
      copiaSanitizada[chave] = valor;
    }
  }

  return copiaSanitizada;
}

/**
 * Logger seguro reutilizável para o console.
 */
export const safeLogger = {
  info: (mensagem, meta = {}) => {
    console.log(`[INFO] ${mensagem}`, sanitizarObjeto(meta));
  },
  warn: (mensagem, meta = {}) => {
    console.warn(`[WARN] ${mensagem}`, sanitizarObjeto(meta));
  },
  error: (mensagem, meta = {}) => {
    console.error(`[ERROR] ${mensagem}`, sanitizarObjeto(meta));
  }
};

/**
 * ------------------------------------------------------------------
 * 4. CRIPTOGRAFIA DE DADOS EM REPOUSO (AES-256-GCM)
 * ------------------------------------------------------------------
 */

// Chave simétrica de 32 bytes (256 bits). Em produção, defina ENCRYPTION_SECRET_KEY no .env.local
const SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY
  ? crypto.scryptSync(process.env.ENCRYPTION_SECRET_KEY, 'salt-amazonia', 32)
  : crypto.scryptSync('chave-secreta-desenvolvimento-local-32b', 'salt-amazonia', 32);

const ALGORITMO = 'aes-256-gcm';

/**
 * Criptografa uma string usando AES-256-GCM.
 * Retorna uma string serializada no formato: 'iv:authTag:textoCifrado'
 */
export function criptografarTexto(texto) {
  if (!texto || typeof texto !== 'string') return texto;

  const iv = crypto.randomBytes(12); // IV de 96 bits recomendado para GCM
  const cipher = crypto.createCipheriv(ALGORITMO, SECRET_KEY, iv);

  let cifrado = cipher.update(texto, 'utf8', 'hex');
  cifrado += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${cifrado}`;
}

/**
 * Descriptografa uma string produzida por criptografarTexto.
 */
export function descriptografarTexto(payloadCriptografado) {
  if (!payloadCriptografado || typeof payloadCriptografado !== 'string') return payloadCriptografado;

  const partes = payloadCriptografado.split(':');
  if (partes.length !== 3) return payloadCriptografado; // Retorna original se não estiver no formato

  const [ivHex, authTagHex, cifradoHex] = partes;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITMO, SECRET_KEY, iv);
  decipher.setAuthTag(authTag);

  let texto = decipher.update(cifradoHex, 'hex', 'utf8');
  texto += decipher.final('utf8');

  return texto;
}
