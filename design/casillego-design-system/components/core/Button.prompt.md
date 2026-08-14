Botón de acción — usar `primary` (coral) para la acción dominante de la pantalla, `outline`/`ghost` para secundarias, `destructive` para rechazar/cancelar.

```jsx
<Button variant="primary" icon={<PlusIcon/>}>Invitar usuario</Button>
<Button variant="outline">Cancelar</Button>
```

Variantes: `primary` (fondo coral, sombra de marca), `outline` (borde gris, fondo blanco), `ghost` (sin fondo/borde), `destructive` (rojo suave, para Rechazar), `subtle` (tinte coral, para acciones secundarias de marca). Tamaños `sm`/`md`/`lg`. Nunca uses el coral en más de una acción primaria por vista.
