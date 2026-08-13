// Estado global da reserva
const bookingState = {
  name: '',
  email: '',
  cpf: '',
  date: null,
  selectedTime: '10h00',
  ticketType: '',
  ticketPrice: 0,
  paymentMethod: 'card',
  codigoReserva: ''
};

// Data atual para controle do calendário
let currentCalendarDate = new Date();

// Inicialização do cliente Supabase (utilizando a chave pública moderna sb_publishable_...)
const SUPABASE_URL = (window.ENV && window.ENV.SUPABASE_URL) || '';
const SUPABASE_PUBLISHABLE_KEY = (window.ENV && window.ENV.SUPABASE_PUBLISHABLE_KEY) || '';

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && !SUPABASE_URL.includes('seu-projeto')) {
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  } catch (e) {
    console.warn('Configuração do Supabase pendente:', e.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initStep1Validation();
  initCalendar();
  initPayment();
  initNavigation();
  initTitleWritingEffect();
});

// Efeito de escrita no título "Amazônia" da Hero Section
function initTitleWritingEffect() {
  const heroWrapper = document.getElementById('heroTitleWrapper');
  if (!heroWrapper) return;

  const startAnimation = () => {
    setTimeout(() => {
      heroWrapper.classList.add('is-writing');
    }, 150);
  };

  const img = heroWrapper.querySelector('.hero-title-img');
  if (img && img.complete) {
    startAnimation();
  } else if (img) {
    img.addEventListener('load', startAnimation);
    setTimeout(startAnimation, 300);
  } else {
    startAnimation();
  }
}

// NAVEGAÇÃO DE PASSOS
function goToStep(stepNumber) {
  // Esconde todas as seções
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));

  // Ativa o passo solicitado
  const targetStep = document.getElementById(`step-${stepNumber}`);
  if (targetStep) {
    targetStep.classList.add('active');
  }

  // Atualiza a barra de progresso (stepper)
  const stepIndicators = document.querySelectorAll('.step');
  stepIndicators.forEach((el, idx) => {
    if (idx + 1 <= stepNumber) {
      el.classList.add('active');
    }
  });

  if (stepNumber === 3) {
    updateSummary();
  }

  if (stepNumber === 4) {
    renderReceipt();
  }
}

function initNavigation() {
  // Botões de voltar
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const toStep = e.target.getAttribute('data-to-step');
      goToStep(parseInt(toStep));
    });
  });

  // Botão Avançar Passo 1 -> Passo 2 (Data e Horário)
  document.getElementById('btn-step-1-next').addEventListener('click', () => {
    goToStep(2);
  });

  // Botão Avançar Passo 2 -> Passo 3 (Pagamento)
  document.getElementById('btn-step-2-next').addEventListener('click', () => {
    goToStep(3);
  });

  // Botão Finalizar Pagamento (Passo 3) -> Persiste no Supabase -> Passo 4 (Confirmação)
  const finishBtn = document.getElementById('btn-step-3-finish');
  finishBtn.addEventListener('click', async () => {
    finishBtn.disabled = true;
    finishBtn.textContent = 'Processando reserva...';

    // Gerar código único de reserva e UUID v4 de validação do QR Code
    const codigoReserva = '#AMZ-' + Math.floor(100000 + Math.random() * 900000);
    const codigoValidacao = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : 'f' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    bookingState.codigoReserva = codigoReserva;
    bookingState.codigoValidacao = codigoValidacao;

    // Persistir reserva e ingresso no Supabase se configurado
    if (supabaseClient && bookingState.date) {
      try {
        const isoDate = bookingState.date.toISOString().split('T')[0];
        
        // 1. Salvar na tabela de reservas
        const { data: reservaData, error: reservaError } = await supabaseClient
          .from('reservas')
          .insert([{
            codigo_reserva: codigoReserva,
            nome: bookingState.name,
            email: bookingState.email,
            cpf: bookingState.cpf,
            data_viagem: isoDate,
            horario_saida: bookingState.selectedTime,
            horario_chegada: calculateArrivalTime(bookingState.selectedTime),
            valor_total: bookingState.ticketPrice,
            forma_pagamento: bookingState.paymentMethod,
            status_pagamento: 'confirmado'
          }])
          .select('id')
          .single();

        if (reservaError) {
          console.warn('Aviso ao salvar reserva no Supabase:', reservaError.message);
        } else if (reservaData && reservaData.id) {
          // 2. Salvar na tabela de ingressos para validação do fiscal
          const { error: ingressoError } = await supabaseClient
            .from('ingressos')
            .insert([{
              codigo_validacao: codigoValidacao,
              usuario_id: reservaData.id,
              evento_id: 'expo-amazonia-2026',
              status: 'valido'
            }]);

          if (ingressoError) {
            console.warn('Aviso ao salvar ingresso no Supabase:', ingressoError.message);
          }
        }
      } catch (err) {
        console.warn('Erro ao conectar ao Supabase:', err);
      }
    }

    // 3. Disparar envio de e-mail real via servidor Node.js local (server.js) se estiver rodando
    try {
      fetch('http://localhost:3000/api/ingressos/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: bookingState.name,
          email: bookingState.email,
          cpf: bookingState.cpf,
          dataViagem: bookingState.date ? bookingState.date.toLocaleDateString('pt-BR') : 'Data confirmada',
          horarioSaida: bookingState.selectedTime,
          valorTotal: bookingState.ticketPrice,
          formaPagamento: bookingState.paymentMethod === 'card' ? 'Cartão de Débito/Crédito' : (bookingState.paymentMethod === 'pix' ? 'Pix' : 'Boleto Bancário'),
          codigoReserva: codigoReserva,
          codigoValidacao: codigoValidacao
        })
      }).catch(e => console.log('Servidor de e-mail local desativado ou indisponível:', e.message));
    } catch (e) {
      // Ignora silenciosamente se o servidor local não estiver rodando
    }

    finishBtn.textContent = 'Finalizar Pagamento';
    finishBtn.disabled = false;
    goToStep(4);
  });

  // Botão Voltar ao Início (Passo 4)
  document.getElementById('btn-restart').addEventListener('click', () => {
    resetAll();
    goToStep(1);
  });
}

