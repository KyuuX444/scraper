/**
 * Creator : Ryza 
 * Ch : https://whatsapp.com/channel/0029VbE4NyXFSAt8jKbRHt2o
 * 
 * note : don't claim this code
 */

import axios from "axios";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

const client = axios.create({
  timeout: 25000,
  headers: HEADERS,
});

function cleanText(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
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
        if (
          cleaned !== null &&
          cleaned !== undefined &&
          (typeof cleaned !== "object" || Object.keys(cleaned).length > 0)
        ) {
          res[k] = cleaned;
        }
      }
    }
    return res;
  }
  return obj;
}

function extractShortcode(input) {
  if (!input) return "";
  const match = input.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (match) return match[1];
  const clean = input.split("/")[0].split("?")[0].trim();
  return /^[A-Za-z0-9_-]{5,}$/.test(clean) ? clean : "";
}

function extractUsername(input) {
  if (!input) return "";
  let clean = input.trim();
  if (clean.includes("instagram.com/stories/")) {
    const part = clean.split("/stories/")[1]?.split("/")[0]?.split("?")[0];
    if (part) return part.replace(/^@+/, "");
  }
  if (clean.includes("instagram.com/")) {
    const part = clean.split("instagram.com/")[1]?.split("/")[0]?.split("?")[0];
    if (part && !["p", "reel", "reels", "tv", "stories", "explore"].includes(part.toLowerCase())) {
      return part.replace(/^@+/, "");
    }
  }
  return clean.replace(/^@+/, "").split("/")[0].split("?")[0].trim();
}

async function resolveCdnUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const res = await axios.head(url, {
      maxRedirects: 0,
      timeout: 10000,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    if (res.headers && res.headers.location) {
      return res.headers.location;
    }
  } catch (err) {
    if (err.response?.headers?.location) {
      return err.response.headers.location;
    }
  }
  return url;
}

