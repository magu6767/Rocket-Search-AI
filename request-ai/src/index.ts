/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import type { FirebaseIdToken } from "firebase-auth-cloudflare-workers";
import { Auth, WorkersKVStoreSingle } from "firebase-auth-cloudflare-workers";

interface GeminiResponse {
	candidates: Array<{
		content: {
			parts: Array<{
				text: string;
			}>;
		};
	}>;
}

interface Env {
	GEMINI_API_KEY: string;
	FIREBASE_PROJECT_ID: string;
	CLOUDFLARE_PUBLIC_JWK_CACHE_KEY: string; // 好きな名前でOK、ここで設定した名前でKeyとValue（公開鍵）が登録される
	CLOUDFLARE_PUBLIC_JWK_CACHE_KV: KVNamespace;
	RATE_LIMIT_KV: KVNamespace;
}

interface RequestData {
	text: string;
}

const DAILY_LIMIT = 10; // 1日あたりのリクエスト制限
const TIME_WINDOW = 86400; // 24時間（秒）

// 参考：https://zenn.dev/codehex/articles/ca85a1babcc046
const verifyJWT = async (req: Request, env: Env): Promise<FirebaseIdToken> => {
	const authorization = req.headers.get('Authorization')
	if (authorization === null) {
		throw new Error("Authorization header is missing")
	}
    // AuthorizationヘッダーからFirebaseのidTokenを取得
	const jwt = authorization.replace(/Bearer\s+/i, "")

	try {
        // KVの初期化
		const kvStore = WorkersKVStoreSingle.getOrInitialize(
			env.CLOUDFLARE_PUBLIC_JWK_CACHE_KEY,
			env.CLOUDFLARE_PUBLIC_JWK_CACHE_KV
		);

		const auth = Auth.getOrInitialize(env.FIREBASE_PROJECT_ID, kvStore);
		const token = await auth.verifyIdToken(jwt, false);
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

async function checkRateLimit(uid: string, env: Env): Promise<boolean> {
	const kvKey = `${uid}`;
	const currentValue = await env.RATE_LIMIT_KV.get(kvKey);
	const requestCount = currentValue ? parseInt(currentValue) : 0;

	if (requestCount >= DAILY_LIMIT) {
		return false;
	}

	await env.RATE_LIMIT_KV.put(kvKey, (requestCount + 1).toString(), {
		expirationTtl: TIME_WINDOW,
	});

	return true;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				},
			});
		}

		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		try {
			// JWTの検証
			const token = await verifyJWT(request, env);
			
			// レートリミットのチェック
			const isWithinLimit = await checkRateLimit(token.uid, env);
			if (!isWithinLimit) {
				return new Response('リクエスト制限を超えました。', {
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			}

			const requestData = await request.json() as RequestData;
			const text = requestData.text;

			if (!text) {
				return new Response('Text is required', { status: 400 });
			}

			const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
			
			const response = await fetch(`${API_URL}?key=${env.GEMINI_API_KEY}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					contents: [{
						parts: [{
							text: `以下の選択されたテキストを分析して日本語で出力してください。
							「分析」とは、短い単語なら単純にその意味を調べて詳しく丁寧に解説し、長めの文章ならその内容をわかりやすく解説することです。
							分脈がわかるように、ページタイトル、見出し、前後の文脈を載せます。あくまで選択したテキストを分析して欲しいので、これらの情報は出力に含めないでください。
${text}`
						}]
					}]
				})
			});

			if (!response.ok) {
				throw new Error('Failed to fetch from Gemini API');
			}

			const data = await response.json() as GeminiResponse;
			const result = data.candidates[0].content.parts[0].text;

			return new Response(JSON.stringify({ result }), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});

		} catch (error) {
			const status = error instanceof Error && error.message.includes('Authorization') ? 401 : 500;
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}
	},
} satisfies ExportedHandler<Env>;
