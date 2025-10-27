document.addEventListener("DOMContentLoaded", () => {
  // === Inicializar mapa Mapbox ===
  mapboxgl.accessToken = 'pk.eyJ1IjoiZnJlZGR5ZmllcnJvIiwiYSI6ImNtMzk2eHFtYzExbGcyam9tZG8yN3d2aXQifQ.Yx7HsOnTVplMFrFJXMRYSw';
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-106.42, 31.62],
    zoom: 11
  });

  // === Sidebar navegación ===
  const menuItems = document.querySelectorAll(".sidebar li");
  const moduleContainer = document.getElementById("module-container");
  const moduleContent = document.getElementById("module-content");
  const closeBtn = document.getElementById("close-module");

  menuItems.forEach(item => {
    item.addEventListener("click", async () => {
      menuItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const moduleFile = item.getAttribute("data-module");

      if (moduleFile === "none") {
        moduleContainer.classList.add("hidden");
        return;
      }

      moduleContainer.classList.remove("hidden");
      moduleContent.innerHTML = `<div>Cargando ${moduleFile}...</div>`;

      try {
        const response = await fetch(`modules/${moduleFile}`);
        const html = await response.text();
        moduleContent.innerHTML = html;
      } catch (err) {
        moduleContent.innerHTML = `<div>Error al cargar el módulo.</div>`;
      }
    });
  });

  closeBtn.addEventListener("click", () => {
    moduleContainer.classList.add("hidden");
  });
});
