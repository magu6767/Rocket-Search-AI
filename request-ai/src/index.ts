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
        <h2>Rocket Search AIのプライバシーポリシー</h2>

        <p>本プライバシーポリシーは、サービス開発者（以下「当開発者」）が開発したGoogle Chrome拡張機能「Rocket Search AI」（以下「本拡張機能」）の利用に際し、取得する情報の取り扱いおよび保護に関する方針を示すものです。当開発者は、Chromeウェブストアのガイドラインを遵守し、安全かつ適正な運用に努めます。</p>

        <hr>

        <h3>1. 基本方針</h3>
        <p>当開発者は、ユーザーの個人情報保護の重要性を認識し、個人情報に関する法令および業界標準を遵守するとともに、取得した情報については厳重に管理いたします。また、取得した情報は本拡張機能の提供およびサービス向上以外の目的で利用されることはありません。</p>

        <h3>2. 適用範囲</h3>
        <p>本プライバシーポリシーは、本拡張機能の利用により取得されるすべての情報に適用されます。</p>

        <h3>3. 取得する情報と利用目的</h3>
        <p>本拡張機能では、以下の情報を取得し、以下の目的で利用いたします。</p>

        <h4>(1) Webページ上のテキストデータ</h4>
        <ul>
            <li><strong>取得内容:</strong> ユーザーが閲覧中のウェブページ上のテキストデータ（ユーザーが任意に送信を行った場合に限る）。</li>
            <li><strong>利用目的:</strong> 送信されたテキストデータは、AIによる回答の精度向上およびサービス改善のために利用されます。</li>
        </ul>

        <h4>(2) メールアドレス</h4>
        <ul>
            <li><strong>取得内容:</strong> ユーザーの識別を目的としたメールアドレス。</li>
            <li><strong>取得方法:</strong> 本拡張機能内の登録フォーム等を通じてユーザーにご入力いただき、サーバー上に保存されます。</li>
            <li><strong>利用目的:</strong> ユーザー識別およびアカウント管理、ならびにサービス提供に必要な連絡のために利用されます。</li>
        </ul>

        <h4>(3) 通信の安全性</h4>
        <p><strong>通信プロトコル:</strong> 本拡張機能による全ての情報の送受信は、HTTPSによる暗号化通信を利用して行われ、情報の漏洩防止に努めています。</p>

        <h4>(4) その他の安全対策</h4>
        <p>当開発者は、サーバーおよびデータベースの管理に適切なセキュリティ技術を導入し、不正アクセス、情報漏洩、改ざん等のリスクを最小限に抑えるため、さまざまな安全管理措置を講じています。</p>

        <h3>4. 情報の管理と保存期間</h3>
        <ul>
            <li><strong>管理:</strong> 取得した情報は、適切なセキュリティ対策（例：アクセス制御、サーバー監視、定期的なセキュリティアップデート）を実施した上で管理されます。</li>
            <li><strong>保存期間:</strong> メールアドレス等の個人情報は、本拡張機能の利用継続期間中、またはユーザーからの削除依頼があるまで保持し、その後速やかに削除いたします。</li>
        </ul>

        <h3>5. 第三者提供について</h3>
        <p>当開発者は、ユーザーの同意なく、取得した個人情報を第三者に提供することは一切ありません。万が一、法令に基づく開示要求があった場合を除き、厳格に管理いたします。</p>

        <h3>6. ユーザーの同意について</h3>
        <p>本拡張機能のインストールまたは利用開始時点で、本プライバシーポリシーに同意いただいたものとみなします。ご不明点やご質問がある場合は、下記のお問い合わせ先までご連絡ください。</p>

        <h3>7. お問い合わせ先</h3>
        <div class="contact">
            <p>本プライバシーポリシーに関するお問い合わせは、以下のメールアドレスまでお願いいたします。</p>
            <p>メールアドレス： mogeko6347@gmail.com</p>
        </div>

        <div class="date">
            <p>策定日<br>2025年2月24日　策定</p>
            <p>更新日<br>2025年2月24日　更新</p>
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
