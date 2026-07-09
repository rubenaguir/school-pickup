import { MQTT_TOPIC_ROOT } from '@casillego/shared';

export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>CasiLlego — Voy en camino</h1>
      <p>
        Esqueleto de la PWA del padre (Camino A: primer plano + Wake Lock + watchPosition). La
        captura de ubicación se implementará tras un
        <code> LocationProvider</code>.
      </p>
      <small>MQTT topic root: {MQTT_TOPIC_ROOT}</small>
    </main>
  );
}
