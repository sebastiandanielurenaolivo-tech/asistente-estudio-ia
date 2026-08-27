/*
  Asistente de estudio con IA
  Servidor local (Node nativo, sin dependencias externas).
  Llama a Cloudflare Workers AI a traves de su API REST.

  Configuracion: crea un archivo "credenciales.json" junto a este
  servidor con el siguiente contenido:

  {
    "accountId": "TU_ACCOUNT_ID",
    "apiToken": "TU_API_TOKEN"
  }

  O usa las variables de entorno CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN.
*/

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PUERTO = process.env.PORT || 3000;
const RUTA_PUBLIC = path.join(__dirname, "public");
const RUTA_CREDENCIALES = path.join(__dirname, "credenciales.json");
const RUTA_CLAVE = path.join(__dirname, "clave.json");

// Modelo por defecto de Cloudflare Workers AI (texto, gratis y rapido)
const MODELO_DEFECTO = "@cf/meta/llama-3.1-8b-instruct-fast";

// ---------- Credenciales ----------
function cargarCredenciales() {
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  let apiToken = process.env.CLOUDFLARE_API_TOKEN || "";
  let modelo = process.env.CLOUDFLARE_MODELO || "";

  if (fs.existsSync(RUTA_CREDENCIALES)) {
    try {
      const datos = JSON.parse(fs.readFileSync(RUTA_CREDENCIALES, "utf8"));
      accountId = accountId || datos.accountId || "";
      apiToken = apiToken || datos.apiToken || "";
      modelo = datos.modelo || "";
    } catch (e) {
      console.error("No se pudo leer credenciales.json:", e.message);
    }
  }

  return { accountId: accountId.trim(), apiToken: apiToken.trim(), modelo: "" };
}

// ---------- Contraseña de acceso y sesion ----------
// La contraseña se guarda en "clave.json" de forma segura (hash SHA-256 + salt),
// asi solo tu la sabes y nadie puede leerla.
const SESIONES = new Set(); // tokens de sesion activos (en memoria)

function hayClaveConfigurada() {
  return fs.existsSync(RUTA_CLAVE);
}

function leerClave() {
  try {
    const datos = JSON.parse(fs.readFileSync(RUTA_CLAVE, "utf8"));
    return { hash: String(datos.hash || ""), salt: String(datos.salt || "") };
  } catch (e) {
    return { hash: "", salt: "" };
  }
}

function ocultarClave(contrasena, salt) {
  return crypto
    .createHash("sha256")
    .update(salt + "::" + contrasena)
    .digest("hex");
}

function crearSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function guardarClave(contrasena) {
  const salt = crearSalt();
  const hash = ocultarClave(contrasena, salt);
  fs.writeFileSync(RUTA_CLAVE, JSON.stringify({ hash, salt }), "utf8");
}

function verificarClave(contrasena) {
  const { hash, salt } = leerClave();
  if (!hash || !salt) return false;
  const calculado = ocultarClave(contrasena, salt);
  return calculado === hash;
}

function generarToken() {
  const token = crypto.randomBytes(32).toString("hex");
  SESIONES.add(token);
  return token;
}

function parsearCookie(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((parte) => {
    const idx = parte.indexOf("=");
    if (idx > -1) cookies[parte.slice(0, idx).trim()] = parte.slice(idx + 1).trim();
  });
  return cookies;
}

function estaLogueado(req) {
  const cookies = parsearCookie(req.headers.cookie);
  return SESIONES.has(cookies.sesion);
}

function expulsarSesion(req) {
  const cookies = parsearCookie(req.headers.cookie);
  if (cookies.sesion) SESIONES.delete(cookies.sesion);
}

// ---------- Prompt segun el tipo de tarea ----------
function construirPromptSistema(tipo, materia) {
  const base = `Eres "Asistente de Estudio IA", un tutor amable y claro que ayuda a estudiantes de informatica.
Idioma: responde siempre en ESPAÑOL.
Estilo: explica paso a paso, con ejemplos y de forma sencilla (nivel estudiante). Si hay codigo, usa bloques de codigo con su lenguaje.
Materia de estudio del estudiante: ${materia || "informatica general"}.`;

  const tareas = {
    explicar: "Explica el concepto pedido de forma clara, con intuicion, ejemplo y un resumen final breve.",
    ejercicios: "Resuelve el ejercicio o problema paso a paso, mostrando el razonamiento y el resultado final.",
    codigo: "Escribe o corrige el codigo solicitado. Incluye comentarios breves y explica que hace cada parte importante.",
    resumen: "Haz un resumen conciso y bien organizado (ideas clave, bullet points).",
    quiz: "Genera un pequeno cuestionario de practica con 5 preguntas tipo test y sus respuestas correctas al final, para que el estudiante repase."
  };

  return base + " " + (tareas[tipo] || tareas.explicar);
}

