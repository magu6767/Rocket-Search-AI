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

interface Env {
	AI: Ai;
	FIREBASE_PROJECT_ID: string;
	CLOUDFLARE_PUBLIC_JWK_CACHE_KEY: string; // 好きな名前でOK、ここで設定した名前でKeyとValue（公開鍵）が登録される
	CLOUDFLARE_PUBLIC_JWK_CACHE_KV: KVNamespace;
	RATE_LIMIT_KV: KVNamespace;
	VERIFIED_TOKEN_KV: KVNamespace;
}

interface RequestData {
	text: string;
}

const DAILY_LIMIT = 20; // 1日あたりのリクエスト制限
const TIME_WINDOW = 86400; // 24時間（秒）

// プライバシーポリシーページのHTML
const PRIVACY_POLICY_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>プライバシーポリシー - Chrome拡張機能</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        h2 {
            color: #2c3e50;
            margin-top: 30px;
        }
        h3 {
            color: #34495e;
            margin-top: 25px;
        }
        hr {
            border: none;
            border-top: 1px solid #eee;
            margin: 30px 0;
        }
        ul {
            padding-left: 20px;
        }
        .contact {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .date {
            text-align: right;
            margin-top: 40px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Privacy Policy for Rocket Search AI</h1>
        <h2>Privacy Policy for Rocket Search AI</h2>

        <p>This Privacy Policy outlines the handling and protection of information collected by the service developer (hereinafter referred to as "the developer") through the Google Chrome extension "Rocket Search AI" (hereinafter referred to as "the extension"). The developer is committed to complying with Chrome Web Store guidelines and ensuring safe and appropriate operation.</p>

        <hr>

        <h3>1. Basic Policy</h3>
        <p>The developer recognizes the importance of protecting users' personal information and complies with laws and industry standards related to personal information. All collected information is strictly managed. Information obtained will not be used for any purpose other than providing and improving the extension service.</p>

        <h3>2. Scope of Application</h3>
        <p>This Privacy Policy applies to all information obtained through the use of this extension.</p>

        <h3>3. Information Collected and Purpose of Use</h3>
        <p>The extension collects and uses the following information for the purposes described below:</p>

        <h4>(1) Text Data from Web Pages</h4>
        <ul>
            <li><strong>Content Collected:</strong> Text data from web pages that users are browsing (only when users voluntarily submit such data).</li>
            <li><strong>Purpose of Use:</strong> The submitted text data is used to improve the accuracy of AI responses and enhance the service.</li>
        </ul>

        <h4>(2) Email Address</h4>
        <ul>
            <li><strong>Content Collected:</strong> Email address for user identification.</li>
            <li><strong>Collection Method:</strong> Entered by users through registration forms within the extension and stored on the server.</li>
            <li><strong>Purpose of Use:</strong> Used for user identification, account management, and necessary communications related to service provision.</li>
        </ul>

        <h4>(3) Communication Security</h4>
        <p><strong>Communication Protocol:</strong> All information sent and received by this extension uses HTTPS encrypted communication to prevent information leakage.</p>

        <h4>(4) Other Security Measures</h4>
        <p>The developer implements appropriate security technologies for server and database management and takes various security measures to minimize risks such as unauthorized access, information leakage, and tampering.</p>

        <h3>4. Information Management and Retention Period</h3>
        <ul>
            <li><strong>Management:</strong> Collected information is managed with appropriate security measures (e.g., access control, server monitoring, regular security updates).</li>
            <li><strong>Retention Period:</strong> Personal information such as email addresses is retained during the period of continued use of the extension or until a deletion request is received from the user, after which it is promptly deleted.</li>
        </ul>

        <h3>5. Third-Party Disclosure</h3>
        <p>The developer will never provide collected personal information to third parties without user consent. Information will be strictly managed except in cases where disclosure is required by law.</p>

        <h3>6. User Consent</h3>
        <p>By installing or starting to use this extension, you are deemed to have agreed to this Privacy Policy. If you have any questions or concerns, please contact us using the information below.</p>

        <h3>7. Contact Information</h3>
        <div class="contact">
            <p>For inquiries regarding this Privacy Policy, please contact us at the following email address:</p>
            <p>Email: mogeko6347@gmail.com</p>
        </div>

        <div class="date">
            <p>Established on<br>February 24, 2025</p>
            <p>Last Updated<br>March 30, 2025</p>
        </div>
    </div>
</body>
</html>`;

// 参考：https://zenn.dev/codehex/articles/ca85a1babcc046
const verifyJWT = async (req: Request, env: Env): Promise<string> => {
	const authorization = req.headers.get('Authorization')
	if (authorization === null) {
		throw new Error("Authorization header is missing")
	}
	const jwt = authorization.replace(/Bearer\s+/i, "")

	try {
		// JWTをハッシュ化してキーとして使用
		const hashStartTime = Date.now();
		const encoder = new TextEncoder();
		const data = encoder.encode(jwt);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		console.log(`JWTハッシュ化: ${Date.now() - hashStartTime}ms`);

		// キャッシュからuidを取得（ハッシュ化したキーを使用）
		const cacheStartTime = Date.now();
		const cachedUid = await env.VERIFIED_TOKEN_KV.get(hashHex);
		console.log(`キャッシュ確認: ${Date.now() - cacheStartTime}ms`);
		if (cachedUid) {
			console.log('キャッシュヒット');
			return cachedUid;
		}

		console.log('キャッシュミス - Firebase検証開始');
		// KVの初期化
		const kvInitStartTime = Date.now();
		const kvStore = WorkersKVStoreSingle.getOrInitialize(
			env.CLOUDFLARE_PUBLIC_JWK_CACHE_KEY,
			env.CLOUDFLARE_PUBLIC_JWK_CACHE_KV
		);
		console.log(`KV初期化: ${Date.now() - kvInitStartTime}ms`);

		const authInitStartTime = Date.now();
		const auth = Auth.getOrInitialize(env.FIREBASE_PROJECT_ID, kvStore);
		console.log(`Auth初期化: ${Date.now() - authInitStartTime}ms`);
		
		const verifyStartTime = Date.now();
		const token = await auth.verifyIdToken(jwt, false);
		console.log(`Firebaseトークン検証: ${Date.now() - verifyStartTime}ms`);
		const uid = token.uid;

		// 検証済みトークンをキャッシュに保存（ハッシュ化したキーを使用）
		const cacheSaveStartTime = Date.now();
		await env.VERIFIED_TOKEN_KV.put(hashHex, uid, {
			expirationTtl: 3600 // 1時間
		});
		console.log(`キャッシュ保存: ${Date.now() - cacheSaveStartTime}ms`);

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
	const kvKey = `${uid}`;
	const getRateStartTime = Date.now();
	const currentValue = await env.RATE_LIMIT_KV.get(kvKey);
	console.log(`レート制限取得: ${Date.now() - getRateStartTime}ms`);
	const requestCount = currentValue ? parseInt(currentValue) : 0;
	console.log(`現在のリクエスト数: ${requestCount}/${DAILY_LIMIT}`);

	if (requestCount >= DAILY_LIMIT) {
		return false;
	}

	const putRateStartTime = Date.now();
	await env.RATE_LIMIT_KV.put(kvKey, (requestCount + 1).toString(), {
		expirationTtl: TIME_WINDOW,
	});
	console.log(`レート制限更新: ${Date.now() - putRateStartTime}ms`);

	return true;
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
			return new Response(PRIVACY_POLICY_HTML, {
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
			const startTime = Date.now();
			console.log(`リクエスト開始: ${new Date().toISOString()}`);
			
			// JWTの検証
			const jwtStartTime = Date.now();
			const uid = await verifyJWT(request, env);
			console.log(`JWT検証完了: ${Date.now() - jwtStartTime}ms`);
			
			// レートリミットのチェック
			const rateLimitStartTime = Date.now();
			const isWithinLimit = await checkRateLimit(uid, env);
			console.log(`レート制限チェック完了: ${Date.now() - rateLimitStartTime}ms`);
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
			const aiStartTime = Date.now();
			console.log(`AI実行開始: ${new Date().toISOString()}`);
			const aiStream = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
				messages: [{
					role: 'user',
					content: "You are a helpful assistant. Please answer the following question within 100 words: " + text
				}],
				stream: true
			});
			console.log(`AI実行完了（ストリーム取得）: ${Date.now() - aiStartTime}ms`);

			// ReadableStreamの作成
			const encoder = new TextEncoder();
			const stream = new ReadableStream({
				async start(controller) {
					try {
						const streamStartTime = Date.now();
						console.log(`ストリーミング処理開始: ${new Date().toISOString()}`);
						const reader = aiStream.getReader();
						const decoder = new TextDecoder();
						let buffer = '';

						let chunkCount = 0;
						while (true) {
							const { done, value } = await reader.read();
							if (done) {
								console.log(`ストリーミング完了: 総チャンク数=${chunkCount}, 総処理時間=${Date.now() - streamStartTime}ms`);
								break;
							}
							chunkCount++;
							
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

			console.log(`リクエスト処理完了（ストリーム開始まで）: ${Date.now() - startTime}ms`);
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
