import { redirect } from "next/navigation";

// The preview-code page left the admin (the public preview endpoint stays). Kept so old bookmarks do not 404.
export default function AdminPreviewPage() {
  redirect("/admin");
}
