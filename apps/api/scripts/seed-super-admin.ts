/**
 * Siembra (o actualiza) un usuario super-admin.
 *
 *   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... npm run seed:super-admin -w @casillego/api
 *
 * Las credenciales se leen del entorno, nunca del código: el repo no debe
 * contener una contraseña utilizable. `AppDataSource` ya carga el `.env` de la
 * raíz, así que definirlas ahí también funciona.
 *
 * Es un script, no una migración: una migración correría en todos los
 * entornos, y una cuenta con contraseña conocida solo tiene sentido en
 * desarrollo. Idempotente — reejecutarlo sobre el mismo correo actualiza la
 * contraseña y reafirma el flag en vez de fallar por la constraint de
 * unicidad. Ver `specs/entities/user.md` (`is_super_admin`) y ADR-038.
 */
import { AppDataSource } from '../src/database/data-source';
import { hashPassword } from '../src/auth/password.util';
import { User } from '@casillego/shared/entities';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required. Usage: SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... npm run seed:super-admin -w @casillego/api`,
    );
  }
  return value;
}

async function main(): Promise<void> {
  const email = requireEnv('SUPER_ADMIN_EMAIL');
  const password = requireEnv('SUPER_ADMIN_PASSWORD');
  const fullName = process.env.SUPER_ADMIN_FULL_NAME ?? 'Super Admin';

  await AppDataSource.initialize();
  try {
    const users = AppDataSource.getRepository(User);
    // Misma función que usa el registro real (apps/api/src/auth/password.util.ts),
    // para que el hash sea indistinguible del de cualquier otra cuenta.
    const passwordHash = await hashPassword(password);

    const existing = await users.findOneBy({ email });
    const user = users.create({
      ...(existing ?? {}),
      email,
      passwordHash,
      fullName,
      // `active` con password_hash y full_name no nulos: la invariante de
      // specs/entities/user.md para una cuenta que puede iniciar sesión.
      status: 'active',
      isSuperAdmin: true,
    });

    const saved = await users.save(user);
    process.stdout.write(
      `${existing ? 'Updated' : 'Created'} super-admin ${saved.email} (${saved.id})\n`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
