# Puerta — Consola de salida — UI kit

Recreación de la consola operativa de la persona en la puerta del colegio durante
la salida. Fila de alumnos ordenada por prioridad (en puerta → llegando → en
camino → entregado), panel de detalle con quién recoge (tutor/chofer, vehículo,
placa) y código de entrega, y acciones funcionales: **Vocear**, **Confirmar
entrega** (con avance automático al siguiente), **Deshacer**, **Reportar incidencia**.

Reutiliza el mismo sistema de 5 estados (`--status-en-route/arriving/arrived/delivered/cancelled`)
que `tablero-institucion` y `app-padre` — es la misma fila de recogida vista desde
el rol de la puerta.

Fuente: `Puerta - Consola de salida.dc.html` en el proyecto CasiLlego (mismo repo).