// ---------- Llamada a Cloudflare Workers AI ----------
async function llamarWorkersAI(cred, modelo, mensajes) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${cred.accountId}/ai/run/${modelo}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cred.apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ messages: mensajes })
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Error de Workers AI (${res.status}): ${texto}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error("Workers AI devolvio un error: " + JSON.stringify(data.errors || data));
  }
  return data.result;
}

// ---------- Contenido educativo del modo demo (sin credenciales) ----------
// Permite usar la app aunque no haya conexion a Cloudflare: respuestas basicas
// y utiles de informatica segun el tema detectado en la pregunta.
function deteccionTema(texto) {
  const t = " " + texto.toLowerCase() + " ";
  const temas = [
    { clave: ["variable", "python", "javascript", "java", "c++", "c#", "html", "css", "codigo", "programa", "script", "función", "funcion", "for", "while", "if", "array", "lista", "bucle", "loop"], nombre: "programación" },
    { clave: ["base de datos", "sql", "mysql", "postgres", "tabla", "consulta", "query", "select"], nombre: "bases de datos" },
    { clave: ["red", "redes", "internet", "tcp", "ip", "router", "wifi", "protocolo", "dns", "http"], nombre: "redes" },
    { clave: ["hardware", "cpu", "ram", "disco", "procesador", "tarjeta grafica", "gpu", "placa base", "memoria"], nombre: "hardware" },
    { clave: ["sistema operativo", "windows", "linux", "macos", "archivo", "proceso", "kernel"], nombre: "sistemas operativos" },
    { clave: ["binario", "decimal", "hexadecimal", "logica", "algoritmo", "bits", "byte", "pseudocodigo", "diagrama"], nombre: "fundamentos" }
  ];
  for (const tm of temas) {
    if (tm.clave.some((k) => t.includes(k))) return tm.nombre;
  }
  return "informática";
}

