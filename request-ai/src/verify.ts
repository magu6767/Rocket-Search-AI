import type { FirebaseIdToken } from "firebase-auth-cloudflare-workers";
import { Auth, WorkersKVStoreSingle } from "firebase-auth-cloudflare-workers";

interface Env {
	FIREBASE_PROJECT_ID: string;
	CLOUDFLARE_PUBLIC_JWK_CACHE_KEY: string;
	CLOUDFLARE_PUBLIC_JWK_CACHE_KV: KVNamespace;
}

const verifyJWT = async (req: Request, env: Env): Promise<FirebaseIdToken> => {
  const authorization = req.headers.get('Authorization')
  if (authorization === null) {
    throw new Error("Authorization header is missing")
  }
  const jwt = authorization.replace(/Bearer\s+/i, "")
  const auth = Auth.getOrInitialize(
    env.FIREBASE_PROJECT_ID,
    WorkersKVStoreSingle.getOrInitialize(env.CLOUDFLARE_PUBLIC_JWK_CACHE_KEY, env.CLOUDFLARE_PUBLIC_JWK_CACHE_KV)
  )
  return await auth.verifyIdToken(jwt, false)
}

export async function fetch(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
) {
  const token = await verifyJWT(req, env);
  if (token === null) {
    return new Response("Invalid token", {
      status: 400,
    });
  }
  return new Response(JSON.stringify(token), {
    headers: { "Content-Type": "application/json" },
  });
}

export default { fetch };