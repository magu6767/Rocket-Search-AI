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
  
  console.log('Initializing with Project ID:', env.FIREBASE_PROJECT_ID);
  console.log('Cache Key:', env.CLOUDFLARE_PUBLIC_JWK_CACHE_KEY);

  try {
    // KVストアの初期化
    const kvStore = WorkersKVStoreSingle.getOrInitialize(
      env.CLOUDFLARE_PUBLIC_JWK_CACHE_KEY,
      env.CLOUDFLARE_PUBLIC_JWK_CACHE_KV
    );

    // 現在のキャッシュの状態を確認
    const currentCache = await env.CLOUDFLARE_PUBLIC_JWK_CACHE_KV.get(env.CLOUDFLARE_PUBLIC_JWK_CACHE_KEY);
    console.log('Current cache state:', currentCache);

    // Google証明書の取得を試みる
    const auth = Auth.getOrInitialize(env.FIREBASE_PROJECT_ID, kvStore);
    
    // JWTの検証を試みる前にトークンの形式を確認
    console.log('JWT format check:', {
      length: jwt.length,
      parts: jwt.split('.').length
    });

    const token = await auth.verifyIdToken(jwt, false);
    console.log('Token verification successful');
    return token;
  } catch (error: any) {
    console.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
}

export async function fetch(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const token = await verifyJWT(req, env);
    return new Response(JSON.stringify(token), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Token verification error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack,
      type: error.name
    }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
}

export default { fetch };