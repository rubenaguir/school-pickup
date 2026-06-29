import { MQTT_TOPIC_ROOT } from '@casillego/shared';

export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>CasiLlego — Portal administrativo</h1>
      <p>Esqueleto. Aquí vivirá el portal (super-admin, institución, tutor).</p>
      <small>MQTT topic root: {MQTT_TOPIC_ROOT}</small>
    </main>
  );
}
