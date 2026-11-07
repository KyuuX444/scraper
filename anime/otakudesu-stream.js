/**
 * Creator : Ryza 
 * Ch : https://whatsapp.com/channel/0029VbE4NyXFSAt8jKbRHt2o
 * 
 * note : don't claim this code
 */

import axios from "axios";
import * as cheerio from "cheerio";

const BASE_URL = "https://otakudesu.blog";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: `${BASE_URL}/`,
};

const client = axios.create({
  timeout: 25000,
  headers: HEADERS,
});

function cleanText(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

function resolveUrl(url, base = BASE_URL) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  const cleanPath = url.replace(/^\/+/, "");
  return `${base.replace(/\/+$/, "")}/${cleanPath}`;
}

function cleanObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject).filter((v) => v !== null && v !== undefined);
  }
  if (typeof obj === "object" && obj !== null) {
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined && v !== "") {
        const cleaned = cleanObject(v);
        if (cleaned !== null && cleaned !== undefined && (typeof cleaned !== "object" || Object.keys(cleaned).length > 0)) {
          res[k] = cleaned;
        }
      }
    }
    return res;
  }
  return obj;
}

function extractScriptActions(html) {
  const nonceAction = "aa1208d27f29ca340c92c66d1926f13f";
  const mirrorAction = "2a3505c93b0035d3f455df82bf976b84";

  if (!html || typeof html !== "string") {
    return { nonceAction, mirrorAction };
  }

  const matches = [...html.matchAll(/action\s*:\s*['"]([a-f0-9]{20,40})['"]/gi)];
  if (matches.length >= 2) {
    return {
      nonceAction: matches[0][1],
      mirrorAction: matches[1][1],
    };
  } else if (matches.length === 1) {
    return {
      nonceAction,
      mirrorAction: matches[0][1],
    };
  }

  return { nonceAction, mirrorAction };
}

export async function extractDirectMp4(streamUrl) {
  if (!streamUrl || !streamUrl.startsWith("http")) return null;

  try {
    const res = await client.get(streamUrl, {
      headers: {
        ...HEADERS,
        Referer: `${BASE_URL}/`,
      },
    });

    const html = res.data;
    if (typeof html !== "string") return null;

    let match = html.match(/sources\s*:\s*\[\s*\{\s*['"]file['"]\s*:\s*['"]([^'"]+)['"]/i);
    if (match) return match[1];

    match = html.match(/sources\s*:\s*\[\s*\{\s*['"]src['"]\s*:\s*['"]([^'"]+)['"]/i);
    if (match) return match[1];

    match = html.match(/['"]file['"]\s*:\s*['"](https?:[^'"]+\.(?:mp4|m3u8)[^'"]*)['"]/i);
    if (match) return match[1];

    match = html.match(/<source[^>]+src=["'](https?:[^"']+)["']/i);
    if (match) return match[1];

    return null;
  } catch (_) {
    return null;
  }
}

export async function resolveMirror(dataContent, base = BASE_URL, options = {}) {
  if (!dataContent) return null;

  try {
    let payload = dataContent;
    if (typeof dataContent === "string") {
      try {
        const decoded = Buffer.from(dataContent, "base64").toString("utf-8");
        if (decoded.startsWith("{")) {
          payload = JSON.parse(decoded);
        }
      } catch (_) {}
    }

    const ajaxUrl = `${base.replace(/\/+$/, "")}/wp-admin/admin-ajax.php`;
    const nonceAction = options.nonceAction || "aa1208d27f29ca340c92c66d1926f13f";
    const mirrorAction = options.mirrorAction || "2a3505c93b0035d3f455df82bf976b84";

    let nonce = options.nonce || null;
    if (!nonce) {
      try {
        const nonceParams = new URLSearchParams();
        nonceParams.append("action", nonceAction);
        const nonceRes = await client.post(ajaxUrl, nonceParams.toString(), {
          headers: {
            ...HEADERS,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            Referer: base,
          },
        });

        if (nonceRes.data && typeof nonceRes.data.data === "string") {
          nonce = nonceRes.data.data;
        }
      } catch (_) {}
    }

    const params = new URLSearchParams();
    if (typeof payload === "object" && payload !== null) {
      for (const [k, v] of Object.entries(payload)) {
        params.append(k, String(v));
      }
    } else {
      params.append("data", String(dataContent));
    }

    if (nonce) {
      params.append("nonce", nonce);
    }
    if (!params.has("action")) {
      params.append("action", mirrorAction);
    }

    const res = await client.post(ajaxUrl, params.toString(), {
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: base,
      },
    });

    let rawData = res.data;
    if (rawData && typeof rawData === "object" && rawData.data) {
      try {
        const decodedHtml = Buffer.from(rawData.data, "base64").toString("utf-8");
        if (decodedHtml.includes("<iframe") || decodedHtml.includes("http")) {
          rawData = decodedHtml;
        }
      } catch (_) {}
    }

    if (typeof rawData === "string") {
      const $ = cheerio.load(rawData);
      const iframeSrc = $("iframe").attr("src") || null;
      if (iframeSrc) return resolveUrl(iframeSrc, base);

      const match = rawData.match(/src=["'](https?:[^"']+)["']/i);
      if (match) return match[1];
    }

    return null;
  } catch (_) {
    return null;
  }
}

export async function getOtakudesuStream(target, options = {}) {
  if (!target || typeof target !== "string") {
    return {
      status: false,
      message: "Target URL, slug, or HTML string is required",
    };
  }

  const customBaseUrl = options.baseUrl || BASE_URL;
  const shouldResolveMirrors = options.resolveMirrors !== false;
  const shouldExtractDirect = options.extractDirect !== false;

  let finalUrl = target.trim();
  let html = "";

  const isRawHtml = finalUrl.startsWith("<") || finalUrl.includes("<div") || finalUrl.includes("<html");

  if (isRawHtml) {
    html = finalUrl;
    finalUrl = customBaseUrl;
  } else {
    if (!/^https?:\/\//i.test(finalUrl)) {
      const cleanSlug = finalUrl
        .replace(/^\/+/, "")
        .replace(/^episode\//i, "")
        .replace(/\/+$/, "");
      finalUrl = `${customBaseUrl.replace(/\/+$/, "")}/episode/${cleanSlug}/`;
    }

    try {
      const res = await client.get(finalUrl);
      html = res.data;
    } catch (err) {
      return {
        status: false,
        message: err.message,
        url: finalUrl,
      };
    }
  }

  try {
    const $ = cheerio.load(html);

    const title = cleanText($(".venutama > h1, .venutama h1.posttl, h1.postitle").first().text());
    if (!title && !html.includes("embed_holder") && !html.includes("mirrorstream")) {
      return {
        status: false,
        message: "Episode stream not found or blocked by protection",
        url: finalUrl,
      };
    }

    let defaultStream =
      $("#lightsVideo #embed_holder iframe").attr("src") ||
      $("#embed_holder iframe").attr("src") ||
      $("#pembed iframe").attr("src") ||
      $(".responsive-embed-stream iframe").attr("src") ||
      "";

    if (defaultStream) {
      defaultStream = resolveUrl(defaultStream, customBaseUrl);
    }

    const { nonceAction, mirrorAction } = extractScriptActions(html);

    const servers = {};
    const mirrorTasks = [];

    $(".mirrorstream ul, #embed_holder .mirrorstream ul").each((_, ul) => {
      const cls = $(ul).attr("class") || "";
      const match = cls.match(/m(\d+p)/i);
      const quality = match ? match[1] : cls.replace(/[^a-zA-Z0-9]/g, "") || "unknown";

      if (!servers[quality]) {
        servers[quality] = [];
      }

      $(ul).find("li").each((__, li) => {
        const a = $(li).find("a").first();
        const name = cleanText(a.text()) || "Mirror";
        const dataContent = a.attr("data-content") || "";
        let href = a.attr("href") || "";
        if (href === "#" || href.startsWith("javascript:")) href = "";

        const serverItem = {
          provider: name,
          url: href ? resolveUrl(href, customBaseUrl) : defaultStream,
        };

        if (dataContent) {
          serverItem.content = dataContent;
        }

        servers[quality].push(serverItem);

        if (shouldResolveMirrors && dataContent) {
          mirrorTasks.push(
            resolveMirror(dataContent, customBaseUrl, { nonceAction, mirrorAction }).then((resolvedUrl) => {
              if (resolvedUrl) {
                serverItem.url = resolvedUrl;
              }
            })
          );
        }
      });
    });

    if (mirrorTasks.length > 0) {
      await Promise.allSettled(mirrorTasks);
    }

    const prevEpisode = $(".flir a[href*='/episode/']:contains('Prev'), .flir a:contains('Previous'), .flir a[title*='Sebelumnya']").attr("href") || "";
    const nextEpisode = $(".flir a[href*='/episode/']:contains('Next'), .flir a:contains('Next'), .flir a[title*='Selanjutnya']").attr("href") || "";
    const allEpisodes = $(".flir a[href*='/anime/'], .flir a:contains('See All'), .flir a:contains('Semua')").attr("href") || "";
    const animeTitle = cleanText($(".flir a[href*='/anime/']").first().text()) || "";

    const streamData = {
      default: defaultStream,
    };

    if (shouldExtractDirect && defaultStream) {
      const directMp4 = await extractDirectMp4(defaultStream);
      if (directMp4) {
        streamData.direct_url = directMp4;
      }
    }

    const navigation = {};
    if (prevEpisode) navigation.prev = resolveUrl(prevEpisode, customBaseUrl);
    if (allEpisodes) navigation.all = resolveUrl(allEpisodes, customBaseUrl);
    if (nextEpisode) navigation.next = resolveUrl(nextEpisode, customBaseUrl);

    const animeObj = {};
    if (animeTitle) animeObj.title = animeTitle;
    if (allEpisodes) animeObj.url = resolveUrl(allEpisodes, customBaseUrl);

    const result = {
      status: true,
      title: title || "",
      url: finalUrl,
      stream: streamData,
      servers,
    };

    if (Object.keys(animeObj).length > 0) {
      result.anime = animeObj;
    }

    if (Object.keys(navigation).length > 0) {
      result.navigation = navigation;
    }

    return cleanObject(result);
  } catch (err) {
    return {
      status: false,
      message: err.message,
      url: finalUrl,
    };
  }
}

export default getOtakudesuStream;

if (process.argv[1] && process.argv[1].endsWith("otakudesu-stream.js")) {
  const target = process.argv[2];
  if (!target) {
    console.log("Usage: node otakudesu-stream.js <url_or_slug> [custom_base_url]");
    process.exit(1);
  }

  const customBase = process.argv[3] || BASE_URL;

  getOtakudesuStream(target, { baseUrl: customBase })
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error(JSON.stringify({ status: false, error: err.message }, null, 2));
      process.exit(1);
    });
}
