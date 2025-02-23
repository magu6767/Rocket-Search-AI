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
import { GoogleGenerativeAI } from "@google/generative-ai";

interface Env {
	GEMINI_API_KEY: string;
	FIREBASE_PROJECT_ID: string;
	CLOUDFLARE_PUBLIC_JWK_CACHE_KEY: string; // 好きな名前でOK、ここで設定した名前でKeyとValue（公開鍵）が登録される
	CLOUDFLARE_PUBLIC_JWK_CACHE_KV: KVNamespace;
	RATE_LIMIT_KV: KVNamespace;
	VERIFIED_TOKEN_KV: KVNamespace;
}

interface RequestData {
	text: string;
}

const DAILY_LIMIT = 10; // 1日あたりのリクエスト制限
const TIME_WINDOW = 86400; // 24時間（秒）

// 参考：https://zenn.dev/codehex/articles/ca85a1babcc046
const verifyJWT = async (req: Request, env: Env): Promise<string> => {
	console.info(`[${new Date().toISOString()}] verifyJWTの開始`);
	const authorization = req.headers.get('Authorization')
	if (authorization === null) {
		throw new Error("Authorization header is missing")
	}
	const jwt = authorization.replace(/Bearer\s+/i, "")

	try {
		// JWTをハッシュ化してキーとして使用
		const encoder = new TextEncoder();
		const data = encoder.encode(jwt);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

		// キャッシュからuidを取得（ハッシュ化したキーを使用）
		const cachedUid = await env.VERIFIED_TOKEN_KV.get(hashHex);
		if (cachedUid) {
			console.info(`[${new Date().toISOString()}] キャッシュからuidを取得`);
			return cachedUid;
		}

		// KVの初期化
		const kvStore = WorkersKVStoreSingle.getOrInitialize(
			env.CLOUDFLARE_PUBLIC_JWK_CACHE_KEY,
			env.CLOUDFLARE_PUBLIC_JWK_CACHE_KV
		);

		const auth = Auth.getOrInitialize(env.FIREBASE_PROJECT_ID, kvStore);
		const token = await auth.verifyIdToken(jwt, false);
		const uid = token.uid;

		// 検証済みトークンをキャッシュに保存（ハッシュ化したキーを使用）
		await env.VERIFIED_TOKEN_KV.put(hashHex, uid, {
			expirationTtl: 3600 // 1時間
		});

		console.info(`[${new Date().toISOString()}] verifyJWTの終了`);
		return uid;
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
			const uid = await verifyJWT(request, env);
			
			// レートリミットのチェック
			const isWithinLimit = await checkRateLimit(uid, env);
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

			// Gemini APIクライアントの初期化
			const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
			const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

			// ストリームレスポンスの生成
			const prompt = `以下の選択されたテキストを分析して日本語で出力してください。
「分析」とは、短い単語なら単純にその意味を調べて詳しく丁寧に解説し、長めの文章ならその内容をわかりやすく解説することです。
分脈がわかるように、ページタイトル、見出し、前後の文脈を載せます。あくまで選択したテキストを分析して欲しいので、これらの情報は出力に含めないでください。
${text}`;

			const result = await model.generateContentStream(prompt);

			// ReadableStreamの作成
			const encoder = new TextEncoder();
			const stream = new ReadableStream({
				async start(controller) {
					try {
						for await (const chunk of result.stream) {
							const chunkText = chunk.text();
							console.info('Sending chunk:', chunkText);
							if (chunkText) {
								// SSE形式でデータを送信
								const message = `data: ${JSON.stringify({ result: chunkText })}\n\n`;
								controller.enqueue(encoder.encode(message));
							}
						}
						// ストリーム終了を通知
						controller.enqueue(encoder.encode('data: [DONE]\n\n'));
						controller.close();
					} catch (error) {
						console.error('Stream error:', error);
						// エラーメッセージをSSE形式で送信
						const errorMessage = `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`;
						controller.enqueue(encoder.encode(errorMessage));
						controller.close();
					}
				}
			});

			return new Response(stream, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Access-Control-Allow-Origin': '*',
					'Cache-Control': 'no-cache, no-transform',
					'Connection': 'keep-alive',
					'X-Accel-Buffering': 'no', // Nginxのバッファリングを無効化
				},
			});

		} catch (error) {
			console.error('Error:', error);
			const status = error instanceof Error && error.message.includes('Authorization') ? 401 : 500;
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}
	}
} satisfies ExportedHandler<Env>;
