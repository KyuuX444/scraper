/**
 * Creator : Ryza 
 * Ch : https://whatsapp.com/channel/0029VbE4NyXFSAt8jKbRHt2o
 * 
 * note : don't claim this code
 */

import vm from 'node:vm';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
let cachedClient = null;
let cacheTime = 0;

async function getVidsSaveClient() {
	if (cachedClient && Date.now() - cacheTime < 1000 * 60 * 15) {
		return cachedClient;
	}

	const htmlRes = await fetch('https://mm.vidssave.com/', {
		headers: { 'User-Agent': UA }
	});
	if (!htmlRes.ok) {
		throw new Error(`Gagal mengakses mm.vidssave.com (${htmlRes.status})`);
	}

	const html = await htmlRes.text();
	const auth = html.match(/<meta[^>]+name=["']downloader-sdk-auth["'][^>]+content=["']([^"']+)["']/i)?.[1];
	const sdkUrl = html.match(/https:\/\/res\.vidssave\.com\/vidssave-com\/sdk\/js\/sdk\/[^"'\s\\]+?\.js/i)?.[0];

	if (!auth || !sdkUrl) {
		throw new Error('Konfigurasi SDK VidsSave tidak ditemukan.');
	}

	const sdkRes = await fetch(sdkUrl, {
		headers: { 'User-Agent': UA, Referer: 'https://mm.vidssave.com/' }
	});
	if (!sdkRes.ok) {
		throw new Error(`Gagal memuat SDK (${sdkRes.status})`);
	}

	const sdkCode = await sdkRes.text();
	const sandbox = {
		console,
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		URL,
		URLSearchParams,
		TextEncoder,
		TextDecoder,
		Uint8Array,
		ArrayBuffer,
		DataView,
		crypto: globalThis.crypto,
		atob: globalThis.atob,
		btoa: globalThis.btoa,
		AbortController,
		AbortSignal,
		Headers,
		Request,
		Response,
		document: {
			querySelector: () => ({ content: auth }),
			cookie: '',
			createElement: () => ({})
		},
		location: {
			href: 'https://mm.vidssave.com/',
			origin: 'https://mm.vidssave.com',
			hostname: 'mm.vidssave.com',
			protocol: 'https:'
		},
		navigator: {
			userAgent: UA,
			language: 'en-US'
		},
		fetch: (target, opts = {}) =>
			fetch(target, {
				...opts,
				headers: {
					...(opts.headers || {}),
					Origin: 'https://mm.vidssave.com',
					Referer: 'https://mm.vidssave.com/',
					'User-Agent': UA
				}
			})
	};

	sandbox.window = sandbox;
	sandbox.self = sandbox;
	sandbox.globalThis = sandbox;

	vm.runInNewContext(sdkCode, sandbox);

	const sdk = sandbox.window.DownloaderSDKs?.[auth];
	if (!sdk?.create) {
		throw new Error('DownloaderSDK gagal diinisialisasi.');
	}

	cachedClient = await sdk.create({
		commParams: {
			domain: 'vidssave.com',
			siteDomain: 'my.vidssave.com'
		}
	});
	cacheTime = Date.now();
	return cachedClient;
}

function sanitizeUrl(input) {
	if (!input || typeof input !== 'string') return '';
	const match = input.match(/https?:\/\/[^\s<>"'`]+/i);
	if (!match) return '';
	const cleaned = match[0].replace(/[)'"}\];,.`*_~]+$/g, '');
	try {
		return new URL(cleaned).href;
	} catch {
		return '';
	}
}

export async function vidssave(url) {
	try {
		const cleanUrl = sanitizeUrl(url);
		if (!cleanUrl) {
			throw new Error('URL tidak valid.');
		}

		const client = await getVidsSaveClient();
		const res = await client.parseLink({ link: cleanUrl });

		if (!res?.data) {
			throw new Error(res?.msg || 'Gagal mengambil data media.');
		}

		const d = res.data;
		const resources = [];

		for (const m of d.media || []) {
			for (const r of m.resources || []) {
				const dlUrl = r.download_url || r.preview_url || null;
				if (!dlUrl) continue;
				resources.push({
					media_id: m.media_id || null,
					format: r.format || '',
					quality: r.quality || '',
					size: r.size || 0,
					download_mode: r.download_mode || '',
					url: dlUrl
				});
			}
		}

		return {
			status: true,
			id: d.id || null,
			title: d.title || '',
			thumbnail: d.thumbnail || null,
			duration: d.duration || 0,
			like_count: d.like_count || 0,
			comment_count: d.comment_count || 0,
			videos: resources.filter((x) => !/mp3|m4a|audio/i.test(x.format)),
			audios: resources.filter((x) => /mp3|m4a|audio/i.test(x.format)),
			all: resources
		};
	} catch (err) {
		return {
			status: false,
			message: err?.message || String(err)
		};
	}
}

export default vidssave;
