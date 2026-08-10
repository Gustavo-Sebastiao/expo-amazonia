// Estado global da reserva
const bookingState = {
  name: '',
  email: '',
  cpf: '',
  date: null,
  ticketType: '',
  ticketPrice: 0,
  paymentMethod: 'card'
};

// Data atual para controle do calendário
let currentCalendarDate = new Date();

document.addEventListener('DOMContentLoaded', () => {
  initStep1Validation();
  initCalendar();
  initTickets();
  initPayment();
  initNavigation();
});

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

  if (stepNumber === 4) {
    updateSummary();
  }

  if (stepNumber === 5) {
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

  // Botão Avançar Passo 1
  document.getElementById('btn-step-1-next').addEventListener('click', () => {
    goToStep(2);
  });

  // Botão Avançar Passo 2
  document.getElementById('btn-step-2-next').addEventListener('click', () => {
    goToStep(3);
  });

  // Botão Avançar Passo 3
  document.getElementById('btn-step-3-next').addEventListener('click', () => {
    goToStep(4);
  });

  // Botão Finalizar Pagamento (Passo 4)
  document.getElementById('btn-step-4-finish').addEventListener('click', () => {
    goToStep(5);
  });

  // Botão Voltar ao Início (Passo 5)
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

// PASSO 2: CALENDÁRIO COM BLOQUEIO DE DATAS PASSADAS
function initCalendar() {
  const calPrev = document.getElementById('cal-prev');
  const calNext = document.getElementById('cal-next');

  calPrev.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
  });

  calNext.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
  });

  renderCalendar();
}

function renderCalendar() {
  const monthYearLabel = document.getElementById('cal-month-year');
  const daysContainer = document.getElementById('calendar-days');
  const btnNext = document.getElementById('btn-step-2-next');

  daysContainer.innerHTML = '';

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  monthYearLabel.textContent = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Preenche dias em branco no início
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.classList.add('cal-day', 'disabled');
    daysContainer.appendChild(emptyCell);
  }

  // Preenche os dias do mês
  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.classList.add('cal-day');
    dayCell.textContent = day;

    const cellDate = new Date(year, month, day);
    cellDate.setHours(0, 0, 0, 0);

    // Bloqueia dias anteriores ao dia de hoje
    if (cellDate < today) {
      dayCell.classList.add('disabled');
    } else {
      // Verifica se é o dia selecionado atualmente
      if (bookingState.date && bookingState.date.getTime() === cellDate.getTime()) {
        dayCell.classList.add('selected');
      }

      dayCell.addEventListener('click', () => {
        document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
        dayCell.classList.add('selected');
        bookingState.date = cellDate;

        const dateFormatted = cellDate.toLocaleDateString('pt-BR', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });

        document.getElementById('selected-date-info').innerHTML = 
          `Data selecionada: <strong>${dateFormatted}</strong>`;

        btnNext.disabled = false;
      });
    }

    daysContainer.appendChild(dayCell);
  }
}

// PASSO 3: SELEÇÃO DE INGRESSOS
function initTickets() {
  const ticketCards = document.querySelectorAll('.ticket-card');
  const btnNext = document.getElementById('btn-step-3-next');

  ticketCards.forEach(card => {
    card.addEventListener('click', () => {
      ticketCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      bookingState.ticketType = card.getAttribute('data-ticket') === 'premium' ? 'Ingresso Premium' : 'Ingresso Normal';
      bookingState.ticketPrice = parseFloat(card.getAttribute('data-price'));

      btnNext.disabled = false;
    });
  });
}

// PASSO 4: FORMA DE PAGAMENTO E RESUMO
function initPayment() {
  const tabs = document.querySelectorAll('.payment-tab');
  const details = document.querySelectorAll('.payment-detail');
  const btnFinish = document.getElementById('btn-step-4-finish');

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
  const dateStr = bookingState.date 
    ? bookingState.date.toLocaleDateString('pt-BR') 
    : 'Não selecionada';

  summaryEl.innerHTML = `
    Cliente: <strong>${bookingState.name}</strong><br>
    Data do Passeio: <strong>${dateStr}</strong><br>
    Modalidade: <strong>${bookingState.ticketType}</strong> (R$ ${bookingState.ticketPrice.toFixed(2)})
  `;
}

// PASSO 5: RECIBO E CONFIRMAÇÃO
function renderReceipt() {
  const receiptEl = document.getElementById('receipt-details');
  const dateStr = bookingState.date 
    ? bookingState.date.toLocaleDateString('pt-BR') 
    : 'Data confirmada';

  const methodNames = {
    card: 'Cartão de Débito/Crédito',
    pix: 'Pix',
    boleto: 'Boleto Bancário'
  };

  receiptEl.innerHTML = `
    <p><strong>Nome:</strong> ${bookingState.name}</p>
    <p><strong>CPF:</strong> ${bookingState.cpf}</p>
    <p><strong>E-mail:</strong> ${bookingState.email}</p>
    <p><strong>Data da Viagem:</strong> ${dateStr}</p>
    <p><strong>Tipo de Ingresso:</strong> ${bookingState.ticketType}</p>
    <p><strong>Forma de Pagamento:</strong> ${methodNames[bookingState.paymentMethod] || 'Cartão'}</p>
    <p><strong>Valor Total:</strong> R$ ${bookingState.ticketPrice.toFixed(2)}</p>
    <p style="margin-top: 10px; font-size: 12px; color: #6e6e73;">Código da Reserva: #AMZ-${Math.floor(100000 + Math.random() * 900000)}</p>
  `;
}

// RESET COMPLETO
function resetAll() {
  bookingState.name = '';
  bookingState.email = '';
  bookingState.cpf = '';
  bookingState.date = null;
  bookingState.ticketType = '';
  bookingState.ticketPrice = 0;
  bookingState.paymentMethod = 'card';

  document.getElementById('form-user-data').reset();
  document.getElementById('btn-step-1-next').disabled = true;

  document.getElementById('card-number').value = '';
  document.getElementById('card-expiry').value = '';
  document.getElementById('card-cvv').value = '';

  document.getElementById('selected-date-info').textContent = 'Nenhuma data selecionada.';
  document.getElementById('btn-step-2-next').disabled = true;

  document.querySelectorAll('.ticket-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('btn-step-3-next').disabled = true;

  currentCalendarDate = new Date();
  renderCalendar();
}
