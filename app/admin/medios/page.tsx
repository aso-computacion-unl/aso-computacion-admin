import { redirect } from "next/navigation";

// The Medios library left the admin; the image cleanup now lives in the trash. Kept so old bookmarks do not 404.
export default function AdminMediaPage() {
  redirect("/admin/papelera");
}
