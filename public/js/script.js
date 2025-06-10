
const socket = io('http://localhost:3000');

// Estados globais
const reservasEmAndamento = [];
const reservasConfirmadas = [];
let garcomNome = "";

// WebSocket
socket.on('init', ({ pendentes, confirmadas }) => {
  console.log('Socket init:', pendentes.length, 'pendentes e', confirmadas.length, 'confirmadas');
  reservasEmAndamento.push(...pendentes);
  reservasConfirmadas.push(...confirmadas);
  preencherOpcoesMesa();
  atualizarDisponibilidadeMesas();
  renderizarPedidos();
});

socket.on('update-reservas', ({ action, reserva }) => {
  console.log('Socket update-reservas:', action, reserva);
  if (action === 'add-pendente') {
    reservasEmAndamento.push(reserva);
  } else if (action === 'confirm') {
    const idx = reservasEmAndamento.findIndex(r => r._id === reserva._id);
    if (idx > -1) reservasEmAndamento.splice(idx, 1);
    reservasConfirmadas.push(reserva);
  }
  preencherOpcoesMesa();
  atualizarDisponibilidadeMesas();
  renderizarPedidos();
});

// Inicio do front
document.addEventListener("DOMContentLoaded", () => {
  preencherOpcoesMesa();
  configurarAlternadorLocal();
  configurarBotoesAtendente();
  configurarIdentificacaoGarcom();
  configurarNavegacao();
  configurarRelatoriosGerente();
});

// Funções do Atendente
function preencherOpcoesMesa() {
  const selectMesa = document.getElementById("mesa");
  selectMesa.innerHTML = '<option value="">Escolha uma mesa</option>';
  for (let i = 1; i <= 10; i++) {
    const option = document.createElement("option");
    option.value = `mesa-${i}`;
    option.textContent = `Mesa ${i}`;
    selectMesa.appendChild(option);
  }
}

function atualizarDisponibilidadeMesas() {
  const selectMesa = document.getElementById("mesa");
  const localAtual = document.getElementById("restaurant-location").value;
  if (!localAtual) {
    Array.from(selectMesa.options).forEach(option => {
      if (option.value.startsWith("mesa-")) {
        option.disabled = false;
        const numero = option.value.split("-")[1];
        option.textContent = `Mesa ${numero}`;
      }
    });
    return;
  }
  const mesasReservadas = reservasEmAndamento
    .filter(r => r.localizacao === localAtual)
    .map(r => r.mesa);
  Array.from(selectMesa.options).forEach(option => {
    if (!option.value.startsWith("mesa-")) return;
    const numero = option.value.split("-")[1];
    if (mesasReservadas.includes(option.value)) {
      option.disabled = true;
      option.textContent = `Mesa ${numero} (Indisp.)`;
    } else {
      option.disabled = false;
      option.textContent = `Mesa ${numero}`;
    }
  });
}

function configurarAlternadorLocal() {
  const btn = document.getElementById("location-btn");
  const hidden = document.getElementById("restaurant-location");
  const locais = ["Barra", "Rio Vermelho"];
  let idx = -1;
  btn.addEventListener("click", () => {
    idx = (idx + 1) % locais.length;
    const escolhido = locais[idx];
    btn.textContent = "Localização: " + escolhido;
    hidden.value = escolhido;
    atualizarDisponibilidadeMesas();
  });
}

function configurarBotoesAtendente() {
  const btnSalvar = document.getElementById("btn-salvar-reserva");
  const btnCancelar = document.getElementById("btn-cancelar");

  btnSalvar.addEventListener("click", () => {
    const nome = document.getElementById("nome").value.trim();
    const data = document.getElementById("data").value;
    const hora = document.getElementById("hora").value;
    const localizacao = document.getElementById("restaurant-location").value || "Não informado";
    const mesa = document.getElementById("mesa").value;
    const quantidade = document.getElementById("quantidade").value;

    if (!nome || !data || !hora || !mesa || !quantidade) {
      alert("⚠️ Preencha todos os campos obrigatórios.");
      return;
    }

    const dadosReserva = {
      nome,
      data,
      hora,
      localizacao,
      mesa,
      quantidade,
      timestamp: new Date().toLocaleString("pt-BR")
    };

    console.log('Emit new-reserva:', dadosReserva);
    socket.emit('new-reserva', dadosReserva);

    alert(`✅ Reserva de ${nome} (Mesa ${mesa}) salva!`);
    document.getElementById("reserva-form").reset();
    document.getElementById("location-btn").textContent = "Selecionar Localização";
    document.getElementById("restaurant-location").value = "";
  });

  btnCancelar.addEventListener("click", () => {
    document.getElementById("reserva-form").reset();
    document.getElementById("location-btn").textContent = "Selecionar Localização";
    document.getElementById("restaurant-location").value = "";
  });
}

