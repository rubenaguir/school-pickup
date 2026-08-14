Fila esqueleto para estados de carga de listas. Repite 5-6 veces; conserva la silueta real (avatar + 2 líneas + badge) para que no haya salto de layout al llegar los datos.

```jsx
{Array.from({length:5}).map((_,i) => <SkeletonRow key={i}/>)}
```
