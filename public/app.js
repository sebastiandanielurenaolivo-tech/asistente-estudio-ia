const $entrada = document.getElementById("entrada");
const $mensajes = document.getElementById("mensajes");
const $btnEnviar = document.getElementById("btn-enviar");
const $btnNuevo = document.getElementById("btn-nuevo");
const $materia = document.getElementById("materia");
const $tituloTarea = document.getElementById("titulo-tarea");
const $estadoTexto = document.getElementById("status-text");
const $estadoDot = document.querySelector(".status-dot");
const $overlay = document.getElementById("overlay");
const $sugerencias = document.getElementById("sugerencias");
const $nota = document.getElementById("nota");

const $login = document.getElementById("login");
const $loginConfig = document.getElementById("login-config");
const $loginEntrar = document.getElementById("login-entrar");
const $configClave = document.getElementById("config-clave");
const $configClave2 = document.getElementById("config-clave2");
const $loginClave = document.getElementById("login-clave");
const $btnConfig = document.getElementById("btn-config");
const $btnEntrar = document.getElementById("btn-entrar");
const $configError = document.getElementById("config-error");
const $loginError = document.getElementById("login-error");
const $btnSalir = document.getElementById("btn-salir");
const $btnCambiarClave = document.getElementById("btn-cambiar-clave");
const $overlayCambiar = document.getElementById("overlay-cambiar");
const $cambiarActual = document.getElementById("cambiar-actual");
const $cambiarNueva = document.getElementById("cambiar-nueva");
const $cambiarNueva2 = document.getElementById("cambiar-nueva2");
const $cambiarError = document.getElementById("cambiar-error");
const $btnCambiar = document.getElementById("btn-cambiar");

let tipoActivo = "explicar";
let historial = [];
let generando = false;

const TAREAS = {
  explicar: { titulo: "💡 Explicar conceptos", sugerencias: ["¿Qué es una variable en programación?", "Explica qué es el sistema binario", "¿Qué es HTML y para qué sirve?"] },
  ejercicios: { titulo: "✏️ Resolver ejercicios", sugerencias: ["Resuelve: pasar 255 de decimal a binario", "Ejercicio de operadores lógicos", "Explica las partes de un algoritmo"] },
  codigo: { titulo: "💻 Ayuda con código", sugerencias: ["Escribe un programa en Python que sume dos números", "¿Cómo se hace un for en JavaScript?", "Corrige este código..."] },
  resumen: { titulo: "📄 Hacer resúmenes", sugerencias: ["Resume qué es una base de datos relacional", "Resumen corto sobre redes de computadoras", "Resume los tipos de datos en Python"] },
  quiz: { titulo: "🧠 Cuestionario de práctica", sugerencias: ["Hazme un cuestionario de programación básica", "Preguntas de redes de computadoras", "Quiz sobre hardware de PC"] }
};

function renderMarkdown(texto) {
  const escapado = texto
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const conBloques = escapado.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, codigo) => {
    return `<pre><code class="lang-${lang || "texto"}">${codigo}</code></pre>`;
  });

  const conLineas = conBloques.split("\n").map((linea) => {
    if (linea.startsWith("<pre>")) return linea;
    if (linea.startsWith("#### ")) return `<h4>${linea.slice(5).replace(/\*\*/g, "").replace(/\*/g, "").replace(/\`/g, "")}</h4>`;
    if (linea.startsWith("### ")) return `<h3>${linea.slice(4).replace(/\*\*/g, "").replace(/\*/g, "").replace(/\`/g, "")}</h3>`;
    if (linea.startsWith("## ")) return `<h2>${linea.slice(3).replace(/\*\*/g, "").replace(/\*/g, "").replace(/\`/g, "")}</h2>`;
    if (linea.startsWith("# ")) return `<h1>${linea.slice(2).replace(/\*\*/g, "").replace(/\*/g, "").replace(/\`/g, "")}</h1>`;
    if (/^\s*[-*]\s+/.test(linea)) return `<li>${linea.replace(/^\s*[-*]\s+/, "").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>")}</li>`;
    if (/^\s*\d+\.\s+/.test(linea)) return `<li data-order="1">${linea.replace(/^\s*\d+\.\s+/, "").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>")}</li>`;
    if (linea.trim() === "") return "";
    return `<p>${linea.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>")}</p>`;
  });

  // Agrupar listas consecutivas
  let listaUl = [], listaOl = [], resultado = [];
  const cerrarListas = () => {
    if (listaUl.length) { resultado.push(`<ul>${listaUl.join("")}</ul>`); listaUl = []; }
    if (listaOl.length) { resultado.push(`<ol>${listaOl.join("")}</ol>`); listaOl = []; }
  };
  conLineas.forEach((l) => {
    if (l.startsWith('<li data-order="1">')) {
      cerrarListas();
      listaOl.push(l.replace('data-order="1"', ""));
      listaUl = [];
    } else if (l.startsWith("<li>")) {
      cerrarListas();
      listaUl.push(l);
    } else {
      if (listaUl.length || listaOl.length) cerrarListas();
      resultado.push(l);
    }
  });
  cerrarListas();

  return resultado.join("");
}