// PASSO 1: VALIDAÇÃO DOS DADOS PESSOAIS
function initStep1Validation() {
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const cpfInput = document.getElementById('cpf');
  const btnNext = document.getElementById('btn-step-1-next');

  // Máscara e restrição estrita de 11 números para o CPF
  cpfInput.addEventListener('input', (e) => {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    
    let formatted = digits;
    if (digits.length > 9) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    } else if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    
    e.target.value = formatted;
    checkForm();
  });

  function checkForm() {
    const nameVal = nameInput.value.trim();
    const emailVal = emailInput.value.trim();
    const cpfDigits = cpfInput.value.replace(/\D/g, '');

    // O CPF deve conter exatamente 11 dígitos
    const isCpfValid = cpfDigits.length === 11;

    if (nameVal !== '' && emailVal !== '' && isCpfValid) {
      bookingState.name = nameVal;
      bookingState.email = emailVal;
      bookingState.cpf = cpfInput.value;
      btnNext.disabled = false;
    } else {
      btnNext.disabled = true;
    }
  }

  nameInput.addEventListener('input', checkForm);
  emailInput.addEventListener('input', checkForm);
}

// PASSO 2: AGENDAMENTO POR HORÁRIO E LISTAGEM DE CARDS DE VIAGEM
function initCalendar() {
  const calPrev = document.getElementById('cal-prev');
  const calNext = document.getElementById('cal-next');

  // Seleção dos Botões de Horário no Topo
  const timeButtons = document.querySelectorAll('.time-slot-btn');
  timeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      timeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      bookingState.selectedTime = btn.getAttribute('data-time');
      renderTripCards();
    });
  });

  calPrev.addEventListener('click', () => {
    if (!calPrev.disabled) {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderTripCards();
    }
  });

  calNext.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderTripCards();
  });

  renderTripCards();
}

// Função auxiliar para calcular término da viagem (exatamente 1h 30m após o início)
function calculateArrivalTime(departureTime) {
  const timesMap = {
    '10h00': '11h30',
    '12h00': '13h30',
    '14h00': '15h30',
    '16h00': '17h30'
  };

  if (timesMap[departureTime]) {
    return timesMap[departureTime];
  }

  let match = departureTime ? departureTime.match(/(\d+)[h:](\d+)/i) : null;
  if (!match) return '11h30';

  let hours = parseInt(match[1], 10);
  let minutes = parseInt(match[2], 10);

  let totalMinutes = hours * 60 + minutes + 90;
  let newHours = Math.floor(totalMinutes / 60) % 24;
  let newMinutes = totalMinutes % 60;

  let strHours = newHours.toString().padStart(2, '0');
  let strMinutes = newMinutes.toString().padStart(2, '0');

  return `${strHours}h${strMinutes}`;
}

