import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { ENTITIES } from "@/lib/entities";
import { isEmailAllowed } from "@/lib/allowed-emails";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google],
  callbacks: {
    // El gate de login es "¿pertenece a ALGUNA entidad?" — cuál puede ver, lo decide cada
    // página (hoy, con una sola entidad, siempre Tekton o ninguna).
    async signIn({ profile }) {
      return ENTITIES.some((entity) => isEmailAllowed(profile?.email, entity.allowedEmailsEnv));
    },
  },
});