function agregarMensaje(rol, texto, guardar = true) {
  const div = document.createElement("div");
  div.className = `mensaje ${rol}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar " + (rol === "asistente" ? "asistente-avatar" : "usuario-avatar");
  avatar.textContent = rol === "asistente" ? "🤖" : "👤";

  const burbuja = document.createElement("div");
  burbuja.className = "burbuja";

  if (rol === "asistente" && texto) {
    burbuja.innerHTML = renderMarkdown(texto);
    const acciones = document.createElement("div");
    acciones.className = "acciones";
    const btnCopiar = document.createElement("button");
    btnCopiar.textContent = "📋 Copiar";
    btnCopiar.onclick = () => {
      navigator.clipboard.writeText(texto).then(() => {
        btnCopiar.textContent = "✅ Copiado";
        setTimeout(() => (btnCopiar.textContent = "📋 Copiar"), 1500);
      });
    };
    acciones.appendChild(btnCopiar);
    burbuja.appendChild(acciones);
  } else {
    burbuja.textContent = texto;
  }

  div.appendChild(avatar);
  div.appendChild(burbuja);
  $mensajes.appendChild(div);
  $mensajes.scrollTop = $mensajes.scrollHeight;

  if (guardar && rol === "usuario") historial.push({ role: "user", content: texto });
  return div;
}

function mostrarEscribiendo() {
  const div = document.createElement("div");
  div.className = "mensaje asistente";
  div.id = "escribiendo";
  div.innerHTML = `<div class="avatar asistente-avatar">🤖</div><div class="burbuja"><div class="escritura"><span></span><span></span><span></span></div></div>`;
  $mensajes.appendChild(div);
  $mensajes.scrollTop = $mensajes.scrollHeight;
}

function quitarEscribiendo() {
  const el = document.getElementById("escribiendo");
  if (el) el.remove();
}

function marcarEstado(estado, texto) {
  $estadoDot.className = "status-dot " + estado;
  $estadoTexto.textContent = texto;
}

function actualizarSugerencias() {
  $sugerencias.innerHTML = "";
  TAREAS[tipoActivo].sugerencias.forEach((s) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = s;
    chip.onclick = () => {
      $entrada.value = s;
      enviar();
    };
    $sugerencias.appendChild(chip);
  });
}

function seleccionarTarea(tipo) {
  tipoActivo = tipo;
  document.querySelectorAll(".task-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tipo === tipo);
  });
  $tituloTarea.textContent = TAREAS[tipo].titulo;
  actualizarSugerencias();
}

async function enviar() {
  const texto = $entrada.value.trim();
  if (!texto || generando) return;

  generando = true;
  $btnEnviar.disabled = true;
  agregarMensaje("usuario", texto, true);
  $entrada.value = "";
  $nota.textContent = "Consultando a la IA...";
  mostrarEscribiendo();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensajes: historial,
        tipo: tipoActivo,
        materia: $materia.value
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    quitarEscribiendo();
    const div = agregarMensaje("asistente", data.respuesta, false);
    if (data.demo) {
      marcarEstado("demo", "Modo demo — sin IA");
    } else {
      marcarEstado("on", "Conectado a Workers AI");
    }
    historial.push({ role: "assistant", content: data.respuesta });
  } catch (err) {
    quitarEscribiendo();
    agregarMensaje("asistente", `⚠️ Ocurrió un error: ${err.message}`, false);
    marcarEstado("off", "Error");
  } finally {
    generando = false;
    $btnEnviar.disabled = false;
    $nota.textContent = "";
    $entrada.focus();
  }
}

function abrirOverlay() { $overlay.classList.add("mostrar"); }
function cerrarOverlay() { $overlay.classList.remove("mostrar"); }

$btnEnviar.addEventListener("click", enviar);
$entrada.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    enviar();
  }
});
$entrada.addEventListener("input", () => {
  $entrada.style.height = "auto";
  $entrada.style.height = Math.min($entrada.scrollHeight, 140) + "px";
});
$btnNuevo.addEventListener("click", () => {
  historial = [];
  $mensajes.innerHTML = "";
  agregarMensaje("asistente", "👋 Nueva conversación iniciada. ¿En qué te ayudo hoy?", false);
});
document.querySelectorAll(".task-btn").forEach((b) => {
  b.addEventListener("click", () => seleccionarTarea(b.dataset.tipo));
});
document.getElementById("btn-cerrar-aviso").addEventListener("click", cerrarOverlay);
$overlay.addEventListener("click", (e) => { if (e.target === $overlay) cerrarOverlay(); });

// ---------- Acceso con contraseña ----------
function mostrarLogin() { $login.classList.add("mostrar"); }
function ocultarLogin() { $login.classList.remove("mostrar"); }

function modoLogin(configurar) {
  $loginConfig.style.display = configurar ? "" : "none";
  $loginEntrar.style.display = configurar ? "none" : "";
  if (configurar) $configClave.focus();
  else $loginClave.focus();
}

$btnConfig.addEventListener("click", async () => {
  const c1 = $configClave.value;
  const c2 = $configClave2.value;
  $configError.textContent = "";
  if (c1.length < 4) return ($configError.textContent = "La contraseña debe tener al menos 4 caracteres.");
  if (c1 !== c2) return ($configError.textContent = "Las contraseñas no coinciden.");
  try {
    const res = await fetch("/api/auth/configurar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contrasena: c1 })
    });
    const data = await res.json();
    if (data.error) return ($configError.textContent = data.error);
    $configClave.value = $configClave2.value = "";
    entrarApp();
  } catch (e) {
    $configError.textContent = "Error de conexión: " + e.message;
  }
});

$btnEntrar.addEventListener("click", async () => {
  const c = $loginClave.value;
  $loginError.textContent = "";
  if (!c) return ($loginError.textContent = "Escribe tu contraseña.");
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contrasena: c })
    });
    const data = await res.json();
    if (data.error) {
      $loginError.textContent = data.error;
      $loginClave.value = "";
      $loginClave.focus();
      return;
    }
    $loginClave.value = "";
    entrarApp();
  } catch (e) {
    $loginError.textContent = "Error de conexión: " + e.message;
  }
});

function entrarApp() {
  ocultarLogin();
  marcarEstado("demo", "Verificando IA...");
  actualizarSugerencias();
  comprobarEstado();
  $entrada.focus();
}

$btnSalir.addEventListener("click", async () => {
  try { await fetch("/api/auth/salir", { method: "POST" }); } catch (e) {}
  historial = [];
  $mensajes.innerHTML = "";
  agregarMensaje("asistente", "👋 Sesión cerrada. ¡Hasta pronto!", false);
  $loginError.textContent = "";
  $loginClave.value = "";
  modoLogin(false);
  mostrarLogin();
  $loginClave.focus();
});

function cerrarCambiar() { $overlayCambiar.classList.remove("mostrar"); }
$btnCambiarClave.addEventListener("click", () => {
  $cambiarActual.value = $cambiarNueva.value = $cambiarNueva2.value = "";
  $cambiarError.textContent = "";
  $overlayCambiar.classList.add("mostrar");
  $cambiarActual.focus();
});
$overlayCambiar.addEventListener("click", (e) => { if (e.target === $overlayCambiar) cerrarCambiar(); });

$btnCambiar.addEventListener("click", async () => {
  $cambiarError.textContent = "";
  const actual = $cambiarActual.value;
  const nueva = $cambiarNueva.value;
  const nueva2 = $cambiarNueva2.value;
  if (!actual) return ($cambiarError.textContent = "Escribe tu contraseña actual.");
  if (nueva.length < 4) return ($cambiarError.textContent = "La nueva contraseña debe tener al menos 4 caracteres.");
  if (nueva !== nueva2) return ($cambiarError.textContent = "Las nuevas contraseñas no coinciden.");
  try {
    const res = await fetch("/api/auth/cambiar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual, nueva })
    });
    const data = await res.json();
    if (data.error) return ($cambiarError.textContent = data.error);
    alert("✅ Contraseña cambiada correctamente.");
    cerrarCambiar();
  } catch (e) {
    $cambiarError.textContent = "Error de conexión: " + e.message;
  }
});

// Comprobar el estado del servidor al iniciar
async function comprobarEstado() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    if (data.demo) {
      marcarEstado("demo", "Modo demo — sin IA");
      abrirOverlay();
    } else {
      marcarEstado("on", "Conectado a Workers AI");
    }
  } catch (err) {
    marcarEstado("off", "Sin conexión al servidor");
  }
}

// Inicializacion: comprobar si hay que entrar con contraseña
async function iniciar() {
  try {
    const res = await fetch("/api/auth/estado");
    const data = await res.json();
    if (!data.logueado) {
      modoLogin(!data.configurada);
      mostrarLogin();
      return;
    }
    entrarApp();
  } catch (e) {
    marcarEstado("off", "Sin conexión al servidor");
  }
}

iniciar();
