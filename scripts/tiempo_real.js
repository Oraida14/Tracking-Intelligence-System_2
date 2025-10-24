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
const speed = 0.02;
const tabletList = document.getElementById('tablet-list');

// --- Crear o actualizar marcador ---
async function updateTabletLocation(id, lat, lon, estado, color){
  const street = await getStreetFromCoords(lat, lon);
  tablets[id] = {lat, lon, estado, color, timestamp:new Date(), calle:street};
  targetPositions[id] = {lat, lon};

  if(!markers[id]){
    const el = document.createElement('div');
    el.className='marker';
    el.style.backgroundColor=color;
    if(color==='green') el.classList.add('pulse');

    markers[id] = new mapboxgl.Marker(el)
      .setLngLat([lon, lat])
      .setPopup(new mapboxgl.Popup().setText(`ID: ${id}\nEstado: ${estado}\nUbicación: ${street}`))
      .addTo(map);
  } else {
    const el = markers[id].getElement();
    el.style.backgroundColor=color;
    if(color==='green') el.classList.add('pulse'); else el.classList.remove('pulse');
    markers[id].getPopup().setText(`ID: ${id}\nEstado: ${estado}\nUbicación: ${street}`);
  }
  updateTabletList();
}

// --- Animación suave ---
function animateMarkers(){
  Object.keys(markers).forEach(id=>{
    const marker = markers[id];
    const target = targetPositions[id];
    if(!target) return;
    const [lon, lat] = marker.getLngLat().toArray();
    const dLat = target.lat - lat;
    const dLon = target.lon - lon;
    if(Math.abs(dLat)>0.00001 || Math.abs(dLon)>0.00001){
      marker.setLngLat([lon + dLon*speed, lat + dLat*speed]);
    }
  });
  requestAnimationFrame(animateMarkers);
}

// --- Actualizar lista lateral ---
function updateTabletList(){
  tabletList.innerHTML='';
  Object.keys(tablets).forEach(id=>{
    const t = tablets[id];
    const li = document.createElement('li');
    li.textContent=`${id} - ${t.estado}`;
    li.style.backgroundColor = t.color;
    li.addEventListener('click', ()=>{
      map.flyTo({center:[t.lon, t.lat], zoom:15});
      if(markers[id].getPopup()) markers[id].togglePopup();
    });
    tabletList.appendChild(li);
  });
}

// --- MQTT ---
const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
client.on('connect', ()=>client.subscribe('tablet/location'));
client.on('message', async (topic, message)=>{
  const data = JSON.parse(message.toString());
  const { tabletId, lat, lon } = data;
  let estado='en movimiento', color='green';
  if(tablets[tabletId]){
    const diff = (new Date() - tablets[tabletId].timestamp)/1000;
    if(diff>60){ estado='sin movimiento'; color='red'; }
  }
  await updateTabletLocation(tabletId, lat, lon, estado, color);
});

// --- Verificar inactividad ---
setInterval(()=>{
  const now = new Date();
  Object.keys(tablets).forEach(id=>{
    const diff = (now - tablets[id].timestamp)/1000;
    if(diff>60){
      tablets[id].estado='sin movimiento';
      tablets[id].color='red';
      const el = markers[id]?.getElement();
      if(el){ el.style.backgroundColor='red'; el.classList.remove('pulse'); }
    }
  });
  updateTabletList();
},10000);

// --- Toggle sidebar y lista ---
const sidebar = document.getElementById('sidebar');
const mapDiv = document.getElementById('map');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const toggleListBtn = document.getElementById('toggle-tablet-list');
const tabletListContainer = document.getElementById('tablet-list-container');

toggleSidebarBtn.addEventListener('click', ()=>{
  sidebar.classList.toggle('hidden');
  mapDiv.classList.toggle('shifted');
  toggleSidebarBtn.style.transform = sidebar.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)';
});

toggleListBtn.addEventListener('click', ()=> tabletListContainer.classList.toggle('hidden'));

// Iniciar animación
animateMarkers();
