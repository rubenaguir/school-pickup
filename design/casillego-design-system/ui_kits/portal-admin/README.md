# Portal admin — UI kit

Recreación del portal web de administración, con selector de rol arriba:

- **Institución** — sidebar con Dashboard (enlaza al kit Tablero), Aprobaciones
  (tarjetas Aprobar/Rechazar funcionales), **Institución** (datos generales,
  puntos de entrega, tolerancia/avisos, coordinación de salida), **Horarios**
  (ventanas de salida por turno + días especiales), **Personal** (tabla de
  accesos con roles), **Reportes** (KPIs, entregas por día, puntualidad por nivel).
- **Operador global (OPS)** — consola del operador de toda la plataforma:
  **Resumen** (KPIs, gráfico de recogidas por día, top instituciones),
  **Instituciones** (validar/rechazar altas, filtro Escuelas/Actividades),
  **Usuarios** (tabla de equipo interno con roles y filtro), **Configuración**
  (identidad, reglas de recogida, toggles de notificaciones/seguridad).

Fuente: `Portal - Administración.dc.html`, `Portal - Bandeja de aprobación.dc.html`
y `Super-admin - Operador YaVoy.dc.html` en el proyecto CasiLlego (mismo repo) —
el Dashboard en vivo del rol Institución no está replicado aquí a detalle (ver
el kit `tablero-institucion`).
