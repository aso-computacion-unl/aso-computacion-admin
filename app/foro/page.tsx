import { FORUM_LOGIN_ERROR_MESSAGES, parseForumLoginError } from "@/interface/forum/forum-login-errors";
import { getForumMember } from "@/interface/forum/require-forum-member";

// Reads the session cookie: never prerendered. A bare placeholder until the forum screens (T15b) exist.
export const dynamic = "force-dynamic";

export default async function ForumHomePage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const [member, { error }] = await Promise.all([getForumMember(), searchParams]);
  const problem = parseForumLoginError(error);

  return (
    <main>
      <h1>Foro</h1>
      {problem ? <p role="alert">{FORUM_LOGIN_ERROR_MESSAGES[problem]}</p> : null}
      {member ? <p>Sesión iniciada como {member.displayName}.</p> : <a href="/foro/auth/google/start">Entrar con Google</a>}
    </main>
  );
}
