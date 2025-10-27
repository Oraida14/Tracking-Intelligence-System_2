document.addEventListener('DOMContentLoaded', () => {
  const tabletList = document.getElementById('tablet-list');
  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  mapboxgl.accessToken = 'pk.eyJ1IjoiZnJlZGR5ZmllcnJvIiwiYSI6ImNtMzk2eHFtYzExbGcyam9tZG8yN3d2aXQifQ.Yx7HsOnTVplMFrFJXMRYSw';

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-106.42, 31.62],
    zoom: 11
  });

  const markers = {};
  const tablets = {};
  const targetPositions = {};
  const tabletAlerts = {};
  const staticTablets = {};
  const speed = 0.02;

  // Conectar a Socket.IO
  const socket = io('http://localhost:3030');

  // Recibir el diccionario de tabletas al conectarse
  socket.on('initTablets', (initialTablets) => {
    Object.keys(initialTablets).forEach(id => {
      const tablet = initialTablets[id];
      tablets[id] = tablet;
      updateMarker(id, tablet.lat, tablet.lon, tablet.estado, tablet.color, tablet.calle, tablet.lastActive);
    });
    updateTabletList();
  });

  // Guardar tabletas al recibir la señal del servidor
  socket.on('saveTablets', () => {
    saveTabletsToServer();
  });

  socket.on('actualizarCoordenadas', async (data) => {
    const { tabletId, lat, lon } = data;
    let estado = 'en movimiento';
    let color = 'green';
    await updateTabletLocation(tabletId, lat, lon, estado, color);
  });

  // Manejar clics en el menú
  document.querySelectorAll('.sidebar li').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
      item.classList.add('active');
      const module = item.getAttribute('data-module');
      if (module === 'alertas.html') {
        loadModule('alerts');
      }
    });
  });

  // Evento para cerrar el módulo
  document.getElementById('close-module').addEventListener('click', () => {
    document.getElementById('module-container').classList.add('hidden');
  });

  // Función para cargar módulos
  function loadModule(module) {
    const moduleContainer = document.getElementById('module-container');
    const moduleContent = document.getElementById('module-content');

    // Ocultar todos los módulos
    document.querySelectorAll('.module').forEach(el => el.classList.add('hidden'));

    // Mostrar el módulo seleccionado
    if (module === 'alerts') {
      document.getElementById('alerts-module').classList.remove('hidden');
      moduleContainer.classList.remove('hidden');
      updateAlertsList();
    }
  }

  // Función para obtener la calle a partir de coordenadas
  async function getStreetFromCoords(lat, lon) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${mapboxgl.accessToken}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const f = data.features.find(f => f.place_type.includes('street') || f.place_type.includes('address'));
        return f ? f.text : data.features[0].place_name;
      }
    } catch (e) {
      console.error("Error geocoding:", e);
    }
    return "Calle desconocida";
  }

  // Función para actualizar un marcador
  function updateMarker(id, lat, lon, estado, color, calle, lastActive) {
    if (!markers[id]) {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      if (color === 'green') el.classList.add('pulse');

      const popupContent = `
        <div class="popup-content">
          <h3>${id}</h3>
          <p><strong>Estado:</strong> ${estado}</p>
          <p><strong>Ubicación:</strong> ${calle}</p>
          <p><strong>Última actualización:</strong> ${new Date(lastActive).toLocaleString()}</p>
        </div>
      `;

      markers[id] = new mapboxgl.Marker(el)
        .setLngLat([lon, lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
        .addTo(map);
    } else {
      moveMarkerSmooth(markers[id], [lon, lat], 1000);
      markers[id].getElement().style.backgroundColor = color;

      const popupContent = `
        <div class="popup-content">
          <h3>${id}</h3>
          <p><strong>Estado:</strong> ${estado}</p>
          <p><strong>Ubicación:</strong> ${calle}</p>
          <p><strong>Última actualización:</strong> ${new Date(lastActive).toLocaleString()}</p>
        </div>
      `;
      markers[id].setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent));
    }
  }

  // Función para actualizar la ubicación de las tabletas
  async function updateTabletLocation(tabletId, lat, lon, estado, color) {
    const street = await getStreetFromCoords(lat, lon);
    const now = new Date();

    // Registrar la tableta en el diccionario
    if (!tablets[tabletId]) {
      tablets[tabletId] = {
        lat,
        lon,
        estado,
        color,
        timestamp: now,
        calle: street,
        lastActive: now,
        staticSince: null,
        alertas: []
      };
    } else {
      tablets[tabletId].lat = lat;
      tablets[tabletId].lon = lon;
      tablets[tabletId].estado = estado;
      tablets[tabletId].color = color;
      tablets[tabletId].timestamp = now;
      tablets[tabletId].calle = street;
      tablets[tabletId].lastActive = now;
    }

    targetPositions[tabletId] = { lat, lon };
    updateMarker(tabletId, lat, lon, estado, color, street, now);
    updateTabletList();
  }

  // Función para guardar las tabletas en el servidor
  function saveTabletsToServer() {
    fetch('/api/tablets/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tablets),
    })
    .then(response => response.json())
    .then(data => console.log('Tabletas guardadas:', data))
    .catch(error => console.error('Error al guardar tabletas:', error));
  }

  // Función para verificar tabletas inactivas y estáticas
  function checkInactiveTablets() {
    const now = new Date();
    const fifteenMinutes = 15 * 60 * 1000; // 15 minutos en milisegundos
    const sixtyMinutes = 60 * 60 * 1000; // 60 minutos en milisegundos

    Object.keys(tablets).forEach(id => {
      const tablet = tablets[id];
      const diff = now - tablet.lastActive;

      // Si la tableta no ha enviado datos en 15 minutos
      if (diff > fifteenMinutes && !tabletAlerts[id]) {
        tabletAlerts[id] = {
          type: 'inactive',
          message: `La tableta ${id} dejó de enviar datos.`,
          location: tablet.calle,
          time: now.toLocaleString(),
          lat: tablet.lat,
          lon: tablet.lon
        };
        console.log(`⚠️ Alerta: La tableta ${id} dejó de enviar datos.`);
      }

      // Verificar si la tableta está estática
      if (tablet.staticSince) {
        const staticDuration = now - tablet.staticSince;

        // Si la tableta está estática por más de 15 minutos
        if (staticDuration > fifteenMinutes && !staticTablets[id]) {
          staticTablets[id] = {
            startTime: tablet.staticSince,
            location: tablet.calle,
            lat: tablet.lat,
            lon: tablet.lon
          };
          tablets[id].color = 'yellow';
          if (markers[id]) {
            markers[id].getElement().style.backgroundColor = 'yellow';
            const popup = markers[id].getPopup();
            const popupContent = `
              <div class="popup-content">
                <h3>${id}</h3>
                <p><strong>Estado:</strong> estático (más de 15 min)</p>
                <p><strong>Ubicación:</strong> ${tablet.calle}</p>
                <p><strong>Última actualización:</strong> ${tablet.timestamp.toLocaleString()}</p>
              </div>
            `;
            popup.setHTML(popupContent);
          }
        }

        // Si la tableta está estática por más de 60 minutos
        if (staticDuration > sixtyMinutes) {
          tablets[id].color = 'red';
          if (markers[id]) {
            markers[id].getElement().style.backgroundColor = 'red';
            const popup = markers[id].getPopup();
            const popupContent = `
              <div class="popup-content">
                <h3>${id}</h3>
                <p><strong>Estado:</strong> estático (más de 60 min)</p>
                <p><strong>Ubicación:</strong> ${tablet.calle}</p>
                <p><strong>Última actualización:</strong> ${tablet.timestamp.toLocaleString()}</p>
              </div>
            `;
            popup.setHTML(popupContent);
          }
        }
      }
    });

    updateAlertsList();
  }

  // Función para mover marcadores suavemente
  function moveMarkerSmooth(marker, target, duration) {
    const start = marker.getLngLat();
    const startTime = Date.now();
    const endTime = startTime + duration;

    function animate() {
      const now = Date.now();
      const progress = Math.min(1, (now - startTime) / duration);
      const currentLng = start.lng + (target[0] - start.lng) * progress;
      const currentLat = start.lat + (target[1] - start.lat) * progress;
      marker.setLngLat([currentLng, currentLat]);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    requestAnimationFrame(animate);
  }

  // Función para actualizar la lista de tabletas
  function updateTabletList() {
    if (!tabletList) return;
    tabletList.innerHTML = '';
    Object.keys(tablets).forEach(id => {
      const t = tablets[id];
      const li = document.createElement('li');
      li.textContent = `${id} - ${t.estado}`;
      li.style.backgroundColor = t.color;
      li.addEventListener('click', () => {
        map.flyTo({ center: [t.lon, t.lat], zoom: 15 });
        if (markers[id].getPopup()) markers[id].togglePopup();
      });
      tabletList.appendChild(li);
    });
  }

  // Función para actualizar la lista de alertas
  function updateAlertsList() {
    const alertsList = document.getElementById('alerts-list');
    const staticList = document.getElementById('static-tablets-list');

    if (alertsList) {
      alertsList.innerHTML = '';
      Object.keys(tabletAlerts).forEach(id => {
        const alert = tabletAlerts[id];
        const li = document.createElement('li');
        li.innerHTML = `
          <div class="alert-item">
            <h4>${alert.message}</h4>
            <p><strong>Tableta:</strong> ${id}</p>
            <p><strong>Ubicación:</strong> ${alert.location}</p>
            <p><strong>Hora:</strong> ${alert.time}</p>
          </div>
        `;
        alertsList.appendChild(li);
      });
    }

    if (staticList) {
      staticList.innerHTML = '';
      Object.keys(staticTablets).forEach(id => {
        const staticTablet = staticTablets[id];
        const duration = Math.floor((new Date() - staticTablet.startTime) / 1000 / 60); // Duración en minutos
        const li = document.createElement('li');
        li.innerHTML = `
          <div class="static-item">
            <h4>Tableta estática: ${id}</h4>
            <p><strong>Ubicación:</strong> ${staticTablet.location}</p>
            <p><strong>Tiempo estática:</strong> ${duration} minutos</p>
            <p><strong>Hora de inicio:</strong> ${staticTablet.startTime.toLocaleString()}</p>
          </div>
        `;
        staticList.appendChild(li);
      });
    }
  }

  // Verificar inactividad cada minuto
  setInterval(checkInactiveTablets, 60000);

  // Verificar inactividad cada 10 segundos para actualizar la lista de tabletas
  setInterval(() => {
    const now = new Date();
    Object.keys(tablets).forEach(id => {
      const diff = (now - tablets[id].timestamp) / 1000;
      if (diff > 60) {
        tablets[id].estado = 'sin movimiento';
        tablets[id].color = 'red';
        const el = markers[id]?.getElement();
        if (el) { el.style.backgroundColor = 'red'; el.classList.remove('pulse'); }
      }
    });
    updateTabletList();
  }, 10000);

  animateMarkers();
  function animateMarkers() {
    Object.keys(markers).forEach(id => {
      const marker = markers[id];
      const target = targetPositions[id];
      if (!target) return;
      const [lon, lat] = marker.getLngLat().toArray();
      const dLat = target.lat - lat;
      const dLon = target.lon - lon;
      if (Math.abs(dLat) > 0.00001 || Math.abs(dLon) > 0.00001) {
        marker.setLngLat([lon + dLon * speed, lat + dLat * speed]);
      }
    });
    requestAnimationFrame(animateMarkers);
  }
});
