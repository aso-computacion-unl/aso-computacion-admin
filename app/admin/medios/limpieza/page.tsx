import { redirect } from "next/navigation";

// The cleanup moved under the trash. Kept so old bookmarks do not 404.
export default function AdminMediaCleanupRedirect() {
  redirect("/admin/papelera/imagenes");
}
