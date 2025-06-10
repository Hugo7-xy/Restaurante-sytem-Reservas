require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB conectado!'))
.catch(err => console.error('❌ Erro ao conectar MongoDB:', err));

// Definir Schema e Model
const reservaSchema = new mongoose.Schema({
  nome: String,
  data: String,
  hora: String,
  localizacao: String,
  mesa: String,
  quantidade: String,
  timestamp: String,
  garcom: String,           // existe após confirmação
  confirmedTimestamp: String
}, { timestamps: true });

const Reserva = mongoose.model('Reserva', reservaSchema);

// Middlewares
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do front‑end
app.use(express.static(path.join(__dirname, 'public')));

// Rotas REST para relatórios
app.get('/api/reservas/pendentes', async (req, res) => {
  const { inicio, fim, mesa } = req.query;
  const filtro = { garcom: { $exists: false } };
  if (mesa) filtro.mesa = mesa;
  if (inicio || fim) {
    filtro.data = {};
    if (inicio) filtro.data.$gte = inicio;
    if (fim)    filtro.data.$lte = fim;
  }
  const pendentes = await Reserva.find(filtro).lean();
  res.json(pendentes);
});

//  Confirmadas
app.get('/api/reservas/confirmadas', async (req, res) => {
  const { inicio, fim, mesa, garcom } = req.query;
  const filtro = { garcom: { $exists: true } };
  if (garcom) filtro.garcom = garcom;
  if (mesa)   filtro.mesa = mesa;
  if (inicio || fim) {
    filtro.data = {};
    if (inicio) filtro.data.$gte = inicio;
    if (fim)    filtro.data.$lte = fim;
  }
  const confirmadas = await Reserva.find(filtro).lean();
  res.json(confirmadas);
});

// Rota de status
app.get('/status', (req, res) => {
  res.json({ status: 'OK' });
});

// Lógica de WebSocket
io.on('connection', async (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  // Envia estado inicial
  const pendentes = await Reserva.find({ garcom: { $exists: false } }).lean();
  const confirmadas = await Reserva.find({ garcom: { $exists: true } }).lean();
  socket.emit('init', { pendentes, confirmadas });

  // Nova reserva
  socket.on('new-reserva', async (dados) => {
    const doc = new Reserva(dados);
    await doc.save();
    io.emit('update-reservas', { action: 'add-pendente', reserva: doc });
  });

  // Confirmar reserva
  socket.on('confirm-reserva', async ({ id, garcom }) => {
    const resv = await Reserva.findById(id);
    if (!resv) return;
    resv.garcom = garcom;
    resv.confirmedTimestamp = new Date().toLocaleString('pt-BR');
    await resv.save();
    io.emit('update-reservas', { action: 'confirm', reserva: resv });
  });

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado:', socket.id);
  });
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
