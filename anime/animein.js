/**
 * =============================================================
 *  NAME       : animein scraper
 *  AUTHOR     : Mommy Kyuu
 *  CHANNEL    : https://whatsapp.com/channel/0029VbDO8tI2phHLTSN2ed0U
 *  TELEGRAM   : @kyumasihcowo
 * =============================================================
 *  NOTE:
 *  JANGAN DI CLAIM ASU
 * =============================================================
 */

import axios from "axios";

const BASE_URL = "https://animeinweb.com";
const API_BASE = "https://animeinweb.com/api/proxy";
const PROXY_SECRET = "animein-secure-proxy-key-123";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": `${BASE_URL}/`,
    "Origin": BASE_URL,
    "x-proxy-secret": PROXY_SECRET,
    "Accept": "application/json, text/plain, */*"
  }
});

function parseGenres(genreStr) {
  if (!genreStr) return [];
  if (Array.isArray(genreStr)) return genreStr;
  return genreStr.split(",").map(g => g.trim()).filter(Boolean);
}

function cleanId(input) {
  if (!input) return "";
  let s = String(input).trim();
  s = s.replace(/^https?:\/\/animeinweb\.com\/anime\//i, "");
  s = s.replace(/^https?:\/\/animeinweb\.com\/watch\//i, "");
  s = s.split("/")[0].split("?")[0].trim();
  return s;
}

function formatAnimeItem(item) {
  if (!item) return null;
  return {
    id: item.id,
    title: item.title,
    synonyms: item.synonyms || null,
    url: `${BASE_URL}/anime/${item.id}`,
    type: item.type || null,
    status: item.status || null,
    day: item.day || null,
    year: item.year || null,
    views: item.views ? parseInt(item.views) : null,
    favorites: item.favorites ? parseInt(item.favorites) : null,
    genres: parseGenres(item.genre || item.genres),
    poster: item.image_poster || item.poster || null,
    cover: item.image_cover || item.cover || null,
    aired_start: item.aired_start || null,
    synopsis: item.synopsis || null
  };
}

export class AnimeInScraper {
  async getHome(day = null) {
    const currentDay = day ? day.toUpperCase() : "KAMIS";
    const res = await client.get(`/3/2/home/data?day=${encodeURIComponent(currentDay)}&limit=20`);
    const data = res.data?.data || {};

    return {
      status: true,
      data: {
        today: (data.today || []).map(formatAnimeItem),
        popular: (data.popular || []).map(formatAnimeItem),
        new: (data.new || []).map(formatAnimeItem),
        hot: (data.hot || []).map(formatAnimeItem),
        slider: (data.slider || []).map(formatAnimeItem),
        waiting: (data.waiting || []).map(formatAnimeItem)
      }
    };
  }

  async search(keyword, page = 0, sort = "views") {
    if (!keyword) throw new Error("Search keyword wajib diisi.");
    const p = Math.max(0, parseInt(page) || 0);
    const res = await client.get(`/3/2/explore/movie?page=${p}&sort=${encodeURIComponent(sort)}&keyword=${encodeURIComponent(keyword)}`);
    const movies = res.data?.data?.movie || [];

    return {
      status: true,
      keyword,
      pagination: {
        currentPage: p,
        totalItems: movies.length
      },
      data: movies.map(formatAnimeItem)
    };
  }

  async getLatest(page = 0) {
    const p = Math.max(0, parseInt(page) || 0);
    const res = await client.get(`/3/2/explore/movie?page=${p}&sort=latest&keyword=`);
    const movies = res.data?.data?.movie || [];

    return {
      status: true,
      pagination: {
        currentPage: p,
        totalItems: movies.length
      },
      data: movies.map(formatAnimeItem)
    };
  }

  async getPopular(page = 0) {
    const p = Math.max(0, parseInt(page) || 0);
    const res = await client.get(`/3/2/explore/movie?page=${p}&sort=views&keyword=`);
    const movies = res.data?.data?.movie || [];

    return {
      status: true,
      pagination: {
        currentPage: p,
        totalItems: movies.length
      },
      data: movies.map(formatAnimeItem)
    };
  }

  async getGenres() {
    const res = await client.get("/3/2/explore/genre");
    const genres = res.data?.data?.genre || [];
    return {
      status: true,
      total: genres.length,
      data: genres.map(g => ({
        id: g.id,
        name: g.name,
        group: g.group,
        image: g.image
      }))
    };
  }

  async getByGenre(genreNameOrId, page = 0, sort = "views") {
    if (!genreNameOrId) throw new Error("Nama genre atau ID genre wajib diisi.");
    let genreId = genreNameOrId;

    if (isNaN(genreNameOrId)) {
      const allGenres = await this.getGenres();
      const target = allGenres.data.find(g => g.name.toLowerCase() === genreNameOrId.toLowerCase().trim());
      if (target) {
        genreId = target.id;
      } else {
        throw new Error(`Genre "${genreNameOrId}" tidak ditemukan.`);
      }
    }

    const p = Math.max(0, parseInt(page) || 0);
    const res = await client.get(`/3/2/explore/movie?page=${p}&sort=${encodeURIComponent(sort)}&id_genre=${encodeURIComponent(genreId)}`);
    const movies = res.data?.data?.movie || [];

    return {
      status: true,
      genre_id: genreId,
      pagination: {
        currentPage: p,
        totalItems: movies.length
      },
      data: movies.map(formatAnimeItem)
    };
  }

  async getSchedule(day = null) {
    const days = day ? [day.toUpperCase()] : ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU"];
    const scheduleData = {};

    for (const d of days) {
      try {
        const res = await client.get(`/3/2/home/data?day=${encodeURIComponent(d)}&limit=50`);
        scheduleData[d] = (res.data?.data?.today || []).map(formatAnimeItem);
      } catch (e) {
        scheduleData[d] = [];
      }
    }

    return {
      status: true,
      data: scheduleData
    };
  }

  async getDetail(animeIdOrUrl, includeEpisodes = true) {
    const id = cleanId(animeIdOrUrl);
    if (!id) throw new Error("ID atau URL anime wajib diisi. Contoh: node animein.js detail 426");

    const res = await client.get(`/3/2/movie/detail/${encodeURIComponent(id)}`);
    const movie = res.data?.data?.movie;
    if (!movie) throw new Error(`Anime dengan ID ${id} tidak ditemukan.`);

    let episodes = [];
    if (includeEpisodes) {
      episodes = await this.getEpisodes(id);
    }

    return {
      status: true,
      data: {
        ...formatAnimeItem(movie),
        studio: movie.studio || "-",
        aired_end: movie.aired_end || null,
        total_episodes: episodes.length,
        episodes: episodes
      }
    };
  }

  async getEpisodes(animeIdOrUrl, page = 0) {
    const id = cleanId(animeIdOrUrl);
    if (!id) throw new Error("ID anime wajib diisi.");

    const res = await client.get(`/3/2/movie/episode/${encodeURIComponent(id)}?page=${page}`);
    const eps = res.data?.data?.episode || [];

    return eps.map(e => ({
      id: e.id,
      episode_number: e.index,
      title: e.title,
      views: e.views ? parseInt(e.views) : 0,
      release_date: e.key_time || null,
      image: e.image ? (e.image.startsWith("http") ? e.image : `https://xyz-api.animein.net/${e.image.replace(/^\/+/, "")}`) : null,
      is_new: e.is_new === "1",
      stream_api_url: `${BASE_URL}/api/proxy/3/2/episode/streamnew/${e.id}`
    }));
  }

  async getStream(episodeIdOrUrl) {
    const epId = cleanId(episodeIdOrUrl);
    if (!epId) throw new Error("ID Episode wajib diisi. Contoh: node animein.js stream 7364");

    const res = await client.get(`/3/2/episode/streamnew/${encodeURIComponent(epId)}`);
    const d = res.data?.data || {};

    const episodeInfo = d.episode || {};
    const nextEpisode = d.episode_next || null;
    const servers = (d.server || []).map(s => ({
      id: s.id,
      name: s.name,
      quality: s.quality,
      type: s.type,
      file_size_mb: s.key_file_size ? parseFloat(s.key_file_size) : null,
      url: s.link,
      server_id: s.server_id
    }));

    return {
      status: true,
      episode: {
        id: episodeInfo.id,
        title: episodeInfo.title,
        episode_number: episodeInfo.index,
        views: episodeInfo.views ? parseInt(episodeInfo.views) : 0,
        release_date: episodeInfo.key_time || null,
        next_episode_id: nextEpisode?.id || null
      },
      servers: servers
    };
  }

  async getFullScrape(animeIdOrUrl, concurrency = 3) {
    const detail = await this.getDetail(animeIdOrUrl, true);
    const anime = detail.data;
    const episodes = anime.episodes || [];

    const fullEpisodes = [];
    for (let i = 0; i < episodes.length; i += concurrency) {
      const batch = episodes.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async ep => {
          try {
            const st = await this.getStream(ep.id);
            return {
              ...ep,
              servers: st.servers
            };
          } catch (err) {
            return {
              ...ep,
              error: err.message,
              servers: []
            };
          }
        })
      );
      fullEpisodes.push(...batchResults);
    }

    return {
      status: true,
      data: {
        ...anime,
        episodes: fullEpisodes
      }
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(JSON.stringify({
      status: true,
      usage: "node animein.js <command> [arguments]",
      commands: {
        search: "node animein.js search <query> [page]",
        latest: "node animein.js latest [page]",
        popular: "node animein.js popular [page]",
        schedule: "node animein.js schedule [day]",
        genre: "node animein.js genre <name_or_id> [page]",
        genres: "node animein.js genres",
        detail: "node animein.js detail <id_or_url>",
        episodes: "node animein.js episodes <anime_id> [page]",
        stream: "node animein.js stream <episode_id>",
        full: "node animein.js full <id_or_url>",
        home: "node animein.js home"
      }
    }, null, 2));
    process.exit(0);
  }

  const minified = args.includes("--min");
  const filteredArgs = args.filter(a => a !== "--min");

  const concurrencyIndex = filteredArgs.indexOf("--concurrency");
  let concurrency = 3;
  if (concurrencyIndex !== -1 && filteredArgs[concurrencyIndex + 1]) {
    concurrency = parseInt(filteredArgs[concurrencyIndex + 1]) || 3;
    filteredArgs.splice(concurrencyIndex, 2);
  }

  const command = (filteredArgs[0] || "").toLowerCase();
  const param1 = filteredArgs[1];
  const param2 = filteredArgs[2];

  const scraper = new AnimeInScraper();
  let result = null;

  const handlers = {
    search: () => scraper.search(param1, param2 || 0),
    serach: () => scraper.search(param1, param2 || 0),
    cari: () => scraper.search(param1, param2 || 0),
    find: () => scraper.search(param1, param2 || 0),
    latest: () => scraper.getLatest(param1 || 0),
    update: () => scraper.getLatest(param1 || 0),
    terbaru: () => scraper.getLatest(param1 || 0),
    popular: () => scraper.getPopular(param1 || 0),
    top: () => scraper.getPopular(param1 || 0),
    populer: () => scraper.getPopular(param1 || 0),
    schedule: () => scraper.getSchedule(param1),
    jadwal: () => scraper.getSchedule(param1),
    genre: () => scraper.getByGenre(param1, param2 || 0),
    kategori: () => scraper.getByGenre(param1, param2 || 0),
    genres: () => scraper.getGenres(),
    detail: () => scraper.getDetail(param1, true),
    info: () => scraper.getDetail(param1, true),
    anime: () => scraper.getDetail(param1, true),
    episodes: async () => ({
      status: true,
      anime_id: param1,
      data: await scraper.getEpisodes(param1, param2 || 0)
    }),
    eps: async () => ({
      status: true,
      anime_id: param1,
      data: await scraper.getEpisodes(param1, param2 || 0)
    }),
    stream: () => scraper.getStream(param1),
    watch: () => scraper.getStream(param1),
    play: () => scraper.getStream(param1),
    nonton: () => scraper.getStream(param1),
    full: () => scraper.getFullScrape(param1, concurrency),
    scrape: () => scraper.getFullScrape(param1, concurrency),
    home: () => scraper.getHome(param1)
  };

  try {
    if (handlers[command]) {
      result = await handlers[command]();
    } else if (command.includes("animeinweb") || !isNaN(command)) {
      result = await scraper.getDetail(command, true);
    } else {
      result = await scraper.search(command, param1 || 0);
    }

    console.log(minified ? JSON.stringify(result) : JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ status: false, error: err.message }, null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith("animein.js")) {
  main();
}
