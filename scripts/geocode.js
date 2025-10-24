// --- Geocoding inverso ---
async function getStreetFromCoords(lat, lon){
  try{
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${mapboxgl.accessToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if(data.features && data.features.length>0){
      const f = data.features.find(f=>f.place_type.includes('street') || f.place_type.includes('address'));
      return f ? f.text : data.features[0].place_name;
    }
  }catch(e){ console.error("Error geocoding:", e);}
  return "Calle desconocida";
}

// --- Actualizar popup y diccionario con calle ---
async function updateTabletLocation(tabletId, lat, lon, estado, color) {
  const street = await getStreetFromCoords(lat, lon);

  // Actualizar diccionario
  tablets[tabletId] = {lat, lon, estado, color, timestamp: new Date(), calle: street};

  // Crear o actualizar marcador
  if (!markers[tabletId]) {
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.width='14px';
    el.style.height='14px';
    el.style.borderRadius='50%';
    el.style.backgroundColor = color;

    markers[tabletId] = new mapboxgl.Marker(el)
      .setLngLat([lon, lat])
      .setPopup(new mapboxgl.Popup().setText(`ID: ${tabletId}\nEstado: ${estado}\nUbicación: ${street}`))
      .addTo(map);
  } else {
    moveMarkerSmooth(markers[tabletId], [lon, lat], 1000);
    markers[tabletId].getElement().style.backgroundColor = color;
    markers[tabletId].getPopup().setText(`ID: ${tabletId}\nEstado: ${estado}\nUbicación: ${street}`);
  }

  updateTabletList();
}



// --- MQTT ---
client.on('message', async (topic, message) => {
  const data = JSON.parse(message.toString());
  const { tabletId, lat, lon } = data;

  // Estado según movimiento
  let estado = 'en movimiento';
  let color = 'green';
  if (tablets[tabletId]) {
    const diff = (new Date() - tablets[tabletId].timestamp)/1000;
    if (diff > 60) { estado = 'sin movimiento'; color = 'red'; }
  }

  // Actualizar ubicación, popup y lista
  await updateTabletLocation(tabletId, lat, lon, estado, color);
});
