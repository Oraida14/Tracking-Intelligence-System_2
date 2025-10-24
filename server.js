const express = require("express");
const path = require("path");
const cors = require("cors");
const mqtt = require("mqtt");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Puerto del servidor
const PORT = process.env.PORT || 3030;

// Diccionario para almacenar tabletas
const tablets = {};

// --- Conexión MQTT ---
const mqttClient = mqtt.connect("mqtt://broker.emqx.io:1883");

mqttClient.on("connect", () => {
  console.log("✅ Conectado a MQTT Broker");
  mqttClient.subscribe("tablet/location", (err) => {
    if (!err) console.log("Suscrito a topic tablet/location");
  });
});

mqttClient.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const { tabletId, lat, lon } = data;

    const now = new Date();

    // Guardar o actualizar tablet
    tablets[tabletId] = {
      tabletId,
      lat,
      lon,
      timestamp: now,
      estado: "en movimiento"
    };

    console.log(`📍 ${tabletId}: ${lat}, ${lon} - ${now.toLocaleTimeString()}`);
  } catch (err) {
    console.error("Error parseando mensaje MQTT:", err);
  }
});

// --- Endpoint para obtener datos de tabletas en tiempo real ---
app.get("/api/tablets", (req, res) => {
  const now = new Date();
  const result = Object.values(tablets).map(t => {
    const diff = (now - t.timestamp) / 1000; // segundos
    const estado = diff > 60 ? "sin movimiento" : "en movimiento";
    return { ...t, estado };
  });
  res.json(result);
});

// --- Iniciar servidor ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
