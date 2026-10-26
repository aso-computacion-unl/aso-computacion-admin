import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/icons";
import { parseForumLoginError } from "@/interface/forum/forum-login-errors";
import { getForumCategories } from "@/interface/forum/forum-read";
import { getForumMember } from "@/interface/forum/require-forum-member";

import { SignInGate } from "./_components/sign-in-gate";

export const metadata: Metadata = { title: "Categorías" };

// Reads the session cookie: never prerendered.
export const dynamic = "force-dynamic";

export default async function ForumHomePage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const [member, { error }] = await Promise.all([getForumMember(), searchParams]);

  // Not `getForumCategories` first: it sends a visitor to /foro, which is this page.
  if (!member) {
    return <SignInGate problem={parseForumLoginError(error)} />;
  }

  const categories = await getForumCategories();

  return (
    <>
      <h1 className="mb-5 text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight">Foro</h1>
      {categories.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted px-4 py-10 text-center text-mist">
          <strong className="mb-1 block text-foreground">Todavía no hay categorías.</strong>
          La directiva las irá creando. Vuelva pronto.
        </div>
      ) : (
        <section aria-labelledby="categories-title" className="overflow-hidden rounded-xl border border-border bg-muted">
          <h2 id="categories-title" className="border-b border-border px-4 py-3 text-sm font-bold text-mist">
            Categorías
          </h2>
          <ul className="divide-y divide-border/50">
            {categories.map((category) => (
              <li key={category.id}>
                <Link href={`/foro/c/${category.slug}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3.5 transition-colors hover:bg-card focus-visible:-outline-offset-3">
                  <span className="min-w-0">
                    <strong className="block font-semibold wrap-anywhere text-foreground">{category.name}</strong>
                    {category.description ? <span className="block text-sm wrap-anywhere text-mist">{category.description}</span> : null}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm text-mist">
                    <Icon name="msg" className="size-4" />
                    {category.threadCount}
                    <span className="sr-only"> {category.threadCount === 1 ? "hilo" : "hilos"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