function respuestaDemo(tipo, preguntas) {
  const ultimoUsuario = [...preguntas].reverse().find((m) => m.role === "user");
  const texto = ultimoUsuario ? String(ultimoUsuario.content || "") : "";
  const tema = deteccionTema(texto.toLowerCase());

  const saludos = ["hola", "buenas", "buenos dias", "buenas tardes", "qué tal", "que tal", "ayuda", "hey", "holi", "buen dia"];
  if (saludos.some((s) => texto.toLowerCase().includes(s)) && texto.length < 40 && !tipo === "quiz") {
    return `¡Hola! 👋 Soy tu asistente de estudio de informática (tema que parece interesarte: **${tema}**).

Puedo ayudarte con:
- **Explicar** un concepto → p. ej. "explica qué es una variable"
- **Resolver** un ejercicio → "pasa 255 a binario"
- **Código** → "hazme una calculadora en Python"
- **Resumen** → "resume qué es una base de datos"
- **Cuestionario** → "hazme preguntas de redes"

Escribe tu pregunta con el botón de tarea que prefieras y te ayudo. 🚀`;
  }

  if (tipo === "quiz") {
    return `## 🧠 Cuestionario de práctica (${tema})

A ver si lo sabes... respóndeme y te digo si aciertas:

**1.** ¿Qué significa **CPU**?
a) Central Processing Unit  b) Computer Public Unit  c) Central Program Union

**2.** ¿Cuántos bits tiene 1 byte?
a) 4  b) 8  c) 16

**3.** ¿En qué lenguaje se usa \`print("hola")\`?
a) JavaScript  b) Python  c) HTML

**4.** ¿Qué protocolo se usa para navegar por internet?
a) UDP  b) HTTP  c) SMTP

**5.** ¿Qué comando de SQL selecciona datos?
a) GET  b) SELECT  c) PICK

---
**Respuestas:** 1→a, 2→b, 3→b, 4→b, 5→b.

Cuando actives la IA podré generar cuestionarios personalizados sobre tu materia.`;
  }

  if (tema === "programación" && (tipo === "codigo" || tipo === "ejercicios")) {
    return `## 💻 Buenos ejemplos de código (${tema})

Como aún la conexión a la IA no está activada, te dejo ejemplos útiles para que practiques y entiendas la lógica:

**Sumar dos números** (Python):
\`\`\`python
a = int(input("Primer número: "))
b = int(input("Segundo número: "))
print("La suma es:", a + b)
\`\`\`

**Contar del 1 al 10** (JavaScript):
\`\`\`js
for (let i = 1; i <= 10; i++) {
  console.log(i);
}
\`\`\`

**Lista de frutas** (Python):
\`\`\`python
frutas = ["manzana", "plátano", "uva"]
for fruta in frutas:
  print("Me gusta la", fruta)
\`\`\`

**💡 Consejo:** pronto podrás pedir cualquier código y el asistente lo creará para ti. Solo hay que configurar la clave de Cloudflare (te explico al final).`;
  }

  if (tema === "redes") {
    return `## 🌐 Conceptos de redes

**¿Qué es una red de computadoras?**
Es un conjunto de computadoras y dispositivos conectados entre sí para compartir información y recursos (internet, impresoras, archivos).

**Tipos principales:**
- **LAN** (Red de área local): una oficina o casa.
- **WAN** (Red de área amplia): internet, conecta redes lejanas.
- **Wi-Fi / WLAN**: red inalámbrica local.

**Direcciones IP:** son el "número de casa" de cada dispositivo en la red.
- **IPv4:** 192.168.1.1 (4 números)
- **IPv6:** versión más moderna con muchos más números.

**IP vs DNS:**
- **IP** identifica máquinas (192.168.1.1).
- **DNS** traduce nombres (www.google.com) a números IP.

**💡 Consejo:** con la IA activada podré explicarte cualquier tema de redes con ejemplos y resolver tus ejercicios.`;
  }

  if (tema === "hardware") {
    return `## 🖥️ Componentes de un PC

**Los principales componentes de hardware son:**

- **CPU (Procesador):** el "cerebro" que ejecuta los programas.
- **RAM (Memoria):** almacenamiento temporal y rápido que usa el sistema mientras trabaja.
- **Disco duro / SSD:** guarda tus archivos de forma permanente.
- **GPU (Tarjeta gráfica):** procesa imágenes, vídeos y juegos.
- **Placa base:** conecta todos los componentes entre sí.
- **Fuente de alimentación:** da energía a todo.

**Diferencia entre RAM y disco:**
| | RAM | Disco duro |
|---|---|---|
| Velocidad | Muy rápida | Más lenta |
| Almacenamiento | Temporal | Permanente |
| ¿Se borra al apagar? | Sí | No |

**💡 Consejo:** cuando actives la IA podré explicarte cualquier componente a fondo y resolver tus tareas de hardware.`;
  }

  if (tema === "bases de datos") {
    return `## 🗄️ Bases de datos

**¿Qué es una base de datos?**
Es un sistema donde se guarda y organiza información para poder consultarla fácilmente (clientes, productos, notas...).

**¿Qué es una base de datos relacional?**
Guarda los datos en **tablas** que se relacionan entre sí.

**Ejemplo: tabla "alumnos"**
| id | nombre | edad |
|----|--------|------|
| 1 | Ana | 18 |
| 2 | Luis | 20 |

**Comandos SQL básicos:**
\`\`\`sql
-- Crear una tabla
CREATE TABLE alumnos (id INT, nombre TEXT);

-- Insertar un dato
INSERT INTO alumnos VALUES (1, 'Ana');

-- Consultar datos
SELECT * FROM alumnos WHERE edad > 18;
\`\`\`

**💡 Consejo:** con la IA activada podré hacerte ejercicios de SQL y explicarte todo con ejemplos.`;
  }

  // Explicacion generica segun tema
  const corto = texto.toLowerCase().includes("resume") || tipo === "resumen";
  if (corto) {
    return `## 📄 Resumen breve

**Tema sugerido:** ${tema}

**Ideas clave de informática que te conviene dominar:**
- **Algoritmo:** pasos ordenados para resolver un problema.
- **Dato vs Información:** el dato es el valor; la información es el dato con contexto.
- **Hardware vs Software:** lo físico frente a los programas.
- **Lenguaje de programación:** herramienta para decirle a la computadora qué hacer.
- **Sistema operativo:** el programa que gestiona todo (Windows, Linux...).

**Consejo de estudio:** aprende primero los conceptos y luego haz ejercicios prácticos. ¡La práctica es la clave!

> 💡 ¿Quieres un resumen específico? Escribe "resume X..." y, si activas la IA, te lo hago perfecto.`;
  }

  return `## 💡 Explicación (${tema})

Tu pregunta llamó mucho la atención. Te explico lo esencial de ${tema} en informática:

**¿Qué es ${
    tema === "programación" ? "programar" :
    tema === "redes" ? "una red" :
    tema === "hardware" ? "el hardware" :
    tema === "bases de datos" ? "una base de datos" :
    tema === "sistemas operativos" ? "un sistema operativo" :
    tema === "fundamentos" ? "un fundamento de la informática" : "este tema"
  }?**
Es una de las bases de la informática que verás en clase. Se estudia de forma teórica y práctica.

**Para entenderlo bien, recuerda:**
- Busca ejemplos cercanos a tu vida diaria.
- Haz esquemas y resúmenes propios.
- Practica con ejercicios pequeños.

**Tu pregunta fue:** _"${texto.substring(0, 100)}${texto.length > 100 ? "…" : ""}"_

> ⚡ Para una explicación **personalizada y completa**, activa la IA de Cloudflare (te explico cómo en el panel de configuración). Así podré responder exactamente a tu tarea.`;
}


