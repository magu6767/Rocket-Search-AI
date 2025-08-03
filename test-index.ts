import { DurableObject } from "cloudflare:workers";

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */

/** A Durable Object's behavior is defined in an exported Javascript class */
export class MyDurableObject extends DurableObject<Env> {
	/**
	 * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
	 * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
	 *
	 * @param ctx - The interface for interacting with Durable Object state
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 */
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	/**
	 * The Durable Object exposes an RPC method sayHello which will be invoked when when a Durable
	 *  Object instance receives a request from a Worker via the same method invocation on the stub
	 *
	 * @param name - The name provided to a Durable Object instance from a Worker
	 * @returns The greeting to be sent back to the Worker
	 */
	async sayHello(name: string): Promise<string> {
		return `Hello, ${name}!`;
	}

	async getCounter(): Promise<number> {
		const start = performance.now();
		const counter = await this.ctx.storage.get<number>("counter");
		const duration = performance.now() - start;
		console.log(`[ストレージ] カウンター取得: ${duration.toFixed(2)}ms`);
		return counter ?? 0;
	}

	async increment(): Promise<number> {
		const methodStart = performance.now();
		console.log(`[メソッド] increment()開始`);
		
		const counter = await this.getCounter();
		const newCounter = counter + 1;
		
		const putStart = performance.now();
		await this.ctx.storage.put("counter", newCounter);
		const putDuration = performance.now() - putStart;
		console.log(`[ストレージ] カウンター保存: ${putDuration.toFixed(2)}ms`);
		
		const methodDuration = performance.now() - methodStart;
		console.log(`[メソッド] increment()完了: ${methodDuration.toFixed(2)}ms`);
		return newCounter;
	}

	async decrement(): Promise<number> {
		const methodStart = performance.now();
		console.log(`[メソッド] decrement()開始`);
		
		const counter = await this.getCounter();
		const newCounter = counter - 1;
		
		const putStart = performance.now();
		await this.ctx.storage.put("counter", newCounter);
		const putDuration = performance.now() - putStart;
		console.log(`[ストレージ] カウンター保存: ${putDuration.toFixed(2)}ms`);
		
		const methodDuration = performance.now() - methodStart;
		console.log(`[メソッド] decrement()完了: ${methodDuration.toFixed(2)}ms`);
		return newCounter;
	}
}

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const requestStart = performance.now();
		const url = new URL(request.url);
		const pathname = url.pathname;
		console.log(`[リクエスト] ${request.method} ${pathname} 開始`);

		const id: DurableObjectId = env.MY_DURABLE_OBJECT.idFromName("counter");
		const stub = env.MY_DURABLE_OBJECT.get(id);

		try {
			if (pathname === "/") {
				const counter = await stub.getCounter();
				return new Response(`Current counter: ${counter}`, {
					headers: { "Content-Type": "text/plain" },
				});
			} else if (pathname === "/increment") {
				const counter = await stub.increment();
				return new Response(`Counter incremented to: ${counter}`, {
					headers: { "Content-Type": "text/plain" },
				});
			} else if (pathname === "/decrement") {
				const counter = await stub.decrement();
				return new Response(`Counter decremented to: ${counter}`, {
					headers: { "Content-Type": "text/plain" },
				});
			} else if (pathname === "/hello") {
				const greeting = await stub.sayHello("world");
				return new Response(greeting);
			} else {
				return new Response("Not Found", { status: 404 });
			}
		} catch (error) {
			const requestDuration = performance.now() - requestStart;
			console.log(`[リクエスト] ${request.method} ${pathname} エラー: ${requestDuration.toFixed(2)}ms - ${error}`);
			return new Response(`Error: ${error}`, { status: 500 });
		} finally {
			const requestDuration = performance.now() - requestStart;
			console.log(`[リクエスト] ${request.method} ${pathname} 完了: ${requestDuration.toFixed(2)}ms`);
		}
	},
} satisfies ExportedHandler<Env>;
