import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Referer': 'https://www.tiktok.com/',
  'Accept': 'application/json, text/plain, */*'
};

const MOBILE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const ALIGHT_REGEX = /https?:\/\/(?:www\.)?(?:alightcreative\.com\/am\/share\/[^\s'"\)\>]+|alight\.link\/[^\s'"\)\>]+)/gi;
const URL_REGEX = /https?:\/\/[^\s'"\)\>]+/gi;

function formatNumber(num) {
  if (!num || isNaN(num)) return '0';
  return Number(num).toLocaleString('id-ID');
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const d = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
  return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
}

async function getTikTokInfo(url) {
  let targetUrl = url.trim();
  if (targetUrl.includes('vt.tiktok.com') || targetUrl.includes('vm.tiktok.com') || targetUrl.includes('/t/')) {
    const res = await axios.get(targetUrl, {
      headers: MOBILE_HEADERS,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });
    targetUrl = res.request?.res?.responseUrl || targetUrl;
  }

  const match = targetUrl.match(/\/(?:video|photo|v)\/(\d+)/i) || targetUrl.match(/(\d{15,22})/);
  const videoId = match && match[1] ? match[1] : null;
  if (!videoId) {
    throw new Error(`Gagal mendeteksi ID video dari URL: ${url}`);
  }

  let videoMeta = null;
  try {
    const metaRes = await axios.get(`https://m.tiktok.com/v/${videoId}.html`, {
      headers: MOBILE_HEADERS,
      timeout: 8000
    });
    const $ = cheerio.load(metaRes.data);
    const rawJson = $('script#__UNIVERSAL_DATA_FOR_REHYDRATION__').html();
    if (rawJson) {
      const data = JSON.parse(rawJson);
      const scope = data['__DEFAULT_SCOPE__'] || {};
      const detail = scope['webapp.reflow.video.detail'] || scope['webapp.video-detail'];
      const item = detail?.itemInfo?.itemStruct;
      if (item) {
        videoMeta = {
          id: item.id,
          desc: item.desc || '(Tanpa caption)',
          author: {
            username: item.author?.uniqueId || 'unknown',
            nickname: item.author?.nickname || '',
            verified: item.author?.verified || false
          },
          stats: {
            likes: item.stats?.diggCount || 0,
            comments: item.stats?.commentCount || 0,
            shares: item.stats?.shareCount || 0,
            views: item.stats?.playCount || 0
          }
        };
      }
    }
  } catch {}

  return { videoId, videoMeta };
}

async function fetchCommentReplies(videoId, commentId, maxReplies = 30) {
  const replies = [];
  let cursor = 0;
  let hasMore = true;

  while (hasMore && replies.length < maxReplies) {
    try {
      const url = `https://www.tiktok.com/api/comment/list/reply/?aid=1988&app_language=en&app_name=tiktok_web&item_id=${videoId}&comment_id=${commentId}&count=20&cursor=${cursor}`;
      const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
      if (res.data?.comments && Array.isArray(res.data.comments)) {
        for (const item of res.data.comments) {
          replies.push({
            id: item.cid,
            text: item.text || '',
            user: item.user?.unique_id || 'unknown',
            nickname: item.user?.nickname || '',
            likes: item.digg_count || 0,
            time: item.create_time
          });
        }
        hasMore = Boolean(res.data.has_more && res.data.comments.length > 0);
        cursor = res.data.cursor || (cursor + res.data.comments.length);
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return replies;
}

export async function findAlightMotion(inputUrl, maxMainComments = 100) {
  const { videoId, videoMeta } = await getTikTokInfo(inputUrl);
  const foundLinks = new Set();
  const results = [];
  let cursor = 0;
  let hasMore = true;
  let totalMainFetched = 0;
  let totalRepliesFetched = 0;

  while (hasMore && totalMainFetched < maxMainComments) {
    const fetchCount = Math.min(50, maxMainComments - totalMainFetched);
    const url = `https://www.tiktok.com/api/comment/list/?aid=1988&app_language=en&app_name=tiktok_web&aweme_id=${videoId}&count=${fetchCount}&cursor=${cursor}`;
    let res;
    try {
      res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    } catch (err) {
      throw new Error(`Gagal menghubungi API TikTok: ${err.message}`);
    }

    const comments = res.data?.comments || [];
    if (comments.length === 0) break;

    for (const c of comments) {
      totalMainFetched++;
      const text = c.text || '';
      const amMatches = text.match(ALIGHT_REGEX) || [];
      if (amMatches.length > 0) {
        const otherUrls = (text.match(URL_REGEX) || []).filter(u => !amMatches.includes(u));
        for (const amUrl of amMatches) {
          if (!foundLinks.has(amUrl)) {
            foundLinks.add(amUrl);
            results.push({
              link: amUrl,
              type: 'Komentar Utama',
              author: c.user?.unique_id || 'unknown',
              nickname: c.user?.nickname || '',
              likes: c.digg_count || 0,
              time: c.create_time,
              otherLinks: otherUrls
            });
          }
        }
      }

      if (c.reply_comment_total > 0) {
        const replies = await fetchCommentReplies(videoId, c.cid);
        totalRepliesFetched += replies.length;
        for (const r of replies) {
          const rText = r.text || '';
          const rAmMatches = rText.match(ALIGHT_REGEX) || [];
          if (rAmMatches.length > 0) {
            const otherUrls = (rText.match(URL_REGEX) || []).filter(u => !rAmMatches.includes(u));
            for (const amUrl of rAmMatches) {
              if (!foundLinks.has(amUrl)) {
                foundLinks.add(amUrl);
                results.push({
                  link: amUrl,
                  type: `Balasan ke @${c.user?.unique_id || 'user'}`,
                  author: r.user,
                  nickname: r.nickname,
                  likes: r.likes,
                  time: r.time,
                  otherLinks: otherUrls
                });
              }
            }
          }
        }
      }
    }

    hasMore = Boolean(res.data?.has_more && comments.length > 0);
    cursor = res.data?.cursor ?? (cursor + comments.length);
  }

  return {
    videoId,
    videoMeta,
    stats: {
      mainCommentsScanned: totalMainFetched,
      repliesScanned: totalRepliesFetched,
      foundCount: results.length
    },
    results
  };
}

export default findAlightMotion;

// CLI Execution if directly run
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const targetUrl = process.argv[2];
  if (!targetUrl) {
    console.log('Penggunaan : node amfind.js <url_tiktok>');
    console.log('Contoh : node amfind.js https://vt.tiktok.com/ZSbHnpaX6/');
    process.exit(1);
  }

  findAlightMotion(targetUrl).then((data) => {
    if (data.videoMeta) {
      const m = data.videoMeta;
      console.log(`Video ID : ${m.id}`);
      console.log(`Kreator : ${m.author.nickname} (@${m.author.username})`);
      console.log(`Caption : ${m.desc}`);
      console.log(`Statistik : ${formatNumber(m.stats.likes)} likes, ${formatNumber(m.stats.comments)} comments, ${formatNumber(m.stats.shares)} shares, ${formatNumber(m.stats.views)} views`);
    } else {
      console.log(`Video ID : ${data.videoId}`);
    }
    console.log(`Dipindai : ${data.stats.mainCommentsScanned} komentar, ${data.stats.repliesScanned} balasan\n`);

    if (data.results.length === 0) {
      console.log('Hasil : Tidak ada link Alight Motion yang ditemukan.');
    } else {
      data.results.forEach((item, idx) => {
        console.log(`[Preset #${idx + 1}]`);
        console.log(`Link : ${item.link}`);
        console.log(`Pengirim : @${item.author} (${item.nickname})`);
        console.log(`Posisi : ${item.type}`);
        console.log(`Waktu : ${formatDate(item.time)}`);
        console.log(`Likes : ${formatNumber(item.likes)}`);
        if (item.otherLinks && item.otherLinks.length > 0) {
          console.log(`Link Lain :`);
          item.otherLinks.forEach(ol => console.log(`- ${ol}`));
        }
        console.log('');
      });
    }
  }).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