function renderTripCards() {
  const monthYearLabel = document.getElementById('cal-month-year');
  const cardsContainer = document.getElementById('trip-cards-container');
  const calPrev = document.getElementById('cal-prev');
  const btnNext = document.getElementById('btn-step-2-next');

  cardsContainer.innerHTML = '';

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const now = new Date();
  const currentRealYear = now.getFullYear();
  const currentRealMonth = now.getMonth();

  // Desabilita a seta de voltar quando estiver no mês atual ou anterior
  if (year < currentRealYear || (year === currentRealYear && month <= currentRealMonth)) {
    calPrev.disabled = true;
  } else {
    calPrev.disabled = false;
  }

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  monthYearLabel.textContent = `${monthNames[month]} ${year}`;

  const totalDays = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentDeparture = bookingState.selectedTime || '10h00';
  const currentArrival = calculateArrivalTime(currentDeparture);
  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  let countAvailable = 0;

  for (let day = 1; day <= totalDays; day++) {
    const cellDate = new Date(year, month, day);
    cellDate.setHours(0, 0, 0, 0);

    const dayOfWeek = cellDate.getDay(); // 0 = Dom, 3 = Qua, 5 = Sex, 6 = Sáb
    const isAllowedDay = [0, 3, 5, 6].includes(dayOfWeek);

    // Renderiza APENAS dias a partir de hoje que caem na Quarta, Sexta, Sábado ou Domingo
    if (cellDate >= today && isAllowedDay) {
      countAvailable++;
      const card = document.createElement('div');
      card.classList.add('trip-card');

      // Preço: Quarta (3) e Sexta (5) -> R$ 150 | Sábado (6) e Domingo (0) -> R$ 180
      const price = (dayOfWeek === 3 || dayOfWeek === 5) ? 150 : 180;

      if (bookingState.date && bookingState.date.getTime() === cellDate.getTime()) {
        card.classList.add('selected');
      }

      card.innerHTML = `
        <div class="trip-card-header">
          <div class="trip-time-box">
            <span class="departure-time">${currentDeparture}</span>
            <span class="location-name">Porto de Manaus</span>
          </div>
          <div class="trip-route-line">
            <div class="route-line-bar">
              <div class="route-point"></div>
              <div class="route-dashed-line"></div>
              <div class="route-badge-icon">🛥️</div>
              <div class="route-dashed-line"></div>
              <div class="route-point"></div>
            </div>
            <span class="route-duration">1h 30m • Direto</span>
          </div>
          <div class="trip-time-box text-right">
            <span class="arrival-time">${currentArrival}</span>
            <span class="location-name">Rio Amazonas</span>
          </div>
        </div>
        <div class="trip-card-footer">
          <div class="trip-date-badge">
            ${dayNames[dayOfWeek]}, ${day} de ${monthNames[month]}
          </div>
          <div class="trip-price-tag">R$ ${price},00</div>
        </div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.trip-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        bookingState.date = cellDate;
        bookingState.ticketPrice = price;
        bookingState.ticketType = 'Passeio Expo Amazônia';

        const dateFormatted = cellDate.toLocaleDateString('pt-BR', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });

        document.getElementById('selected-date-info').innerHTML = 
          `Viagem selecionada: <strong>${dateFormatted} às ${bookingState.selectedTime}</strong> — <strong>R$ ${price},00</strong>`;

        btnNext.disabled = false;
      });

      cardsContainer.appendChild(card);
    }
  }

  if (countAvailable === 0) {
    cardsContainer.innerHTML = '<p style="text-align: center; font-size: 13px; color: #6e6e73; padding: 20px;">Nenhuma viagem disponível neste mês.</p>';
  }
}

// PASSO 3: FORMA DE PAGAMENTO E RESUMO
function initPayment() {
  const tabs = document.querySelectorAll('.payment-tab');
  const details = document.querySelectorAll('.payment-detail');
  const btnFinish = document.getElementById('btn-step-3-finish');

  const cardNumberInput = document.getElementById('card-number');
  const cardExpiryInput = document.getElementById('card-expiry');
  const cardCvvInput = document.getElementById('card-cvv');

  // Validação dos dados do cartão
  function validatePayment() {
    if (bookingState.paymentMethod === 'card') {
      const cardDigits = cardNumberInput.value.replace(/\D/g, '');
      const expiryDigits = cardExpiryInput.value.replace(/\D/g, '');
      const cvvDigits = cardCvvInput.value.replace(/\D/g, '');

      // Cartão: 16 números exatos | Validade: 4 números exatos | CVV: 3 números exatos
      const isCardValid = (cardDigits.length === 16) && (expiryDigits.length === 4) && (cvvDigits.length === 3);
      btnFinish.disabled = !isCardValid;
    } else {
      btnFinish.disabled = false;
    }
  }

  // Restrição e formatação do Número do Cartão (16 números)
  cardNumberInput.addEventListener('input', (e) => {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 16);
    let formatted = digits.match(/.{1,4}/g)?.join(' ') || digits;
    e.target.value = formatted;
    validatePayment();
  });

  // Restrição e formatação da Validade (4 números, adiciona / após 2 números)
  cardExpiryInput.addEventListener('input', (e) => {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    let formatted = digits;
    if (digits.length >= 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    e.target.value = formatted;
    validatePayment();
  });

  // Restrição do CVV (3 números)
  cardCvvInput.addEventListener('input', (e) => {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 3);
    e.target.value = digits;
    validatePayment();
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      details.forEach(d => d.classList.remove('active'));

      tab.classList.add('active');
      const method = tab.getAttribute('data-method');
      bookingState.paymentMethod = method;

      document.getElementById(`payment-${method}`).classList.add('active');
      validatePayment();
    });
  });

  // Estado inicial ao carregar o passo
  validatePayment();
}

function updateSummary() {
  const summaryEl = document.getElementById('summary-text');
  const timeStr = bookingState.selectedTime || '10h00';
  const dateStr = bookingState.date 
    ? `${bookingState.date.toLocaleDateString('pt-BR')} às ${timeStr}` 
    : 'Não selecionada';

  summaryEl.innerHTML = `
    Cliente: <strong>${bookingState.name}</strong><br>
    Data da Viagem: <strong>${dateStr}</strong><br>
    Modalidade: <strong>${bookingState.ticketType}</strong> (R$ ${bookingState.ticketPrice.toFixed(2)})
  `;
}

// PASSO 4: RECIBO E CONFIRMAÇÃO
function renderReceipt() {
  const receiptEl = document.getElementById('receipt-details');
  const timeStr = bookingState.selectedTime || '10h00';
  const dateStr = bookingState.date 
    ? `${bookingState.date.toLocaleDateString('pt-BR')} às ${timeStr}` 
    : 'Data confirmada';

  const methodNames = {
    card: 'Cartão de Débito/Crédito',
    pix: 'Pix',
    boleto: 'Boleto Bancário'
  };

  const codigo = bookingState.codigoReserva || ('#AMZ-' + Math.floor(100000 + Math.random() * 900000));
  const qrData = bookingState.codigoValidacao || 'ingresso-demo-validacao';

  receiptEl.innerHTML = `
    <p><strong>Nome:</strong> ${bookingState.name}</p>
    <p><strong>CPF:</strong> ${bookingState.cpf}</p>
    <p><strong>E-mail:</strong> ${bookingState.email}</p>
    <p><strong>Data e Horário:</strong> ${dateStr}</p>
    <p><strong>Valor Total:</strong> R$ ${bookingState.ticketPrice.toFixed(2)}</p>
    <p><strong>Forma de Pagamento:</strong> ${methodNames[bookingState.paymentMethod] || 'Cartão'}</p>
    <p style="margin-top: 6px; font-size: 12px; color: #6e6e73;">Código da Reserva: <strong>${codigo}</strong></p>

    <div style="text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #e5e5e7;">
      <p style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">QR Code do Ingresso (Apresente na Portaria):</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrData)}" alt="QR Code Ingresso" style="border: 1px solid #e5e5e7; border-radius: 8px; padding: 4px; background: #ffffff;">
      <p style="font-size: 11px; color: #6e6e73; font-family: monospace; margin-top: 4px;">Código de Validação: ${qrData.slice(0, 8)}...</p>
    </div>
  `;
}

// RESET COMPLETO
function resetAll() {
  bookingState.name = '';
  bookingState.email = '';
  bookingState.cpf = '';
  bookingState.date = null;
  bookingState.selectedTime = '10h00';
  bookingState.ticketType = '';
  bookingState.ticketPrice = 0;
  bookingState.paymentMethod = 'card';
  bookingState.codigoReserva = '';

  document.getElementById('form-user-data').reset();
  document.getElementById('btn-step-1-next').disabled = true;

  document.getElementById('card-number').value = '';
  document.getElementById('card-expiry').value = '';
  document.getElementById('card-cvv').value = '';

  // Reseta seleção de horários
  const timeButtons = document.querySelectorAll('.time-slot-btn');
  timeButtons.forEach(b => b.classList.remove('active'));
  if (timeButtons[0]) timeButtons[0].classList.add('active');

  document.getElementById('selected-date-info').textContent = 'Nenhuma data selecionada.';
  document.getElementById('btn-step-2-next').disabled = true;

  currentCalendarDate = new Date();
  renderTripCards();
}
