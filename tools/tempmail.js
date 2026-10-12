import axios from 'axios'

const BASE_URL = 'https://tempmail.ing'
const API_BASE = 'https://api.tempmail.ing'

const headers = {
  'Content-Type': 'application/json',
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/id/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

/**
 * Generate Temporary Email
 * @param {number} duration - Durasi dalam menit (opsional, default: 10)
 * @returns {Promise<{ address: string, expiresAt: string, createdAt: string, durationMinutes: number }>}
 */
export async function generateMail(duration = 10) {
  try {
    const { data } = await axios.post(
      `${API_BASE}/api/generate`,
      { duration: Number(duration) || 10 },
      { headers, timeout: 15000 }
    )

    if (!data?.success) {
      throw new Error(data?.error || 'Gagal membuat email sementara')
    }

    return data.email
  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error('Terkena rate limit, coba lagi beberapa saat ya sayang~')
    }
    throw new Error(error.response?.data?.error || error.message)
  }
}

/**
 * Read Inbox / Emails
 * @param {string} emailAddress - Alamat email yang ingin dicek
 * @returns {Promise<Array<{ id: string|number, from_address: string, subject: string, text: string, content: string, received_at: string, is_read: boolean }>>}
 */
export async function readMail(emailAddress) {
  if (!emailAddress) {
    throw new Error('Alamat email harus diisi ya sayang!')
  }

  try {
    const cleanEmail = emailAddress.trim().toLowerCase()
    const { data } = await axios.get(
      `${API_BASE}/api/emails/${encodeURIComponent(cleanEmail)}`,
      { headers, timeout: 15000 }
    )

    if (!data?.success) {
      throw new Error(data?.error || 'Gagal membaca kotak masuk')
    }

    return Array.isArray(data.emails) ? data.emails : []
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message)
  }
}

/**
 * Delete Email Message by ID
 * @param {string|number} emailId
 * @param {string} emailAddress
 */
export async function deleteMail(emailId, emailAddress) {
  try {
    const { data } = await axios.delete(
      `${API_BASE}/api/emails/${emailId}`,
      {
        headers,
        data: { emailAddress: emailAddress.trim() },
        timeout: 15000
      }
    )
    return data?.success || false
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message)
  }
}

export default {
  generateMail,
  readMail,
  deleteMail
}
