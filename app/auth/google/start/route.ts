import { startGoogleLogin } from "@/interface/auth/google-login";

// Sets a cookie and redirects: never cached.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return startGoogleLogin(request);
}