export async function scrapeInstagramMedia(url, options = {}) {
  const shortcode = extractShortcode(url);
  if (!shortcode) {
    return {
      status: false,
      message: "Shortcode Instagram tidak valid",
    };
  }

  const isReel = url.includes("/reel/") || url.includes("/reels/");
  const targetUrl = `https://www.vxinstagram.com/${isReel ? "reel" : "p"}/${shortcode}/`;

  try {
    const res = await client.get(targetUrl);
    const html = res.data;
    const $ = cheerio.load(html);

    const jsonLink = $('link[type="application/activity+json"]').attr("href");

    if (jsonLink) {
      const apiRes = await client.get(jsonLink);
      const json = apiRes.data;

      const mediaAttachments = json.media_attachments || [];
      const resolveTasks = [];
      const mediaList = [];

      for (let i = 0; i < mediaAttachments.length; i++) {
        const item = mediaAttachments[i];
        const mediaItem = {
          type: item.type === "video" ? "video" : "image",
          url: item.url || "",
          thumbnail: item.preview_url || "",
          dimensions: item.meta ? `${item.meta.width}x${item.meta.height}` : "",
        };

        mediaList.push(mediaItem);

        if (item.url && options.resolveCdn !== false) {
          resolveTasks.push(
            resolveCdnUrl(item.url).then((direct) => {
              if (direct) mediaItem.url = direct;
            })
          );
        }

        if (item.preview_url && options.resolveCdn !== false) {
          resolveTasks.push(
            resolveCdnUrl(item.preview_url).then((thumb) => {
              if (thumb) mediaItem.thumbnail = thumb;
            })
          );
        }
      }

      if (resolveTasks.length > 0) {
        await Promise.allSettled(resolveTasks);
      }

      let rawContent = json.content || "";
      const statsMatch = rawContent.match(/❤️\s*([\d\.,KMkm]+)[\s\S]*?💬\s*([\d\.,KMkm]+)/);
      const likes = statsMatch ? statsMatch[1] : "";
      const comments = statsMatch ? statsMatch[2] : "";

      const cleanCaption = cleanText(
        rawContent.replace(/<b>[\s\S]*?<\/b>/g, "").replace(/<[^>]+>/g, " ")
      );

      const result = {
        status: true,
        type: isReel ? "reel" : mediaList.length > 1 ? "carousel" : mediaList[0]?.type || "post",
        shortcode,
        url: `https://www.instagram.com/${isReel ? "reel" : "p"}/${shortcode}/`,
        caption: cleanCaption,
        user: {
          username: json.account?.username || "",
          full_name: json.account?.display_name || "",
          avatar: json.account?.avatar || "",
        },
        stats: {
          likes,
          comments,
        },
        media_count: mediaList.length,
        media: mediaList,
      };

      return cleanObject(result);
    }

    const ogVideo =
      $('meta[property="og:video"]').attr("content") ||
      $('meta[property="og:video:secure_url"]').attr("content") ||
      $('meta[name="twitter:player:stream"]').attr("content") ||
      "";

    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      "";

    const title = cleanText($('meta[property="og:title"]').attr("content"));
    const desc = cleanText($('meta[property="og:description"]').attr("content"));

    let resolvedMediaUrl = ogVideo || ogImage;
    if (resolvedMediaUrl && options.resolveCdn !== false) {
      resolvedMediaUrl = await resolveCdnUrl(resolvedMediaUrl);
    }

    let resolvedThumb = ogImage;
    if (resolvedThumb && ogVideo && options.resolveCdn !== false) {
      resolvedThumb = await resolveCdnUrl(resolvedThumb);
    }

    const fallbackResult = {
      status: true,
      type: ogVideo ? (isReel ? "reel" : "video") : "image",
      shortcode,
      url: `https://www.instagram.com/${isReel ? "reel" : "p"}/${shortcode}/`,
      title,
      caption: desc,
      media_count: 1,
      media: [
        {
          type: ogVideo ? "video" : "image",
          url: resolvedMediaUrl,
          thumbnail: resolvedThumb,
        },
      ],
    };

    return cleanObject(fallbackResult);
  } catch (err) {
    return {
      status: false,
      message: err.message,
      shortcode,
    };
  }
}

