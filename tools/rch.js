import { ProxyAgent } from 'undici'

async function getIkyProxyList() {
  try {
    const res = await fetch('https://api.ikyyxd.my.id/v2l/proxy-free/ikyy-xsample', {
      signal: AbortSignal.timeout(6000)
    })
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data
      .map((item) => {
        const parts = String(item).trim().split(':')
        if (parts.length === 4) {
          return { server: `http://${parts[0]}:${parts[1]}`, username: parts[2], password: parts[3] }
        }
        if (parts.length === 2) {
          return { server: `http://${parts[0]}:${parts[1]}` }
        }
        return null
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function createProxyAgent(proxy) {
  if (proxy.username && proxy.password) {
    const url = new URL(proxy.server)
    url.username = proxy.username
    url.password = proxy.password
    return new ProxyAgent(url.toString())
  }
  return new ProxyAgent(proxy.server)
}

export async function reachChannel(url, emojis, name = 'Angela') {
  try {
    const cleanName = String(name).trim().replace(/\s+/g, ' ').slice(0, 40)
    const cleanUrl = String(url).trim()
    const cleanEmojis = String(emojis).trim()

    if (!/whatsapp\.com\/channel\/[^/]+\/[^/]+/i.test(cleanUrl)) {
      throw new Error('Format URL postingan WhatsApp Channel tidak valid.')
    }
    if (!cleanEmojis) {
      throw new Error('Emoji reaction tidak boleh kosong.')
    }

    const proxies = await getIkyProxyList()
    const maxAttempts = proxies.length > 0 ? Math.min(3, proxies.length) : 1
    let lastError = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null
      const dispatcher = proxy ? createProxyAgent(proxy) : undefined

      try {
        const res = await fetch('https://www.leovan.my.id/api/react', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://www.leovan.my.id',
            'Referer': 'https://www.leovan.my.id/'
          },
          body: JSON.stringify({ name: cleanName, url: cleanUrl, emojis: cleanEmojis }),
          dispatcher,
          signal: AbortSignal.timeout(15000)
        })
        const data = await res.json()
        return {
          ok: res.ok && data?.status !== false,
          status: res.status,
          proxy: proxy ? proxy.server : 'direct',
          data
        }
      } catch (err) {
        lastError = err
      } finally {
        if (dispatcher) {
          await dispatcher.close().catch(() => {})
        }
      }
    }

    throw lastError || new Error('Gagal terhubung ke server melalui proxy')
  } catch (err) {
    return { ok: false, status: 0, error: err.message || 'Gagal terhubung ke server' }
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
if (isMain) {
  const [, , urlArg, emojiArg, nameArg] = process.argv
  if (!urlArg || !emojiArg) {
    console.error('Pemakaian: node rch.js <url_channel> <emoji> [nama]')
    process.exit(1)
  }
  const hasil = await reachChannel(urlArg, emojiArg, nameArg || 'Angela')
  console.log(JSON.stringify(hasil, null, 2))
}
