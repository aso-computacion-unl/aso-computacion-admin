import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageCount: number;
  /** The URL of another page of the same list. */
  hrefFor: (page: number) => string;
}

/** Previous / next with "Página 2 de 5"; renders nothing for a single page. */
export function Pagination({ page, pageCount, hrefFor }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Button asChild variant="line" size="sm">
          <Link href={hrefFor(page - 1)} rel="prev">
            <Icon name="left" className="size-4" />
            Anterior
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="font-mono text-sm text-mist">
        Página {page} de {pageCount}
      </p>
      {page < pageCount ? (
        <Button asChild variant="line" size="sm">
          <Link href={hrefFor(page + 1)} rel="next">
            Siguiente
            <Icon name="right" className="size-4" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
