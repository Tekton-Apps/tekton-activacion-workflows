import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { allowedTabsFor } from "@/lib/tabs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google],
  callbacks: {
    // El gate de login es "¿tiene ALGUNA pestaña?" — cuáles ve, lo decide page.tsx, y cada
    // API route revalida la de su pestaña puntual.
    async signIn({ profile }) {
      return allowedTabsFor(profile?.email).length > 0;
    },
  },
});
