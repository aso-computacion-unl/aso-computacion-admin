import { finishGoogleLogin } from "@/interface/auth/google-login";

// Opens a session from the request's cookies: never cached.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return finishGoogleLogin(request);
}
