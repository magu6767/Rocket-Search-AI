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

interface Env {
	GEMINI_API_KEY: string;
}

interface RequestData {
	text: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// CORSヘッダーを設定
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		// POSTリクエストのみを受け付ける
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		try {
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

			const data = await response.json();

			return new Response(JSON.stringify(data), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});

		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}
	},
} satisfies ExportedHandler<Env>;
