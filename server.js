const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const cors = require('cors');
const mqtt = require('mqtt');
const fs = require('fs');
const { parse } = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const app = express();
const server = http.createServer(app);

// Configurar CORS
app.use(cors());
app.use(express.json());

// Configurar Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Ruta para servir el index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para obtener el diccionario de tabletas
app.get('/api/tablets', (req, res) => {
  loadTabletsFromCSV((err, tablets) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cargar las tabletas' });
    }
    res.json(tablets);
  });
});

// Ruta para guardar el diccionario de tabletas
app.post('/api/tablets/save', (req, res) => {
  const tablets = req.body;
  saveTabletsToCSV(tablets, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al guardar las tabletas' });
    }
    res.json({ success: true });
  });
});

// Función para cargar tabletas desde un archivo CSV
function loadTabletsFromCSV(callback) {
  const tablets = {};
  const filePath = path.join(__dirname, 'tablets.csv');

  if (!fs.existsSync(filePath)) {
    return callback(null, tablets);
  }

  fs.createReadStream(filePath)
    .pipe(parse({ headers: true }))
    .on('data', (row) => {
      tablets[row.tabletId] = {
        lat: parseFloat(row.lat),
        lon: parseFloat(row.lon),
        estado: row.estado,
        color: row.color,
        calle: row.calle,
        lastActive: new Date(row.lastActive),
        staticSince: row.staticSince ? new Date(row.staticSince) : null
      };
    })
    .on('end', () => callback(null, tablets))
    .on('error', callback);
}

// Función para guardar tabletas en un archivo CSV
function saveTabletsToCSV(tablets, callback) {
  const filePath = path.join(__dirname, 'tablets.csv');
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'tabletId', title: 'tabletId' },
      { id: 'lat', title: 'lat' },
      { id: 'lon', title: 'lon' },
      { id: 'estado', title: 'estado' },
      { id: 'color', title: 'color' },
      { id: 'calle', title: 'calle' },
      { id: 'lastActive', title: 'lastActive' },
      { id: 'staticSince', title: 'staticSince' }
    ]
  });

  const records = Object.keys(tablets).map(id => ({
    tabletId: id,
    lat: tablets[id].lat,
    lon: tablets[id].lon,
    estado: tablets[id].estado,
    color: tablets[id].color,
    calle: tablets[id].calle,
    lastActive: tablets[id].lastActive.toISOString(),
    staticSince: tablets[id].staticSince ? tablets[id].staticSince.toISOString() : null
  }));

  csvWriter.writeRecords(records)
    .then(() => callback(null))
    .catch(callback);
}

// Configuración de MQTT
const mqttClient = mqtt.connect('mqtt://broker.emqx.io:1883');

mqttClient.on('connect', () => {
  console.log('✅ Conectado a MQTT Broker');
  mqttClient.subscribe('tablet/location', (err) => {
    if (!err) {
      console.log('📡 Suscrito al topic tablet/location');
    } else {
      console.error('❌ Error al suscribirse:', err.message);
    }
  });
});

mqttClient.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log(`📍 Datos MQTT recibidos: ${JSON.stringify(data)}`);
    io.emit('actualizarCoordenadas', data);
  } catch (err) {
    console.error('Error al parsear mensaje MQTT:', err);
  }
});

// Configuración de Socket.IO
io.on('connection', (socket) => {
  console.log('🛰️ Nuevo cliente conectado:', socket.id);

  // Enviar el diccionario de tabletas al cliente al conectarse
  loadTabletsFromCSV((err, tablets) => {
    if (!err) {
      socket.emit('initTablets', tablets);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado:', socket.id);
  });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3030;
server.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});

// Guardar tabletas cada 5 minutos
setInterval(() => {
  io.fetchSockets().then(sockets => {
    sockets.forEach(socket => {
      socket.emit('saveTablets');
    });
  });
}, 300000); // Cada 5 minutos
