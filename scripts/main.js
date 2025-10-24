document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  const menuItems = document.querySelectorAll(".sidebar nav li");
  const mainContent = document.getElementById("page-container");
  const themeToggle = document.getElementById("theme-toggle");
  const menuToggle = document.getElementById("menu-toggle");

  // === Cargar páginas dinámicamente ===
  async function loadPage(page) {
    mainContent.innerHTML = `<div class="loading">Cargando ${page}...</div>`;
    try {
      const response = await fetch(`pages/${page}`);
      const html = await response.text();
      mainContent.innerHTML = html;
    } catch (err) {
      mainContent.innerHTML = `<div class="loading">❌ Error al cargar la página</div>`;
      console.error(err);
    }
  }

  // === Navegación lateral ===
  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      menuItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      const page = item.getAttribute("data-page");
      loadPage(page);
      if (window.innerWidth <= 768) sidebar.classList.remove("active");
    });
  });

  // === Toggle de menú ===
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("active");
  });

  // === Toggle de tema (oscuro/claro) ===
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    themeToggle.textContent = isLight ? "☀️" : "🌙";
  });

  // === Cargar primera página ===
  loadPage("tiempo_real.html");
});