// Funções do Garçom
function configurarIdentificacaoGarcom() {
  const btn = document.getElementById("btn-identificar-garcom");
  const display = document.getElementById("garcom-nome-display");
  const aviso = document.getElementById("avisos-garcom");

  btn.addEventListener("click", () => {
    const nome = prompt("Digite seu nome, Garçom:");
    if (nome && nome.trim()) {
      garcomNome = nome.trim();
      console.log('Garçom identificado:', garcomNome);
      display.textContent = `Garçom: ${garcomNome}`;
      aviso.textContent = "";
      renderizarPedidos();
    } else {
      alert("⚠️ Nome inválido.");
    }
  });
}

function renderizarPedidos() {
  const lista = document.getElementById("lista-pedidos");
  lista.innerHTML = "";

  if (reservasEmAndamento.length === 0) {
    const p = document.createElement("p");
    p.textContent = "Nenhuma reserva em andamento.";
    lista.appendChild(p);
    return;
  }

  reservasEmAndamento.forEach((res, i) => {
    const div = document.createElement("div");
    div.classList.add("pedido-item");

    const header = document.createElement("div");
    header.classList.add("pedido-header");
    header.textContent = `Reserva #${i+1} – Mesa ${res.mesa} | ${res.nome} | ${res.timestamp}`;
    div.appendChild(header);

    const detalhes = document.createElement("ul");
    detalhes.classList.add("pedido-itens");
    detalhes.innerHTML = `
      <li>📅 ${res.data} às ${res.hora}</li>
      <li>👥 ${res.quantidade} pessoas</li>
      <li>📍 ${res.localizacao}</li>
    `;
    div.appendChild(detalhes);

    const btn = document.createElement("button");
    btn.textContent = "Confirmar";
    btn.classList.add("btn-confirmar");
    btn.disabled = !garcomNome;
    btn.addEventListener("click", () => confirmarReserva(i));
    div.appendChild(btn);

    lista.appendChild(div);
  });
}

function confirmarReserva(indice) {
  const res = reservasEmAndamento[indice];
  if (!garcomNome) {
    alert("❗ Identifique-se antes de confirmar.");
    return;
  }
  console.log('Emit confirm-reserva:', { id: res._id, garcom: garcomNome });
  socket.emit('confirm-reserva', { id: res._id, garcom: garcomNome });
}

// Funções do Gerente
function configurarRelatoriosGerente() {
  document.getElementById("btn-relatorio-periodo")
    .addEventListener("click", gerarRelatorioPeriodo);
  document.getElementById("btn-relatorio-mesa")
    .addEventListener("click", gerarRelatorioMesa);
  document.getElementById("btn-relatorio-garcom")
    .addEventListener("click", gerarRelatorioGarcom);
}

async function gerarRelatorioPeriodo() {
  const inicio = document.getElementById("periodo-inicio").value;
  const fim    = document.getElementById("periodo-fim").value;
  const output = document.getElementById("report-output");

  console.log('Gerando relatório por período:', inicio, fim);

  if (!inicio || !fim) {
    alert("⚠️ Informe início e fim.");
    return;
  }

  try {
    const [pend, conf] = await Promise.all([
      fetch(`/api/reservas/pendentes?inicio=${inicio}&fim=${fim}`).then(r => r.json()),
      fetch(`/api/reservas/confirmadas?inicio=${inicio}&fim=${fim}`).then(r => r.json())
    ]);
    console.log('Dados pendentes:', pend, 'Dados confirmadas:', conf);

    const lines = [
      `Relatório de Reservas entre ${inicio} e ${fim}`,
      "===================================================="
    ];

    if (pend.length) {
      lines.push("** Reservas PENDENTES **");
      pend.forEach(r => {
        lines.push(`- Mesa ${r.mesa} | ${r.nome} | ${r.data} ${r.hora} | ${r.localizacao}`);
      });
    } else {
      lines.push("→ Nenhuma reserva pendente nesse período.");
    }
    lines.push("");
    if (conf.length) {
      lines.push("** Reservas CONFIRMADAS **");
      conf.forEach(r => {
        lines.push(`- Mesa ${r.mesa} | ${r.nome} | ${r.data} ${r.hora} | Garçom: ${r.garcom}`);
      });
    } else {
      lines.push("→ Nenhuma reserva confirmada nesse período.");
    }

    output.value = lines.join("\n");
  } catch (err) {
    console.error('Erro ao gerar relatório:', err);
    alert("❌ Erro ao buscar dados do servidor. Veja o console para detalhes.");
  }
}

