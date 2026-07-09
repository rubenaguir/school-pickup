import { MQTT_TOPIC_ROOT } from '@casillego/shared';

export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>CasiLlego — Tablero</h1>
      <p>
        Esqueleto del tablero (PWA en modo kiosko). Mostrará los alumnos por recoger estilo
        "llegadas de aeropuerto" y usará TTS para el voceo.
      </p>
      <small>MQTT topic root: {MQTT_TOPIC_ROOT}</small>
    </main>
  );
}
