import axios from 'axios'

const BASE_URL = 'https://am.kyzzz.xyz'
const GUERRILLA_BASE = 'https://api.guerrillamail.com/ajax.php'

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}

/**
 * Generate Temporary Email from Guerrilla Mail
 * @returns {Promise<{ email: string, sid: string, alias: string }>}
 */
export async function createGuerrillaMail() {
  try {
    const { data } = await axios.get(`${GUERRILLA_BASE}?f=get_email_address`, { timeout: 15000 })
    const email = data?.email_addr
    const sid = data?.sid_token
    if (!email || !sid) throw new Error('Gagal membuat temporary email Guerrilla.')
    return {
      email,
      sid,
      alias: data?.alias || ''
    }
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message)
  }
}

/**
 * Read Inbox / Check emails from Guerrilla Mail
 * @param {string} emailAddress - Alamat email atau username Guerrilla
 * @returns {Promise<Array<{ id: string, from: string, subject: string, date: string, excerpt: string, magicLink: string|null }>>}
 */
export async function readInbox(emailAddress) {
  if (!emailAddress) {
    throw new Error('Alamat email atau username Guerrilla harus diisi.')
  }

  const username = emailAddress.includes('@') ? emailAddress.split('@')[0] : emailAddress

  try {
    const { data: initData } = await axios.get(`${GUERRILLA_BASE}?f=get_email_address`, { timeout: 15000 })
    const sid = initData?.sid_token
    if (!sid) throw new Error('Gagal inisialisasi sesi Guerrilla Mail.')

    await axios.get(`${GUERRILLA_BASE}?f=set_email_user&email_user=${encodeURIComponent(username)}&sid_token=${sid}`, { timeout: 15000 })

    const { data: chkData } = await axios.get(`${GUERRILLA_BASE}?f=check_email&seq=0&sid_token=${sid}`, { timeout: 15000 })
    const list = (chkData?.list || []).filter(item => String(item.mail_id) !== '1')

    const messages = []
    for (const msg of list.slice(0, 5)) {
      const { data: mailDetail } = await axios.get(`${GUERRILLA_BASE}?f=fetch_email&email_id=${msg.mail_id}&sid_token=${sid}`, { timeout: 15000 })
      const body = mailDetail?.mail_body || msg.mail_excerpt || ''
      const urls = body.match(/https?:\/\/[^\s"'<>]+/g) || []
      const magic = urls.find(u => u.includes('oobCode') || u.includes('alight') || u.includes('apiKey') || u.includes('signInWithEmailLink'))

      messages.push({
        id: msg.mail_id,
        from: msg.mail_from || '-',
        subject: msg.mail_subject || '-',
        date: msg.mail_date || '-',
        excerpt: msg.mail_excerpt || '',
        magicLink: magic ? magic.replace(/&amp;/g, '&') : null
      })
    }

    return messages
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message)
  }
}

/**
 * Wait and fetch magic link from Guerrilla Mail inbox
 * @param {string} sid - Guerrilla sid_token
 * @param {number} timeoutSec - Timeout in seconds (default: 50)
 * @returns {Promise<string>}
 */
export async function waitMagicLinkGuerrilla(sid, timeoutSec = 50) {
  const maxTime = timeoutSec * 1000
  const start = Date.now()

  while (Date.now() - start < maxTime) {
    await new Promise(resolve => setTimeout(resolve, 2500))

    const { data } = await axios.get(`${GUERRILLA_BASE}?f=check_email&seq=0&sid_token=${sid}`, { timeout: 15000 })
    const list = data?.list || []

    const amMsg = list.find(m => {
      const subject = (m.mail_subject || '').toLowerCase()
      const from = (m.mail_from || '').toLowerCase()
      return subject.includes('alight') || subject.includes('sign in') || from.includes('firebase') || from.includes('alight')
    })

    if (amMsg) {
      const { data: mailDetail } = await axios.get(`${GUERRILLA_BASE}?f=fetch_email&email_id=${amMsg.mail_id}&sid_token=${sid}`, { timeout: 15000 })
      const body = mailDetail?.mail_body || ''
      const urls = body.match(/https?:\/\/[^\s"'<>]+/g) || []
      const magic = urls.find(u => u.includes('oobCode') || u.includes('alight') || u.includes('apiKey') || u.includes('signInWithEmailLink'))
      if (magic) {
        return magic.replace(/&amp;/g, '&')
      }
    }
  }

  throw new Error('Timeout menunggu link verifikasi dari Alight Motion.')
}

/**
 * Send Verification Link to Email
 * @param {string} email - Alamat email target
 */
export async function sendVerificationLink(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Alamat email valid diperlukan.')
  }

  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/send-link`,
      { email: email.trim() },
      { headers: HEADERS, timeout: 20000 }
    )
    return data
  } catch (error) {
    throw new Error(error.response?.data?.error || error.response?.data?.message || error.message)
  }
}

/**
 * Verify Magic Link to activate Alight Motion Pro
 * @param {string} email
 * @param {string} link
 */
export async function verifyAccount(email, link) {
  if (!email || !link) {
    throw new Error('Email dan verification link diperlukan.')
  }

  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/verify`,
      { email: email.trim(), link: link.trim() },
      { headers: HEADERS, timeout: 25000 }
    )
    return data
  } catch (error) {
    throw new Error(error.response?.data?.error || error.response?.data?.message || error.message)
  }
}

/**
 * Generate 1 Account Alight Motion Pro (Full Auto)
 */
export async function generateAccount() {
  const { email, sid } = await createGuerrillaMail()
  await sendVerificationLink(email)
  const magicLink = await waitMagicLinkGuerrilla(sid, 50)
  const verifData = await verifyAccount(email, magicLink)

  return {
    status: true,
    email,
    orderId: verifData?.orderId || null,
    uid: verifData?.uid || null,
    isNewUser: verifData?.isNewUser ?? true,
    magicLink
  }
}

/**
 * Bulk Generate Accounts
 * @param {number} count - Jumlah akun (default: 1, max: 5)
 * @param {number} concurrency - Concurrency worker (default: 2)
 */
export async function bulkGenerateAccounts(count = 1, concurrency = 2) {
  const total = Math.min(Math.max(parseInt(count) || 1, 1), 5)
  const conc = Math.min(Math.max(parseInt(concurrency) || 2, 1), total)
  const queue = Array.from({ length: total }, (_, i) => i + 1)
  const success = []
  const failed = []

  async function worker() {
    while (queue.length > 0) {
      const idx = queue.shift()
      try {
        const acc = await generateAccount()
        success.push({ index: idx, ...acc })
      } catch (err) {
        failed.push({ index: idx, error: err.message })
      }
    }
  }

  const workers = Array.from({ length: conc }, () => worker())
  await Promise.all(workers)

  return {
    status: true,
    total_requested: total,
    total_success: success.length,
    total_failed: failed.length,
    accounts: success,
    errors: failed.length ? failed : undefined
  }
}

export default {
  createGuerrillaMail,
  readInbox,
  waitMagicLinkGuerrilla,
  sendVerificationLink,
  verifyAccount,
  generateAccount,
  bulkGenerateAccounts
}