export async function scrapeInstagramStories(input, options = {}) {
  const username = extractUsername(input);
  if (!username) {
    return {
      status: false,
      message: "Username atau URL story Instagram tidak valid",
    };
  }

  const cookie = options.cookie || process.env.IG_COOKIE || "";

  if (cookie) {
    try {
      const userRes = await client.get(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
        {
          headers: {
            ...HEADERS,
            Cookie: cookie,
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            Referer: `https://www.instagram.com/${username}/`,
          },
        }
      );

      const user = userRes.data?.data?.user;
      if (!user) throw new Error("Gagal mengambil info user");

      const userId = user.id;
      const storyRes = await client.get(
        `https://www.instagram.com/api/v1/feed/user/${userId}/story/`,
        {
          headers: {
            ...HEADERS,
            Cookie: cookie,
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            Referer: `https://www.instagram.com/stories/${username}/`,
          },
        }
      );

      const items = storyRes.data?.reel?.items || [];
      const storiesList = [];

      for (const item of items) {
        const isVideo = item.media_type === 2 || Boolean(item.video_versions);
        const videoUrl = isVideo ? item.video_versions?.[0]?.url || "" : "";
        const imageUrl = item.image_versions2?.candidates?.[0]?.url || "";

        storiesList.push({
          id: String(item.pk || item.id || ""),
          type: isVideo ? "video" : "image",
          url: videoUrl || imageUrl,
          thumbnail: imageUrl,
          taken_at: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : "",
          expiring_at: item.expiring_at ? new Date(item.expiring_at * 1000).toISOString() : "",
        });
      }

      return cleanObject({
        status: true,
        type: "story",
        username,
        user_id: String(userId),
        story_count: storiesList.length,
        stories: storiesList,
      });
    } catch (_) {}
  }

  try {
    const profileRes = await client.get(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      headers: {
        ...HEADERS,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    const html = profileRes.data;
    const $ = cheerio.load(html);

    const ogTitle = cleanText($('meta[property="og:title"]').attr("content"));
    const ogDesc = cleanText(
      $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content")
    );
    const ogImage = $('meta[property="og:image"]').attr("content") || "";

    const fullNameMatch = ogTitle.split("(@")[0].trim();
    const idMatch = html.match(/["']pk["']:\s*["'](\d+)["']/) || html.match(/["']user_id["']:\s*["'](\d+)["']/);
    const userId = idMatch ? idMatch[1] : "";

    const posts = [];
    const mediaMatches =
      html.match(/\{\s*"__typename":\s*"XIGPolaris(?:Image|Video)Media"[\s\S]*?"id":\s*"POLARIS_\d+"\}/g) || [];

    for (const nodeStr of mediaMatches) {
      try {
        const codeM = nodeStr.match(/["']code["']:\s*["'](.*?)["']/);
        const typeM = nodeStr.match(/["']__typename["']:\s*["'](.*?)["']/);
        const dispM = nodeStr.match(/["']display_uri["']:\s*["'](.*?)["']/);
        const capM = nodeStr.match(/["']caption["']:\s*\{\s*["']text["']:\s*["'](.*?)["']\s*\}/);

        const code = codeM ? codeM[1] : "";
        const mediaType = typeM && typeM[1].includes("Video") ? "video" : "image";
        const thumb = dispM ? dispM[1].replace(/\\\//g, "/").replace(/\\u0025/g, "%") : "";
        let cap = "";
        if (capM) {
          try {
            cap = JSON.parse(`"${capM[1]}"`);
          } catch {
            cap = capM[1];
          }
        }

        if (code) {
          posts.push({
            code,
            type: mediaType,
            url: `https://www.instagram.com/p/${code}/`,
            thumbnail: thumb,
            caption: cap,
          });
        }
      } catch (_) {}
    }

    return cleanObject({
      status: true,
      type: "profile",
      username,
      user_id: userId,
      full_name: fullNameMatch || username,
      avatar: ogImage,
      description: ogDesc,
      recent_media_count: posts.length,
      recent_media: posts,
      note: "Untuk story 24 jam akun private/tersembunyi, sertakan options.cookie (sessionid akun IG)",
    });
  } catch (err) {
    return {
      status: false,
      message: err.message,
      username,
    };
  }
}

export async function scrapeInstagram(input, options = {}) {
  if (!input || typeof input !== "string") {
    return {
      status: false,
      message: "URL atau username Instagram diperlukan",
    };
  }

  const cleanInput = input.trim();

  if (
    cleanInput.includes("/reel/") ||
    cleanInput.includes("/reels/") ||
    cleanInput.includes("/p/") ||
    cleanInput.includes("/tv/")
  ) {
    return await scrapeInstagramMedia(cleanInput, options);
  }

  if (cleanInput.includes("/stories/")) {
    return await scrapeInstagramStories(cleanInput, options);
  }

  if (cleanInput.includes("instagram.com/")) {
    return await scrapeInstagramStories(cleanInput, options);
  }

  return await scrapeInstagramStories(cleanInput, options);
}

export default scrapeInstagram;

if (process.argv[1] && process.argv[1].endsWith("instagram.js")) {
  const target = process.argv[2];
  if (!target) {
    console.log("Usage: node instagram.js <link_post_reel_or_username> [--no-resolve-cdn]");
    process.exit(1);
  }

  const resolveCdn = !process.argv.includes("--no-resolve-cdn");

  scrapeInstagram(target, { resolveCdn })
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error(JSON.stringify({ status: false, error: err.message }, null, 2));
      process.exit(1);
    });
}
