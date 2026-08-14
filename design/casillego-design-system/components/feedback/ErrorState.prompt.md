Estado de error transversal. `message` debe ser el mensaje del backend; si no hay, cae a "Error desconocido". `code` es opcional, discreto, en mono, para soporte.

```jsx
<ErrorState title="No se pudieron cargar las recogidas"
  message="El servidor no respondió a tiempo." code="Error 504 · gateway_timeout"
  onRetry={refetch} />
```
