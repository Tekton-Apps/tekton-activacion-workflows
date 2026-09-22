import Link from "next/link";
import { auth, signOut } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { TektonPanel } from "@/components/TektonPanel";
import { ENTITIES, allowedEntitiesFor } from "@/lib/entities";
import { WORKFLOWS } from "@/lib/workflows";

// Server action compartida por el botón de "Cerrar sesión" del header (vía AppShell, client
// component) y por la pantalla de "sin acceso" más abajo. Sigue siendo la misma `signOut` de
// auth.ts — esto no le agrega ni le saca lógica, solo permite pasarla como prop a un client
// component (patrón soportado: server actions definidas en un Server Component se pueden pasar
// por props).
async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function Home() {
  const session = await auth();

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-tk-black to-tk-primary px-4 py-16">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto h-1 w-12 rounded-tk-full bg-tk-secondary" />
          <h1 className="mt-6 font-tk-display text-3xl italic text-white">Tekton</h1>
          <p className="mt-2 text-sm text-tk-secondary/80">
            Acceso restringido al equipo de Tekton.
          </p>
          <Link
            href="/api/auth/signin"
            className="mt-6 block w-full rounded-lg bg-tk-secondary px-4 py-2.5 text-sm font-semibold text-tk-primary transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tk-secondary"
          >
            Iniciar sesión con Google
          </Link>
        </div>
      </main>
    );
  }

  // Qué entidades puede ver esta persona. El login (auth.ts) ya exige pertenecer a AL MENOS
  // una; esto decide específicamente cuáles (hoy, siempre "tekton" o ninguna).
  const email = session.user?.email;
  const allowedEntities = allowedEntitiesFor(email);

  // Solo alcanzable si a alguien se le sacó de la whitelist después de que su sesión JWT ya se
  // emitió (revocación sin logout forzado — mismo caso que ya maneja /api/trigger). Fail-closed
  // también acá: sin esto, `tabs` quedaría vacío y CompanyTabs no renderizaría nada, una
  // pantalla en blanco sin explicación.
  if (allowedEntities.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-tk-black px-4">
        <div className="w-full max-w-sm rounded-tk-lg border border-white/10 bg-tk-primary p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-white">Sin acceso</h1>
          <p className="mt-2 text-sm text-tk-secondary/80">
            Tu cuenta ({email}) ya no tiene ningún workflow habilitado. Si esto es un error,
            avisá en el canal.
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-6 w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-tk-secondary hover:border-tk-secondary"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Fail-closed en el render: por cada workflow chequeamos server-side que existan sus env vars
  // de webhook. Si faltan, la card sale deshabilitada (TektonWorkflowCard lo maneja) en vez de
  // ofrecer un botón que terminaría en un 500. Pasar `workflow` al cliente es seguro: env guarda
  // NOMBRES de env var, no valores. La página ya es dinámica (await auth), así que process.env
  // se lee por request.
  const tektonWorkflows = WORKFLOWS.filter((workflow) => workflow.entity === "tekton").map(
    (workflow) => ({
      workflow,
      configured: Boolean(
        process.env[workflow.env.webhookUrl] && process.env[workflow.env.webhookSecret],
      ),
    }),
  );

  const tabs = ENTITIES.filter((entity) => allowedEntities.includes(entity.id)).map((entity) => ({
    id: entity.id,
    label: entity.label,
    content: <TektonPanel workflows={tektonWorkflows} />,
  }));

  return <AppShell tabs={tabs} email={email} signOutAction={signOutAction} />;
}
