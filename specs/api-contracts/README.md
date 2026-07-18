# Convenciones compartidas de los contratos de API

Detalles que aplican a los 12 contratos de este directorio por igual, para
no repetirlos en cada uno.

## Forma de los errores

Todo error de la API responde `{ "code": "string", "message": "string" }`
— `code` en inglés y estable (cada frontend traduce por `code` en su propia
capa de i18n); `message` es texto de desarrollo/logs, nunca se muestra
directo al usuario final (ADR-028 punto 1).

### `INVALID_PAYLOAD` — la única excepción, con `details`

`INVALID_PAYLOAD` (`400`) es el único `code` del proyecto que es
**muchos-a-uno**: cubre cualquier regla de `class-validator` de cualquier
DTO, a diferencia del resto de los `code` (1-a-1 con su causa de negocio,
ej. `NOT_STUDENT_GUARDIAN`, `ENROLLMENT_NOT_APPROVED`). Por eso, y solo
para este `code`, el body incluye un campo adicional:

```json
{
  "code": "INVALID_PAYLOAD",
  "message": "The request payload is invalid.",
  "details": [
    { "property": "arrivalMode", "constraints": ["arrivalMode \"walking\" cannot be combined with vehicleId, vehicleDescription, or vehiclePlate."] }
  ]
}
```

- `details` es un arreglo con un elemento por cada `ValidationError` de
  nivel superior que reportó `class-validator` (no se recorren errores
  anidados — ningún DTO del proyecto valida objetos anidados hoy).
- `property`: el nombre del campo del DTO que falló.
- `constraints`: `Object.values(error.constraints)` — los mensajes de cada
  regla que ese campo violó.
- `constraints` sigue el mismo criterio que `message`: texto de
  desarrollo/logs, no listo para mostrar al usuario final sin traducción
  del frontend.

Ningún otro `code` (403, 404, 409, 422, etc.) lleva `details` — ya son
suficientemente específicos por sí mismos.

Ver ADR-028 (punto 1 y su enmienda de Fase 6).