async function gerarRelatorioMesa() {
  const mesa = document.getElementById("relatorio-mesa").value.trim();
  const output = document.getElementById("report-output");

  console.log('Gerando relatório por mesa:', mesa);

  if (!mesa) {
    alert("⚠️ Digite a mesa (ex: mesa-3).");
    return;
  }

  try {
    const [pend, conf] = await Promise.all([
      fetch(`/api/reservas/pendentes?mesa=${mesa}`).then(r => r.json()),
      fetch(`/api/reservas/confirmadas?mesa=${mesa}`).then(r => r.json())
    ]);
    console.log('Pendentes por mesa:', pend, 'Confirmadas por mesa:', conf);

    const lines = [
      `Relatório de Reservas para ${mesa}`,
      "======================================="
    ];

    if (pend.length) {
      lines.push("** Reservas PENDENTES **");
      pend.forEach(r => {
        lines.push(`- ${r.nome} | ${r.data} ${r.hora} | ${r.localizacao}`);
      });
    } else {
      lines.push("→ Nenhuma reserva pendente para esta mesa.");
    }
    lines.push("");
    if (conf.length) {
      lines.push("** Reservas CONFIRMADAS **");
      conf.forEach(r => {
        lines.push(`- ${r.nome} | ${r.data} ${r.hora} | Garçom: ${r.garcom}`);
      });
    } else {
      lines.push("→ Nenhuma reserva confirmada para esta mesa.");
    }

    output.value = lines.join("\n");
  } catch (err) {
    console.error('Erro relatório mesa:', err);
    alert("❌ Erro ao buscar dados do servidor.");
  }
}

async function gerarRelatorioGarcom() {
  const garcom = document.getElementById("relatorio-garcom").value.trim();
  const output = document.getElementById("report-output");

  console.log('Gerando relatório por garçom:', garcom);

  if (!garcom) {
    alert("⚠️ Digite o nome do garçom.");
    return;
  }

  try {
    const conf = await fetch(`/api/reservas/confirmadas?garcom=${encodeURIComponent(garcom)}`)
      .then(r => r.json());
    console.log('Confirmadas por garçom:', conf);

    const lines = [
      `Relatório de Mesas Confirmadas pelo Garçom: ${garcom}`,
      "===================================================="
    ];

    if (conf.length) {
      conf.forEach(r => {
        lines.push(`- Mesa ${r.mesa} | ${r.nome} | ${r.data} ${r.hora}`);
      });
    } else {
      lines.push(`→ O Garçom ${garcom} não confirmou nenhuma reserva.`);
    }

    output.value = lines.join("\n");
  } catch (err) {
    console.error('Erro relatório garçom:', err);
    alert("❌ Erro ao buscar dados do servidor.");
  }
}

// Navegação do menu
function configurarNavegacao() {
  const btnAt = document.getElementById("btn-atendente");
  const btnG  = document.getElementById("btn-garcom");
  const btnGer= document.getElementById("btn-gerente");

  const vAt = document.getElementById("atendente-view");
  const vG  = document.getElementById("garcom-view");
  const vGer= document.getElementById("gerente-view");

  function ocultaTudo() {
    vAt.classList.add("hidden");
    vG.classList.add("hidden");
    vGer.classList.add("hidden");
  }

  btnAt.addEventListener("click", () => {
    ocultaTudo();
    vAt.classList.remove("hidden");
  });
  btnG.addEventListener("click", () => {
    ocultaTudo();
    vG.classList.remove("hidden");
    renderizarPedidos();
  });
  btnGer.addEventListener("click", () => {
    ocultaTudo();
    vGer.classList.remove("hidden");
    document.getElementById("report-output").value = "";
  });

  // Aba inicial
  ocultaTudo();
  vAt.classList.remove("hidden");
}
