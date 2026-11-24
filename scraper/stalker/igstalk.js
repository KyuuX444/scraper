/**
 * Creator : Ryza 
 * Ch : https://whatsapp.com/channel/0029VbE4NyXFSAt8jKbRHt2o
 * 
 * note : don't claim this code
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

function cleanUsername(input) {
  if (!input) return '';
  let str = input.trim();
  if (str.includes('instagram.com/')) {
    str = str.split('instagram.com/')[1].split('/')[0].split('?')[0];
  }
  return str.replace(/^@+/, '').trim();
}

export async function igStalk(username) {
  const user = cleanUsername(username);
  if (!user) {
    return {
      status: false,
      message: 'Username Instagram diperlukan!'
    };
  }

  try {
    const directRes = await axios.get(`https://www.instagram.com/${encodeURIComponent(user)}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });

    const html = directRes.data;
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';

    let fullName = '';
    let biography = '';
    let followerCount = null;
    let followingCount = null;
    let postsCount = null;

    if (ogDesc) {
      const statMatch = ogDesc.match(/([\d\.,KMkm]+)\s+Followers,\s*([\d\.,KMkm]+)\s+Following,\s*([\d\.,KMkm]+)\s+Posts/i);
      if (statMatch) {
        followerCount = statMatch[1];
        followingCount = statMatch[2];
        postsCount = statMatch[3];
      }
      const bioMatch = ogDesc.match(/on Instagram:\s*"(.*?)"\.?$/);
      if (bioMatch) {
        biography = bioMatch[1];
      }
    }

    if (ogTitle) {
      fullName = ogTitle.split('(@')[0].trim();
    }

    const mFn = html.match(/["']full_name["']:\s*["'](.*?)["']/);
    if (mFn) {
      try {
        fullName = JSON.parse(`"${mFn[1]}"`);
      } catch {
        fullName = mFn[1];
      }
    }

    const mBio = html.match(/["']biography["']:\s*["'](.*?)["']/);
    if (mBio && !biography) {
      try {
        biography = JSON.parse(`"${mBio[1]}"`);
      } catch {
        biography = mBio[1];
      }
    }

    const mId = html.match(/["']pk["']:\s*["'](\d+)["']/) || html.match(/["']user_id["']:\s*["'](\d+)["']/);
    const userId = mId ? mId[1] : null;

    const isVerified = /["']is_verified["']:\s*true/.test(html);
    const isPrivate = /["']is_private["']:\s*true/.test(html);

    const mExt = html.match(/["']external_url["']:\s*["'](.*?)["']/);
    const externalUrl = mExt ? mExt[1].replace(/\\/g, '') : null;

    const posts = [];
    const mediaMatches = html.match(/\{\s*"__typename":\s*"XIGPolaris(?:Image|Video)Media"[\s\S]*?"id":\s*"POLARIS_\d+"\}/g) || [];

    for (const nodeStr of mediaMatches) {
      try {
        const codeM = nodeStr.match(/["']code["']:\s*["'](.*?)["']/);
        const pkM = nodeStr.match(/["']pk["']:\s*["'](.*?)["']/);
        const typeM = nodeStr.match(/["']__typename["']:\s*["'](.*?)["']/);
        const prodM = nodeStr.match(/["']product_type["']:\s*["'](.*?)["']/);
        const dispM = nodeStr.match(/["']display_uri["']:\s*["'](.*?)["']/);
        const capM = nodeStr.match(/["']caption["']:\s*\{\s*["']text["']:\s*["'](.*?)["']\s*\}/);
        const altM = nodeStr.match(/["']accessibility_caption["']:\s*["'](.*?)["']/);

        const code = codeM ? codeM[1] : null;
        const pk = pkM ? pkM[1] : null;
        const mediaType = (typeM && typeM[1].includes('Video')) ? 'video' : 'image';
        const productType = prodM ? prodM[1] : 'feed';
        const thumbnail = dispM ? dispM[1].replace(/\\\//g, '/').replace(/\\u0025/g, '%') : null;

        let caption = null;
        if (capM) {
          try {
            caption = JSON.parse(`"${capM[1]}"`);
          } catch {
            caption = capM[1];
          }
        }

        let accessibilityCaption = null;
        if (altM) {
          try {
            accessibilityCaption = JSON.parse(`"${altM[1]}"`);
          } catch {
            accessibilityCaption = altM[1];
          }
        }

        if (code) {
          const postUrl = productType === 'clips' ? `https://www.instagram.com/reel/${code}/` : `https://www.instagram.com/p/${code}/`;
          posts.push({
            id: pk,
            code: code,
            url: postUrl,
            type: mediaType,
            product_type: productType,
            caption: caption,
            accessibility_caption: accessibilityCaption,
            thumbnail: thumbnail
          });
        }
      } catch {}
    }

    const seenCodes = new Set();
    const uniquePosts = [];
    for (const p of posts) {
      if (!seenCodes.has(p.code)) {
        seenCodes.add(p.code);
        uniquePosts.push(p);
      }
    }

    if (fullName || ogTitle || userId) {
      return {
        status: true,
        data: {
          user: {
            id: userId,
            username: user,
            full_name: fullName || user,
            biography: biography || '',
            external_url: externalUrl,
            profile_pic_url: ogImage || null,
            is_verified: isVerified,
            is_private: isPrivate,
            stats: {
              followers: followerCount,
              following: followingCount,
              posts: postsCount || uniquePosts.length
            }
          },
          recent_posts: {
            count: uniquePosts.length,
            items: uniquePosts
          }
        }
      };
    }
  } catch {}

  try {
    const res = await axios.get(`https://insta-stories-viewer.com/${encodeURIComponent(user)}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(res.data);
    const statsText = $('.profile__stats, .stats, .counts').text().replace(/\s+/g, ' ').trim();
    
    let postsCount = null;
    let followerCount = null;
    let followingCount = null;

    const statPost = statsText.match(/([\d\.,KMkm]+)\s*Posts/i);
    const statFol = statsText.match(/([\d\.,KMkm]+)\s*Followers/i);
    const statFoll = statsText.match(/([\d\.,KMkm]+)\s*Following/i);

    if (statPost) postsCount = statPost[1];
    if (statFol) followerCount = statFol[1];
    if (statFoll) followingCount = statFoll[1];

    const avatar = $('.profile__avatar img, .avatar img, img[alt*="profile"]').attr('src') || $('img').first().attr('src') || null;
    const fullName = $('.profile__name, .profile-title, h1').first().text().replace(/\(Anonymous profile view\)/gi, '').trim() || user;
    const bio = $('.profile__bio, .bio, .description').text().trim();

    const idMatch = res.data.match(/USER_ID\s*=\s*(\d+)/);
    const userId = idMatch ? idMatch[1] : null;

    return {
      status: true,
      data: {
        user: {
          id: userId,
          username: user,
          full_name: fullName,
          biography: bio,
          external_url: null,
          profile_pic_url: avatar,
          is_verified: true,
          is_private: false,
          stats: {
            followers: followerCount,
            following: followingCount,
            posts: postsCount
          }
        },
        recent_posts: {
          count: 0,
          items: []
        }
      }
    };
  } catch (err) {
    return {
      status: false,
      message: `Gagal mengambil data profil @${user}: ${err.message}`
    };
  }
}

export default igStalk;
