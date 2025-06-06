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
        // これでも遅い時がある
		const encoder = new TextEncoder();
		const data = encoder.encode(jwt);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

		// キャッシュからuidを取得（ハッシュ化したキーを使用）
		const cachedUid = await env.VERIFIED_TOKEN_KV.get(hashHex);
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

		// 検証済みトークンをキャッシュに保存（ハッシュ化したキーを使用）
		await env.VERIFIED_TOKEN_KV.put(hashHex, uid, {
			expirationTtl: 3600 // 1時間
		});

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

			// Gemini APIクライアントの初期化
			const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
			const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite-preview-02-05" });

			// ストリームレスポンスの生成
			const result = await model.generateContentStream(text);

			// ReadableStreamの作成
			const encoder = new TextEncoder();
			const stream = new ReadableStream({
				async start(controller) {
					try {
						for await (const chunk of result.stream) {
							const chunkText = chunk.text();
							if (chunkText) {
								// 文字単位で分割してキューに入れる
								for (const char of chunkText) {
									// SSE形式でデータを送信
									const message = `data: ${JSON.stringify({ result: char })}\n\n`;
									controller.enqueue(encoder.encode(message));
								}
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