// ---------- Enrutado ----------
const TIPOS = new Set(["explicar", "ejercicios", "codigo", "resumen", "quiz"]);

function leerCuerpo(req) {
  return new Promise((resolve) => {
    let cuerpo = "";
    req.on("data", (chunk) => (cuerpo += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(cuerpo || "{}")); }
      catch (e) { resolve({}); }
    });
  });
}

function manejarAPI(req, res, cred) {
  let cuerpo = "";
  req.on("data", (chunk) => (cuerpo += chunk));
  req.on("end", async () => {
    try {
      const { mensajes = [], tipo = "explicar", materia = "", modelo = "" } = JSON.parse(cuerpo || "{}");
      const tipoValido = TIPOS.has(tipo) ? tipo : "explicar";

      const modeloFinal = modelo || cred.modelo || MODELO_DEFECTO;

      if (!cred.accountId || !cred.apiToken) {
        return responderJSON(res, 200, {
          respuesta: respuestaDemo(tipoValido, mensajes),
          modelo: "demo",
          demo: true
        });
      }

      const mensajesFinales = [
        { role: "system", content: construirPromptSistema(tipoValido, materia) },
        ...mensajes
      ];

      const resultado = await llamarWorkersAI(cred, modeloFinal, mensajesFinales);
      const texto = Array.isArray(resultado?.response)
        ? resultado.response.map((p) => p.text || "").join("")
        : resultado?.response || "";

      responderJSON(res, 200, { respuesta: texto, modelo: modeloFinal, demo: false });
    } catch (err) {
      responderJSON(res, 500, { error: err.message });
    }
  });
}

