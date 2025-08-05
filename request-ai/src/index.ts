import { DurableObject } from "cloudflare:workers";
import { Auth, WorkersKVStoreSingle } from "firebase-auth-cloudflare-workers";
import { privacyPolicyHtml } from "./privacy-policy";

interface Env {
	AI: Ai;
	FIREBASE_PROJECT_ID: string;
	CLOUDFLARE_PUBLIC_JWK_CACHE_KEY: string; // 好きな名前でOK、ここで設定した名前でKeyとValue（公開鍵）が登録される
	CLOUDFLARE_PUBLIC_JWK_CACHE_KV: KVNamespace;
	RATE_LIMIT_OBJECT: DurableObjectNamespace<RateLimitObject>;
	TOKEN_CACHE_OBJECT: DurableObjectNamespace<TokenCacheObject>;
}

interface RequestData {
	text: string;
}

const DAILY_LIMIT = 20; // 1日あたりのリクエスト制限
const TIME_WINDOW = 86400; // 24時間（秒）

interface UserRateLimit {
	count: number;
	windowStart: number; // ウィンドウ開始時刻（Unix timestamp）
}

export class RateLimitObject extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async checkAndIncrementLimit(uid: string): Promise<boolean> {
		const now = Date.now();
		const userData = await this.ctx.storage.get<UserRateLimit>(uid);

		// 24時間ウィンドウの開始時刻を計算
		const currentWindowStart = Math.floor(now / (TIME_WINDOW * 1000)) * (TIME_WINDOW * 1000);
		
		let requestCount = 0;
		let windowStart = currentWindowStart;

		if (userData) {
			// 既存データがあり、同じウィンドウ内の場合はカウントを継続
			if (userData.windowStart === currentWindowStart) {
				requestCount = userData.count;
				windowStart = userData.windowStart;
			}
			// 異なるウィンドウの場合は新しいウィンドウでリセット
		}

		if (requestCount >= DAILY_LIMIT) {
			return false;
		}

		const newUserData: UserRateLimit = {
			count: requestCount + 1,
			windowStart: windowStart
		};
		await this.ctx.storage.put(uid, newUserData);
		
		// 次のウィンドウ開始時刻にアラームを設定（古いデータのクリーンアップ用）
		const nextWindowStart = windowStart + (TIME_WINDOW * 1000);
		await this.ctx.storage.setAlarm(nextWindowStart + 3600 * 1000); // 1時間の猶予を持たせてクリーンアップ
		return true;
	}

	async getCurrentCount(uid: string): Promise<number> {
		const userData = await this.ctx.storage.get<UserRateLimit>(uid);
		
		if (!userData) return 0;
		
		// 現在のウィンドウを確認
		const now = Date.now();
		const currentWindowStart = Math.floor(now / (TIME_WINDOW * 1000)) * (TIME_WINDOW * 1000);
		
		// 古いウィンドウのデータの場合は0を返す
		if (userData.windowStart !== currentWindowStart) {
			return 0;
		}
		
		return userData.count;
	}

	async alarm(): Promise<void> {
		const now = Date.now();
		const currentWindowStart = Math.floor(now / (TIME_WINDOW * 1000)) * (TIME_WINDOW * 1000);
		
		// 現在のウィンドウより古いデータを削除
		const allData = await this.ctx.storage.list<UserRateLimit>();
		const keysToDelete: string[] = [];
		
		for (const [key, userData] of allData) {
			if (userData.windowStart < currentWindowStart - (TIME_WINDOW * 1000)) {
				keysToDelete.push(key);
			}
		}
		
		if (keysToDelete.length > 0) {
			await this.ctx.storage.delete(keysToDelete);
		}
	}
}

export class TokenCacheObject extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async getToken(jwtHash: string): Promise<string | null> {
		const cachedUid = await this.ctx.storage.get<string>(jwtHash);
		return cachedUid ?? null;
	}

	async setToken(jwtHash: string, uid: string): Promise<void> {
		await this.ctx.storage.put(jwtHash, uid);
		await this.ctx.storage.setAlarm(Date.now() + 3600 * 1000); // 1時間後にクリーンアップ
	}

	async alarm(): Promise<void> {
		await this.ctx.storage.deleteAll();
	}
}


// 参考：https://zenn.dev/codehex/articles/ca85a1babcc046
const verifyJWT = async (req: Request, env: Env): Promise<string> => {
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

		// Durable Objectからキャッシュを取得
		const tokenCacheId: DurableObjectId = env.TOKEN_CACHE_OBJECT.idFromName("token-cache");
		const tokenCacheStub = env.TOKEN_CACHE_OBJECT.get(tokenCacheId);
		const cachedUid = await tokenCacheStub.getToken(hashHex);
		
		if (cachedUid) {
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

		// Durable Objectにキャッシュを保存
		await tokenCacheStub.setToken(hashHex, uid);

		return uid;
	} catch (error: any) {
		console.error('JWT検証エラー:', {
			message: error.message,
			stack: error.stack,
			name: error.name
		});
		throw error;
	}
}

async function checkRateLimit(uid: string, env: Env): Promise<boolean> {
	const id: DurableObjectId = env.RATE_LIMIT_OBJECT.idFromName("rate-limit");
	const stub = env.RATE_LIMIT_OBJECT.get(id);
	
	const result = await stub.checkAndIncrementLimit(uid);
	
	return result;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST, GET',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				},
			});
		}

		// プライバシーポリシーページのルーティング
		if (request.method === 'GET' && new URL(request.url).pathname === '/privacy-policy') {
			return new Response(privacyPolicyHtml, {
				headers: {
					'Content-Type': 'text/html;charset=UTF-8',
					'Access-Control-Allow-Origin': '*',
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
				return new Response('リクエスト制限を超えました。一日にリクエストできるのは20回までです。\n\nしばらく待ってから再度お試しください。', {
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

			// Cloudflare Workers AIを使用してストリーミングレスポンスを生成
			const aiStream = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
				messages: [{
					role: 'user',
					content: "You are a helpful assistant. Please answer the following question within 100 words: " + text
				}],
				stream: true
			});

			// ReadableStreamの作成
			const encoder = new TextEncoder();
			const stream = new ReadableStream({
				async start(controller) {
					try {
						const reader = aiStream.getReader();
						const decoder = new TextDecoder();
						let buffer = '';
						while (true) {
							const { done, value } = await reader.read();
							if (done) {
								break;
							}
							
							// バイト配列をテキストに変換
							buffer += decoder.decode(value, { stream: true });
							
							// SSEの行を処理
							const lines = buffer.split('\n');
							buffer = lines.pop() || ''; // 最後の不完全な行をバッファに残す
							
							for (const line of lines) {
								if (line.trim() && line.startsWith('data: ')) {
									const data = line.slice(6);
									if (data === '[DONE]') {
										// ストリーム終了を通知
										controller.enqueue(encoder.encode('data: [DONE]\n\n'));
										controller.close();
										return;
									}
									
									try {
										const parsed = JSON.parse(data);
										if (parsed.response) {
											// 文字単位で分割してキューに入れる
											for (const char of parsed.response) {
												// SSE形式でデータを送信
												const message = `data: ${JSON.stringify({ result: char })}\n\n`;
												controller.enqueue(encoder.encode(message));
											}
										}
									} catch (e) {
										console.error('Failed to parse AI response:', e);
									}
								}
							}
						}
						
						// 最終的にストリーム終了を通知
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
