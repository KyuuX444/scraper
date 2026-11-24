/**
 * Creator : Ryza 
 * Ch : https://whatsapp.com/channel/0029VbE4NyXFSAt8jKbRHt2o
 * 
 * note : don't claim this code
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = Number(bytes);
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(2)} ${units[i]}`;
}

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '-';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) {
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export async function scrapeYoutube(url) {
  if (!url || typeof url !== 'string') {
    return {
      status: false,
      message: 'Parameter URL YouTube diperlukan!'
    };
  }

  const cleanUrl = url.trim();

  try {
    const args = [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      cleanUrl
    ];

    const { stdout } = await execFileAsync('yt-dlp', args, { maxBuffer: 15 * 1024 * 1024 });
    const raw = JSON.parse(stdout);

    const audioList = [];
    const seenBitrates = new Set();
    const audios = (raw.formats || []).filter((f) => f.vcodec === 'none' && f.url && f.ext !== 'mhtml');

    audios.sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));

    for (const a of audios) {
      const abr = Math.round(a.abr || a.tbr || 128);
      const key = `${abr}_${a.ext}`;
      if (!seenBitrates.has(key)) {
        seenBitrates.add(key);
        const sizeBytes = a.filesize || a.filesize_approx;
        audioList.push({
          quality: `${abr} kbps`,
          format: a.ext || 'm4a',
          size: formatBytes(sizeBytes),
          size_bytes: sizeBytes || null,
          url: a.url
        });
      }
    }

    const videoList = [];
    const seenHeights = new Set();
    const videos = (raw.formats || []).filter((f) => f.vcodec !== 'none' && f.height && f.url && f.ext !== 'mhtml');

    videos.sort((a, b) => b.height - a.height);

    for (const v of videos) {
      const qualityLabel = `${v.height}p`;
      if (!seenHeights.has(qualityLabel)) {
        seenHeights.add(qualityLabel);
        const sizeBytes = v.filesize || v.filesize_approx;
        videoList.push({
          quality: qualityLabel,
          resolution: v.resolution || `${v.width}x${v.height}`,
          fps: v.fps || 30,
          format: v.ext || 'mp4',
          has_audio: v.acodec !== 'none',
          size: formatBytes(sizeBytes),
          size_bytes: sizeBytes || null,
          url: v.url
        });
      }
    }

    return {
      status: true,
      data: {
        id: raw.id,
        url: `https://www.youtube.com/watch?v=${raw.id}`,
        title: raw.title,
        description: raw.description ? raw.description.slice(0, 300) : '',
        channel: {
          id: raw.channel_id,
          name: raw.channel || raw.uploader,
          url: raw.channel_url || raw.uploader_url
        },
        duration: {
          seconds: raw.duration,
          formatted: formatDuration(raw.duration)
        },
        views: Number(raw.view_count || 0).toLocaleString(),
        thumbnail: raw.thumbnail || `https://i.ytimg.com/vi/${raw.id}/hqdefault.jpg`,
        downloads: {
          mp3: audioList,
          mp4: videoList
        }
      }
    };
  } catch (err) {
    return {
      status: false,
      message: `Gagal scrape YouTube: ${err.message}`
    };
  }
}

export default scrapeYoutube;
