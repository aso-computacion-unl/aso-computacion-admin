import { notFound } from "next/navigation";

// An address under /admin that no page owns. With no match at all Next renders app/not-found.tsx outside the shell; a
// page that throws notFound() renders app/admin/not-found.tsx inside the admin layout instead (top bar and navigation).
// It adds no access of its own: the proxy and the layout's session check run before this page, as for every admin page.
export default function UnknownAdminPage(): never {
  notFound();
}
