import { redirect } from "next/navigation";

// `/` is guarded by middleware, so only authenticated sessions reach this.
export default function HomePage(): never {
  redirect("/admin");
}