function responderJSON(res, codigo, obj) {
  const cuerpo = JSON.stringify(obj);
  res.writeHead(codigo, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(cuerpo);
}

// ---------- Servidor ----------
const cred = cargarCredenciales();
if (!cred.accountId || !cred.apiToken) {
  console.log("AVISO: No hay credenciales de Cloudflare configuradas. La app funcionara en modo DEMO.");
  console.log('Crea el archivo "credenciales.json" para activar la IA real (ver README).');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);

  // ---------- Auth: estado inicial ----------
  if (req.method === "GET" && url.pathname === "/api/auth/estado") {
    return responderJSON(res, 200, {
      configurada: hayClaveConfigurada(),
      logueado: estaLogueado(req)
    });
  }

  // ---------- Auth: configurar contraseña (solo la primera vez) ----------
  if (req.method === "POST" && url.pathname === "/api/auth/configurar") {
    if (hayClaveConfigurada()) {
      return responderJSON(res, 403, { error: "La contraseña ya está configurada." });
    }
    const body = await leerCuerpo(req);
    const contrasena = String(body.contrasena || "");
    if (contrasena.length < 4) {
      return responderJSON(res, 400, { error: "La contraseña debe tener al menos 4 caracteres." });
    }
    guardarClave(contrasena);
    const token = generarToken();
    res.setHeader("Set-Cookie", `sesion=${token}; HttpOnly; Path=/; SameSite=Lax`);
    return responderJSON(res, 200, { ok: true });
  }

  // ---------- Auth: iniciar sesion ----------
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    if (!hayClaveConfigurada()) {
      return responderJSON(res, 400, { error: "Aún no hay contraseña configurada." });
    }
    const body = await leerCuerpo(req);
    if (verificarClave(String(body.contrasena || ""))) {
      const token = generarToken();
      res.setHeader("Set-Cookie", `sesion=${token}; HttpOnly; Path=/; SameSite=Lax`);
      return responderJSON(res, 200, { ok: true });
    }
    return responderJSON(res, 401, { error: "Contraseña incorrecta." });
  }

  // ---------- Auth: cerrar sesion ----------
  if (req.method === "POST" && url.pathname === "/api/auth/salir") {
    expulsarSesion(req);
    res.setHeader("Set-Cookie", "sesion=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
    return responderJSON(res, 200, { ok: true });
  }

  // ---------- Auth: cambiar contraseña ----------
  if (req.method === "POST" && url.pathname === "/api/auth/cambiar") {
    if (!estaLogueado(req)) {
      return responderJSON(res, 401, { error: "No has iniciado sesión." });
    }
    const body = await leerCuerpo(req);
    if (!verificarClave(String(body.actual || ""))) {
      return responderJSON(res, 401, { error: "La contraseña actual no es correcta." });
    }
    const nueva = String(body.nueva || "");
    if (nueva.length < 4) {
      return responderJSON(res, 400, { error: "La nueva contraseña debe tener al menos 4 caracteres." });
    }
    guardarClave(nueva);
    return responderJSON(res, 200, { ok: true });
  }

  // Endpoints protegidos: requieren iniciar sesion
  if (req.method === "POST" && url.pathname === "/api/chat") {
    if (!estaLogueado(req)) {
      return responderJSON(res, 401, { error: "Sesión no iniciada." });
    }
    return manejarAPI(req, res, cred);
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    if (!estaLogueado(req)) {
      return responderJSON(res, 401, { error: "Sesión no iniciada." });
    }
    const demo = !cred.accountId || !cred.apiToken;
    return responderJSON(res, 200, {
      demo,
      modelo: cred.modelo || "demo",
      configurado: !demo,
      necesitaConfig: demo
    });
  }

  // Archivos estaticos (protegidos, salvo que venga desde la misma pagina)
  if (!estaLogueado(req)) {
    // Permitir solo la carga de index.html, css y js de la pantalla de acceso
    if (url.pathname === "/" || url.pathname === "/index.html" ||
        url.pathname === "/style.css" || url.pathname === "/app.js") {
      // se permite abajo
    } else {
      return responderJSON(res, 401, { error: "Sesión no iniciada." });
    }
  }

  let rutaArchivo = url.pathname === "/" ? "/index.html" : url.pathname;
  let ruta = path.normalize(path.join(RUTA_PUBLIC, rutaArchivo));
  if (!ruta.startsWith(RUTA_PUBLIC)) {
    res.writeHead(403);
    return res.end("Prohibido");
  }

  fs.readFile(ruta, (err, contenido) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("No encontrado");
    }
    const ext = path.extname(ruta).toLowerCase();
    const mime = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon"
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(contenido);
  });
});

server.listen(PUERTO, () => {
  const dir = "http://localhost:" + PUERTO;
  console.log("--------------------------------------------------");
  console.log("  Asistente de Estudio IA esta corriendo");
  console.log("  Abre tu navegador en: " + dir);
  if (!hayClaveConfigurada()) {
    console.log("  Primera vez: te pedira crear tu contraseña.");
  }
  console.log("  (Cierra esta ventana para apagar la app)");
  console.log("--------------------------------------------------");
});
