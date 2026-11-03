import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { categoryHref } from "@/interface/forum/forum-links";
import { getForumCategories } from "@/interface/forum/forum-read";

import { NewThreadForm } from "../../../_components/new-thread-form";

export const metadata: Metadata = { title: "Nuevo hilo" };

// Reads the session cookie: never prerendered.
export const dynamic = "force-dynamic";

export default async function NewThreadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = (await getForumCategories(`${categoryHref(slug)}/nuevo`)).find((candidate) => candidate.slug === slug);

  if (!category) {
    notFound();
  }

  return (
    <>
      <Link href={categoryHref(category.slug)} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-mist hover:text-foreground">
        <Icon name="left" className="size-4" />
        {category.name}
      </Link>
      <h1 className="mt-1 mb-5 text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight">Nuevo hilo</h1>
      <p className="mb-5 text-mist">
        Se publica en <strong className="font-semibold text-foreground">{category.name}</strong>.
      </p>
      <NewThreadForm categorySlug={category.slug} />
    </>
  );
}
