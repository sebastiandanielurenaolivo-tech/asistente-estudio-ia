# 🎓 Asistente de Estudio IA

Un asistente personal de estudio con **inteligencia artificial**, fácil de usar, pensado para ayudarte con tus tareas de **informática**: explica conceptos, resuelve ejercicios, corrige código, hace resúmenes y genera cuestionarios de práctica.

> 🔐 **Acceso protegido con contraseña.** Solo tú puedes entrar. La contraseña se guarda en tu máquina de forma encriptada.

---

## ✨ Funciones

| Función | Qué hace |
|---------|----------|
| 💡 **Explicar** | Explica conceptos de informática de forma clara y con ejemplos. |
| ✏️ **Ejercicio** | Resuelve problemas paso a paso, mostrando el razonamiento. |
| 💻 **Código** | Escribe o corrige código con comentarios y explicaciones. |
| 📄 **Resumen** | Resume textos y apuntes de forma organizada. |
| 🧠 **Cuestionario** | Genera preguntas de práctica para repasar. |

También puedes:
- Elegir la **materia** (programación, redes, bases de datos, hardware, etc.).
- **Copiar** cualquier respuesta con un clic.
- **Cambiar la contraseña** cuando quieras (botón 🔑).
- **Cerrar sesión** cuando quieras (botón 🚪).
- Iniciar una **nueva conversación**.

---

## 🚀 Cómo usarlo

1. **Instala Node.js** (versión 18 o superior): https://nodejs.org
2. Haz **doble clic** en **`Iniciar Asistente IA.bat`** (Windows).
3. Se abrirá tu navegador con la app lista para usar.
4. La **primera vez** te pedirá **crear tu contraseña de acceso**.
5. A partir de entonces, cada vez que abras la app tendrás que poner esa contraseña.

> 💻 Para **otros sistemas** (Mac/Linux), ejecuta en la terminal dentro de la carpeta:
> ```bash
> node server.js
> ```
> y abre `http://localhost:3000` en tu navegador.

---

## 🔑 Activar la IA real (Cloudflare Workers AI)

Por defecto la app funciona en **modo demo**: ya incluye contenido educativo útil de informática (explicaciones, ejemplos de código, cuestionarios), ¡así que puedes empezar a usarla de inmediato!

Para que responda de forma **personalizada y completa** con la IA real de Cloudflare:

1. Crea una cuenta gratuita en **https://dash.cloudflare.com/sign-up**.
2. Copia tu **Account ID** (en la página de inicio del panel).
3. Crea un **API Token** (perfil → API Tokens → Create Token → plantilla "Workers AI").
4. Crea un archivo **`credenciales.json`** en la carpeta de la app con:

   ```json
   {
     "accountId": "TU_ACCOUNT_ID",
     "apiToken": "TU_API_TOKEN",
     "modelo": "@cf/meta/llama-3.1-8b-instruct-fast"
   }
   ```

5. **Reinicia la app.** Ahora usará la IA de Cloudflare.

> Puedes usar cualquier otro modelo compatible de [Workers AI](https://developers.cloudflare.com/workers-ai/models/) en el campo `modelo`.

---

## 🔐 Seguridad

- La app tiene **bloqueo por contraseña**: no se puede entrar sin ella.
- La contraseña se guarda de forma **encriptada** (hash SHA-256 + salt) en `clave.json`.
- Las credenciales de Cloudflare se guardan **solo en tu máquina** en `credenciales.json`.
- Ni `clave.json` ni `credenciales.json` se suben a GitHub (están en `.gitignore`).

> 💡 **¿Olvidaste tu contraseña?** Cierra la app y borra el archivo `clave.json` de la carpeta. Al abrirla de nuevo podrás crear una nueva.

---

## 🛠️ Detalles técnicos

- **Servidor:** `server.js` — Node.js nativo, **sin dependencias externas**.
- **Interfaz:** `public/` — HTML, CSS y JavaScript.
- **IA:** Cloudflare Workers AI (vía API REST).
- **Idioma:** 100% español.
