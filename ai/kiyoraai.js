/**
 * =============================================================
 *  NAME       : KIYORA AI SCRAPER & API
 *  AUTHOR     : Mommy Kyuu
 *  CHANNEL    : https://whatsapp.com/channel/0029VbDO8tI2phHLTSN2ed0U
 *  TELEGRAM   : @kyumasihcowo
 * =============================================================
 *  NOTE:
 *  JANGAN DI CLAIM ASU
 * =============================================================
 */

import axios from "axios";

const CREATOR = "Mommy Kyuu";
const BASE_URL = "https://kiyoraai.vercel.app";
const IMAGE_API = "https://zelora-api.vercel.app/ai/imagine";

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Referer": `${BASE_URL}/`,
  "Origin": BASE_URL
};

const sessions = new Map();

export class KiyoraAI {
  constructor(sessionId = "default") {
    this.sessionId = sessionId;
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }
  }

  async chat(prompt) {
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return {
        status: false,
        creator: CREATOR,
        error: "Prompt parameter must be a non-empty string"
      };
    }

    const history = sessions.get(this.sessionId) || [];
    history.push({ role: "user", content: prompt.trim() });

    try {
      const response = await axios.post(
        `${BASE_URL}/api/chat`,
        { history },
        { headers: HEADERS, timeout: 60000 }
      );

      const reply = response.data?.text || response.data;
      history.push({ role: "assistant", content: reply });
      sessions.set(this.sessionId, history);

      return {
        status: true,
        creator: CREATOR,
        sessionId: this.sessionId,
        result: reply,
        history
      };
    } catch (error) {
      history.pop();
      sessions.set(this.sessionId, history);
      return {
        status: false,
        creator: CREATOR,
        sessionId: this.sessionId,
        error: error.response?.data?.message || error.message
      };
    }
  }

  reset() {
    sessions.set(this.sessionId, []);
    return {
      status: true,
      creator: CREATOR,
      sessionId: this.sessionId,
      message: "Session reset successfully"
    };
  }

  getHistory() {
    return {
      status: true,
      creator: CREATOR,
      sessionId: this.sessionId,
      history: sessions.get(this.sessionId) || []
    };
  }

  static imagine(prompt) {
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return {
        status: false,
        creator: CREATOR,
        error: "Prompt parameter must be a non-empty string"
      };
    }

    return {
      status: true,
      creator: CREATOR,
      result: {
        prompt: prompt.trim(),
        url: `${IMAGE_API}?prompt=${encodeURIComponent(prompt.trim())}`
      }
    };
  }
}

export async function chat(prompt, sessionId = "default") {
  const bot = new KiyoraAI(sessionId);
  return await bot.chat(prompt);
}

export async function resetSession(sessionId = "default") {
  const bot = new KiyoraAI(sessionId);
  return bot.reset();
}

export async function getHistory(sessionId = "default") {
  const bot = new KiyoraAI(sessionId);
  return bot.getHistory();
}

export function imagine(prompt) {
  return KiyoraAI.imagine(prompt);
}

export default {
  KiyoraAI,
  chat,
  resetSession,
  getHistory,
  imagine
};
