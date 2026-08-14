Avatar circular con iniciales. Pasa `index` (posición en la lista) para rotar automáticamente entre los 6 acentos — nunca fijes el mismo color para todos los avatares de una lista.

```jsx
{users.map((u, i) => <Avatar key={u.id} name={u.name} index={i} />)}
```
