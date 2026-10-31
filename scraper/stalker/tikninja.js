import crypto from 'crypto'

const BASE = 'https://tik.ninja'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

async function session() {
  const res = await fetch(BASE + '/', { headers: { 'User-Agent': UA } })
  const html = await res.text()
  const token = html.match(/const TOKEN = "([a-f0-9]+)"/)?.[1]
  const seed = html.match(/const JS_CHALLENGE_SEED = "([a-f0-9]+)"/)?.[1]
  if (!token || !seed) throw new Error('Gagal mengambil token tik.ninja')
  const cookie = (res.headers.getSetCookie?.() || []).map(v => v.split(';')[0]).join('; ')
  return { token, seed, cookie }
}

function decrypt(payload, s) {
  const compact = payload?._t === 'p' && payload._i && payload._d
  const legacy = payload?.enc === true && payload.iv && payload.data
  if (!compact && !legacy) return payload
  const key = crypto.createHash('sha256').update(`${s.seed}:${s.token}:response:tik.ninja`).digest()
  const iv = Buffer.from(compact ? payload._i : payload.iv, 'base64')
  const data = Buffer.from(compact ? payload._d : payload.data, 'base64')
  const d = crypto.createDecipheriv('aes-256-cbc', key, iv)
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString())
}

async function api(s, action, params = {}) {
  const bucket = Math.floor(Date.now() / 30000)
  const jsToken = crypto.createHash('sha256').update(`${s.seed}:${s.token}:${bucket}:${action}:tik.ninja`).digest('hex')
  const body = { ...params, action, hp: '', js_token: jsToken, js_bucket: String(bucket), __client_build: 'js-token-body-v3' }
  const res = await fetch(BASE + '/api.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      Origin: BASE,
      Referer: BASE + '/',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Cache-Control': 'no-store',
      Cookie: s.cookie,
      'X-Api-Token': s.token,
      'X-JS-Token': jsToken,
      'X-JS-Bucket': String(bucket),
      'X-Client-Build': 'js-token-body-v3'
    },
    body: JSON.stringify(body)
  })
  let json
  try {
    json = await res.json()
  } catch {
    throw new Error(`Server error (HTTP ${res.status})`)
  }
  json = decrypt(json, s)
  if (!res.ok) throw new Error(json.error || `Request gagal (${res.status})`)
  return json.data
}

export async function tikninja(username, opts = {}) {
  try {
    const uid = String(username).replace(/^.*tiktok\.com\/@?/i, '').replace(/^@/, '').split(/[/?]/)[0].trim()
    if (!uid) throw new Error('Username wajib diisi')
    const s = await session()
    await new Promise(r => setTimeout(r, 3000))
    const user = await api(s, 'get_user', { unique_id: uid })
    const result = { status: true, user }
    if (opts.posts) {
      const id = user?.user?.id || user?.id || user?.user_id
      result.posts = await api(s, 'get_posts', { user_id: id, cursor: 0, count: opts.count || 20 }).catch(e => ({ error: e.message }))
    }
    if (opts.stories) result.stories = await api(s, 'get_stories', { unique_id: uid }).catch(e => ({ error: e.message }))
    return result
  } catch (e) {
    return { status: false, message: e.message }
  }
}

export default tikninja
