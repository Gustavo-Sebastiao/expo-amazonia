import nodemailer from 'nodemailer';
import QRCode from 'qrcode';

/**
 * Configuração do Transportador de E-mail (Nodemailer)
 * Suporta SMTP do Gmail com Senha de App, Resend, SendGrid ou Amazon SES.
 * Defina as variáveis no seu .env.local ou ambiente de produção.
 */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_SECURE === 'true', // true para porta 465, false para 587
  auth: {
    user: process.env.EMAIL_USER || 'seu-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'sua-senha-de-app-ou-api-key'
  }
});

/**
 * Template HTML Email-Safe (Compatível com Gmail, Outlook e Apple Mail)
 * Utiliza estrutura baseada em tabelas e estilos inline.
 */
function gerarTemplateEmailHTML(dados) {
  const {
    nome,
    cpf,
    email,
    dataViagem,
    horarioSaida,
    valorTotal,
    formaPagamento,
    codigoReserva,
    codigoValidacao
  } = dados;

  const valorFormatado = typeof valorTotal === 'number' 
    ? valorTotal.toFixed(2) 
    : valorTotal;

  const codigoTruncado = codigoValidacao 
    ? `${codigoValidacao.substring(0, 8)}...` 
    : 'N/A';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu Ingresso - Expo Amazônia</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f7f8; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Cartão Container Principal -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e5e5e7; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          
          <!-- Ícone de Sucesso (Checkmark) -->
          <tr>
            <td align="center" style="padding-bottom: 16px;">
              <table border="0" cellpadding="0" cellspacing="0" style="width: 48px; height: 48px; background-color: #1c1c1e; border-radius: 50%;">
                <tr>
                  <td align="center" valign="middle" style="color: #ffffff; font-size: 22px; font-weight: bold; line-height: 48px;">
                    &#10003;
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Título e Subtítulo -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #1c1c1e; text-align: center;">
                Compra realizada com sucesso!
              </h1>
              <p style="margin: 0; font-size: 13px; color: #6e6e73; text-align: center;">
                Sua reserva foi confirmada. Apresente seu comprovante no dia do embarque.
              </p>
            </td>
          </tr>

          <!-- Box com Detalhes do Ingresso -->
          <tr>
            <td>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f2f2f7; border: 1px solid #e5e5e7; border-radius: 10px; padding: 20px;">
                <tr>
                  <td style="font-size: 13px; color: #1c1c1e; line-height: 1.7;">
                    <p style="margin: 0 0 6px 0;"><strong>Nome:</strong> ${nome}</p>
                    <p style="margin: 0 0 6px 0;"><strong>CPF:</strong> ${cpf}</p>
                    <p style="margin: 0 0 6px 0;"><strong>E-mail:</strong> ${email}</p>
                    <p style="margin: 0 0 6px 0;"><strong>Data e Horário:</strong> ${dataViagem} às ${horarioSaida}</p>
                    <p style="margin: 0 0 6px 0;"><strong>Valor Total:</strong> R$ ${valorFormatado}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Forma de Pagamento:</strong> ${formaPagamento}</p>
                    <p style="margin: 0; font-size: 12px; color: #6e6e73;">Código da Reserva: <strong>${codigoReserva}</strong></p>
                  </td>
                </tr>

                <!-- Divisor Pontilhado -->
                <tr>
                  <td style="padding: 16px 0 12px 0;">
                    <div style="border-top: 1px dashed #d1d1d6; height: 1px; width: 100%;"></div>
                  </td>
                </tr>

                <!-- Seção do QR Code -->
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600; color: #1c1c1e;">
                      QR Code do Ingresso (Apresente na Portaria):
                    </p>
                    <!-- Imagem do QR Code embutida via Content-ID (CID) -->
                    <img src="cid:qrcode_ingresso" alt="QR Code de Validação" width="150" height="150" style="display: block; border: 1px solid #e5e5e7; border-radius: 8px; padding: 6px; background-color: #ffffff;" />
                    <p style="margin: 6px 0 0 0; font-size: 11px; color: #6e6e73; font-family: monospace;">
                      Código de Validação: ${codigoTruncado}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Rodapé do E-mail -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <p style="margin: 0; font-size: 11px; color: #8e8e93; text-align: center;">
                Expo Amazônia &copy; 2026 - Todos os direitos reservados.<br>
                Este e-mail serve como seu comprovante de reserva digital.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * ------------------------------------------------------------------
 * FUNÇÃO PRINCIPAL: enviarIngressoPorEmail(dadosCompra)
 * ------------------------------------------------------------------
 * Dispara o e-mail de confirmação com o QR Code anexado via CID de forma assíncrona.
 *
 * @param {Object} dadosCompra - Objeto com os dados da reserva
 * @returns {Promise<Object>} Resultado do disparo do e-mail
 */
export async function enviarIngressoPorEmail(dadosCompra) {
  try {
    const {
      email,
      nome,
      codigoValidacao
    } = dadosCompra;

    if (!email || !codigoValidacao) {
      throw new Error('E-mail do destinatário e código de validação são obrigatórios para envio.');
    }

    // 1. Gerar o QR Code em memória como Buffer usando a biblioteca 'qrcode'
    const qrCodeBuffer = await QRCode.toBuffer(codigoValidacao, {
      type: 'png',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    // 2. Gerar o HTML seguro com os dados dinâmicos da compra
    const htmlBody = gerarTemplateEmailHTML(dadosCompra);

    // 3. Montar e disparar a mensagem via Nodemailer com Anexo CID embutido
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Expo Amazônia'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || 'no-reply@expoamazonia.com.br'}>`,
      to: email,
      subject: `Seu Ingresso Confirmado! - Reserva ${dadosCompra.codigoReserva}`,
      html: htmlBody,
      attachments: [
        {
          filename: 'qrcode-ingresso.png',
          content: qrCodeBuffer,
          cid: 'qrcode_ingresso' // Referenciado no HTML como <img src="cid:qrcode_ingresso">
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[E-mail Enviado] Ingresso enviado com sucesso para ${email} (MessageID: ${info.messageId})`);

    return {
      sucesso: true,
      messageId: info.messageId
    };

  } catch (err) {
    // Trata o erro adequadamente e registra nos logs sem interromper a resposta do checkout
    console.error(`[Erro Envio E-mail] Falha ao enviar ingresso para ${dadosCompra?.email}:`, err.message);
    return {
      sucesso: false,
      erro: err.message
    };
  }
}
