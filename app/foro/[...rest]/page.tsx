import { notFound } from "next/navigation";

// An address under /foro that no page owns. With no match at all Next renders app/not-found.tsx outside the shell; a
// page that throws notFound() renders app/foro/not-found.tsx inside the forum layout instead (top bar included).
export default function UnknownForumPage(): never {
  notFound();
}
