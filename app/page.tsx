import { redirect } from "next/navigation";

// `/` is guarded by the proxy, so only authenticated sessions reach this.
export default function HomePage(): never {
  redirect("/admin");
}
