MATEMUNDO MULTIJUGADOR ONLINE

QUÉ INCLUYE
- index.html: la página MateMundo existente con un acceso al multijugador online.
- multijugador.html: pantalla para crear una sala o unirse con código desde otro dispositivo.
- server.js: servidor Node.js + Socket.IO que sincroniza las partidas.
- package.json: dependencias.

PROBAR EN TU PC
1. Instalá Node.js (versión LTS) desde https://nodejs.org/
2. Descomprimí este ZIP en una carpeta.
3. Abrí una terminal dentro de esa carpeta.
4. Ejecutá: npm install
5. Ejecutá: npm start
6. Abrí http://localhost:3000

PROBAR CON DOS DISPOSITIVOS EN LA MISMA RED
- Averiguá la IP local de la PC que ejecuta el servidor (en Windows: ipconfig).
- En el otro dispositivo abrí http://IP-DE-LA-PC:3000/multijugador.html
- Ambos deben estar en la misma red Wi-Fi y la PC debe permanecer encendida.

JUGAR POR INTERNET (DESDE CUALQUIER LUGAR)
- Este proyecto necesita un servidor público compatible con Node.js y WebSockets, no alcanza con subir solo el HTML a Netlify.
- Podés desplegarlo en un hosting Node.js como Render: creá un Web Service conectado a un repositorio Git con estos archivos.
- Build command: npm install
- Start command: npm start
- Después compartí la URL pública terminada en /multijugador.html.
- La página principal también debe alojarse en ese mismo servicio para que el enlace / funcione.

IMPORTANTE
- El servidor mantiene las salas y puntajes en memoria: si se reinicia, se cierran las salas.
- Es una primera versión de partidas 1 contra 1. No tiene cuentas persistentes ni ranking global permanente.
- No publiques claves secretas en el HTML. Este proyecto no necesita claves.
