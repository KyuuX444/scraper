import axios from "axios";
import * as cheerio from "cheerio";
import { fileURLToPath } from "url";

const BASE_URL = "https://donghive.vip";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": `${BASE_URL}/`
};

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: HEADERS
});

function cleanText(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

function resolveUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const cleanPath = url.replace(/^\/+/, "");
  return `${BASE_URL}/${cleanPath}`;
}

function extractSlug(url) {
  if (!url) return "";
  const match = url.replace(BASE_URL, "").replace(/^\/+/, "").replace(/\/+$/, "").split("/").pop();
  return match || "";
}

function parsePagination($, currentPage = 1) {
  const hasNext = Boolean($(".pagination a.next, .hpage a.r, .hpage a.next").length);
  const hasPrev = Boolean($(".pagination a.prev, .hpage a.l, .hpage a.prev").length) || Number(currentPage) > 1;
  const totalNumbers = $(".pagination a.page-numbers")
    .not(".next, .prev")
    .map((_, el) => parseInt($(el).text().trim(), 10))
    .get()
    .filter(n => !isNaN(n));
  const totalPages = totalNumbers.length ? Math.max(...totalNumbers) : null;

  return {
    currentPage: Number(currentPage),
    hasNextPage: hasNext,
    hasPrevPage: hasPrev,
    totalPages
  };
}

export async function getHome() {
  const { data } = await client.get("/");
  const $ = cheerio.load(data);

  const slider = [];
  $("#slidertwo .item, #slidertwo .swiper-slide").each((_, el) => {
    const item = $(el);
    const linkElem = item.find("h2 a, a.watch").first();
    const url = resolveUrl(linkElem.attr("href"));
    const title = cleanText(item.find("h2 a").first().text());
    const bgStyle = item.find(".backdrop").attr("style") || "";
    const bgMatch = bgStyle.match(/url\(['"]?(.*?)['"]?\)/);
    const thumbnail = bgMatch ? resolveUrl(bgMatch[1]) : "";
    const synopsis = cleanText(item.find("p").text());

    if (title && url) {
      slider.push({
        title,
        slug: extractSlug(url),
        url,
        thumbnail,
        synopsis
      });
    }
  });

  const popular = [];
  $(".popconslide .bs, .popularslider .bs").each((_, el) => {
    const item = $(el);
    const linkElem = item.find("a").first();
    const url = resolveUrl(linkElem.attr("href"));
    const title = cleanText(item.find(".tt h2, h2").first().text()) || cleanText(linkElem.attr("title"));
    const seriesTitle = cleanText(item.find(".tt").contents().filter((_, node) => node.type === "text").text());
    const thumbnail = resolveUrl(item.find("img").attr("src") || item.find("img").attr("data-src"));
    const type = cleanText(item.find(".typez").text());
    const episode = cleanText(item.find(".epx").text());
    const sub = cleanText(item.find(".sb").text());

    if (title && url) {
      popular.push({
        title,
        seriesTitle: seriesTitle || null,
        slug: extractSlug(url),
        url,
        thumbnail,
        type: type || null,
        episode: episode || null,
        sub: sub || null
      });
    }
  });

  const latest = [];
  $(".listupd.normal .bs, .listupd.normal article").each((_, el) => {
    const item = $(el);
    const linkElem = item.find("a").first();
    const url = resolveUrl(linkElem.attr("href"));
    const title = cleanText(item.find(".tt h2, h2").first().text()) || cleanText(linkElem.attr("title"));
    const seriesTitle = cleanText(item.find(".egghead .eggtitle").text());
    const thumbnail = resolveUrl(item.find("img").attr("src") || item.find("img").attr("data-src"));
    const type = cleanText(item.find(".eggmeta .eggtype, .typez").text());
    const episode = cleanText(item.find(".eggmeta .eggepisode, .epx").text());
    const sub = cleanText(item.find(".sb").text());

    if (title && url) {
      latest.push({
        title,
        seriesTitle: seriesTitle || null,
        slug: extractSlug(url),
        url,
        thumbnail,
        type: type || null,
        episode: episode || null,
        sub: sub || null
      });
    }
  });

  return {
    slider,
    popular,
    latest
  };
}

export async function getLatest(page = 1) {
  const path = page > 1 ? `/page/${page}/` : "/";
  const { data } = await client.get(path);
  const $ = cheerio.load(data);

  const items = [];
  $(".listupd.normal .bs, .listupd.normal article").each((_, el) => {
    const item = $(el);
    const linkElem = item.find("a").first();
    const url = resolveUrl(linkElem.attr("href"));
    const title = cleanText(item.find(".tt h2, h2").first().text()) || cleanText(linkElem.attr("title"));
    const seriesTitle = cleanText(item.find(".egghead .eggtitle").text());
    const thumbnail = resolveUrl(item.find("img").attr("src") || item.find("img").attr("data-src"));
    const type = cleanText(item.find(".eggmeta .eggtype, .typez").text());
    const episode = cleanText(item.find(".eggmeta .eggepisode, .epx").text());
    const sub = cleanText(item.find(".sb").text());

    if (title && url) {
      items.push({
        title,
        seriesTitle: seriesTitle || null,
        slug: extractSlug(url),
        url,
        thumbnail,
        type: type || null,
        episode: episode || null,
        sub: sub || null
      });
    }
  });

  return {
    pagination: parsePagination($, page),
    items
  };
}

export async function getAnimeList({ page = 1, status = "", type = "", order = "", sub = "", genre = "" } = {}) {
  const path = page > 1 ? `/anime/page/${page}/` : "/anime/";
  const params = {};
  if (status) params.status = status;
  if (type) params.type = type;
  if (order) params.order = order;
  if (sub) params.sub = sub;
  if (genre) params["genre[]"] = genre;

  const { data } = await client.get(path, { params });
  const $ = cheerio.load(data);

  const items = [];
  $(".listupd .bs, .listupd article").each((_, el) => {
    const item = $(el);
    const linkElem = item.find("a").first();
    const url = resolveUrl(linkElem.attr("href"));
    const title = cleanText(item.find(".tt h2, h2").first().text()) || cleanText(linkElem.attr("title"));
    const thumbnail = resolveUrl(item.find("img").attr("src") || item.find("img").attr("data-src"));
    const typeText = cleanText(item.find(".typez").text());
    const statusText = cleanText(item.find(".epx, .status").text());
    const subText = cleanText(item.find(".sb").text());

    if (title && url) {
      items.push({
        title,
        slug: extractSlug(url),
        url,
        thumbnail,
        type: typeText || null,
        status: statusText || null,
        sub: subText || null
      });
    }
  });

  return {
    pagination: parsePagination($, page),
    items
  };
}

export async function search(query, page = 1) {
  const path = page > 1 ? `/page/${page}/` : "/";
  const { data } = await client.get(path, {
    params: {
      s: query
    }
  });
  const $ = cheerio.load(data);

  const items = [];
  $(".listupd .bs, .listupd article").each((_, el) => {
    const item = $(el);
    const linkElem = item.find("a").first();
    const url = resolveUrl(linkElem.attr("href"));
    const title = cleanText(item.find(".tt h2, h2").first().text()) || cleanText(linkElem.attr("title"));
    const thumbnail = resolveUrl(item.find("img").attr("src") || item.find("img").attr("data-src"));
    const typeText = cleanText(item.find(".typez").text());
    const statusText = cleanText(item.find(".epx, .status").text());
    const subText = cleanText(item.find(".sb").text());

    if (title && url) {
      items.push({
        title,
        slug: extractSlug(url),
        url,
        thumbnail,
        type: typeText || null,
        status: statusText || null,
        sub: subText || null
      });
    }
  });

  return {
    query,
    pagination: parsePagination($, page),
    items
  };
}

export async function getDetail(urlOrSlug) {
  const fullUrl = resolveUrl(urlOrSlug);
  const { data } = await client.get(fullUrl);
  const $ = cheerio.load(data);

  const title = cleanText($(".infox h1.entry-title").first().text());
  const thumbnail = resolveUrl($(".thumbook .thumb img").attr("src") || $(".thumbook .thumb img").attr("data-src"));
  const rating = cleanText($(".rating strong").text()).replace(/^Rating\s*/i, "");
  const synopsis = cleanText($(".desc").text()) || cleanText($(".mindesc").text()) || cleanText($(".entry-content").text());

  const metadata = {};
  $(".spe span").each((_, el) => {
    const text = cleanText($(el).text());
    const colonIndex = text.indexOf(":");
    if (colonIndex !== -1) {
      const key = text.slice(0, colonIndex).trim().toLowerCase().replace(/\s+/g, "_");
      const val = text.slice(colonIndex + 1).trim();
      metadata[key] = val;
    }
  });

  const genres = [];
  $(".genxed a").each((_, el) => {
    const gName = cleanText($(el).text());
    const gUrl = resolveUrl($(el).attr("href"));
    if (gName) {
      genres.push({
        name: gName,
        slug: extractSlug(gUrl),
        url: gUrl
      });
    }
  });

  const tags = [];
  $(".bottom.tags a, .tag-cloud-link").each((_, el) => {
    const tName = cleanText($(el).text());
    const tUrl = resolveUrl($(el).attr("href"));
    if (tName) {
      tags.push({
        name: tName,
        slug: extractSlug(tUrl),
        url: tUrl
      });
    }
  });

  const episodes = [];
  $(".eplister ul li").each((_, el) => {
    const li = $(el);
    const linkElem = li.find("a").first();
    const epUrl = resolveUrl(linkElem.attr("href"));
    const num = cleanText(li.find(".epl-num").text());
    const epTitle = cleanText(li.find(".epl-title").text());
    const sub = cleanText(li.find(".epl-sub").text());
    const releaseDate = cleanText(li.find(".epl-date").text());

    if (epUrl) {
      episodes.push({
        episode: num,
        title: epTitle,
        sub: sub || null,
        releaseDate: releaseDate || null,
        slug: extractSlug(epUrl),
        url: epUrl
      });
    }
  });

  return {
    title,
    slug: extractSlug(fullUrl),
    url: fullUrl,
    thumbnail,
    rating: rating || null,
    synopsis: synopsis || null,
    metadata,
    genres,
    tags,
    episodes
  };
}

export async function getEpisode(urlOrSlug) {
  const fullUrl = resolveUrl(urlOrSlug);
  const { data } = await client.get(fullUrl);
  const $ = cheerio.load(data);

  const title = cleanText($(".title-section h1.entry-title").first().text());
  const episodeNumber = cleanText($("meta[itemprop=\"episodeNumber\"]").attr("content")) || cleanText($(".lm .epx").text());
  const releaseDate = cleanText($(".year .updated").text());

  const seriesLink = $(".year a, .naveps .nvsc a").first();
  const seriesTitle = cleanText(seriesLink.text());
  const seriesUrl = resolveUrl(seriesLink.attr("href"));

  const prevLink = $(".naveps .nvs a[rel=\"prev\"]").attr("href");
  const nextLink = $(".naveps .nvs a[rel=\"next\"]").attr("href");
  const allEpisodesLink = $(".naveps .nvsc a").attr("href");

  const defaultEmbed = resolveUrl($("#pembed iframe").attr("src"));

  const servers = [];
  $("select.mirror option").each((_, el) => {
    const val = $(el).attr("value");
    const name = cleanText($(el).text());
    if (val) {
      let decoded = "";
      try {
        decoded = Buffer.from(val, "base64").toString("utf-8");
      } catch (e) {}

      const srcMatch = decoded.match(/src=["'](.*?)["']/i);
      const serverUrl = srcMatch ? resolveUrl(srcMatch[1]) : "";

      servers.push({
        name,
        raw: val,
        iframe: decoded,
        url: serverUrl
      });
    }
  });

  return {
    title,
    slug: extractSlug(fullUrl),
    url: fullUrl,
    episodeNumber: episodeNumber || null,
    releaseDate: releaseDate || null,
    series: {
      title: seriesTitle || null,
      slug: extractSlug(seriesUrl),
      url: seriesUrl || null
    },
    navigation: {
      prev: prevLink ? resolveUrl(prevLink) : null,
      next: nextLink ? resolveUrl(nextLink) : null,
      allEpisodes: allEpisodesLink ? resolveUrl(allEpisodesLink) : null
    },
    defaultEmbed: defaultEmbed || null,
    servers
  };
}

export async function getSchedule() {
  const { data } = await client.get("/schedule/");
  const $ = cheerio.load(data);

  const schedule = [];
  $(".schedulepage").each((_, sec) => {
    const day = cleanText($(sec).find(".releases h3 span").text());
    const items = [];

    $(sec).find(".bs").each((_, el) => {
      const item = $(el);
      const linkElem = item.find("a").first();
      const url = resolveUrl(linkElem.attr("href"));
      const title = cleanText(item.find(".tt").text()) || cleanText(linkElem.attr("title"));
      const thumbnail = resolveUrl(item.find("img").attr("src") || item.find("img").attr("data-src"));
      const time = cleanText(item.find(".epx").text());
      const episode = cleanText(item.find(".sb").text());

      if (title && url) {
        items.push({
          title,
          slug: extractSlug(url),
          url,
          thumbnail,
          time: time || null,
          episode: episode || null
        });
      }
    });

    if (day) {
      schedule.push({
        day,
        items
      });
    }
  });

  return schedule;
}

export async function getGenres() {
  const { data } = await client.get("/anime/");
  const $ = cheerio.load(data);

  const genres = [];
  $("input[name=\"genre[]\"]").each((_, el) => {
    const slug = $(el).val();
    const name = cleanText($(el).next("label").text());
    if (slug && name) {
      genres.push({
        name,
        slug,
        url: `${BASE_URL}/genres/${slug}/`
      });
    }
  });

  return genres;
}

export async function getByGenre(genreSlug, page = 1) {
  const path = page > 1 ? `/genres/${genreSlug}/page/${page}/` : `/genres/${genreSlug}/`;
  const { data } = await client.get(path);
  const $ = cheerio.load(data);

  const items = [];
  $(".listupd .bs, .listupd article").each((_, el) => {
    const item = $(el);
    const linkElem = item.find("a").first();
    const url = resolveUrl(linkElem.attr("href"));
    const title = cleanText(item.find(".tt h2, h2").first().text()) || cleanText(linkElem.attr("title"));
    const thumbnail = resolveUrl(item.find("img").attr("src") || item.find("img").attr("data-src"));
    const typeText = cleanText(item.find(".typez").text());
    const statusText = cleanText(item.find(".epx, .status").text());
    const subText = cleanText(item.find(".sb").text());

    if (title && url) {
      items.push({
        title,
        slug: extractSlug(url),
        url,
        thumbnail,
        type: typeText || null,
        status: statusText || null,
        sub: subText || null
      });
    }
  });

  return {
    genre: genreSlug,
    pagination: parsePagination($, page),
    items
  };
}

const [,, command, ...args] = process.argv;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  (async () => {
    let result;
    const cmd = (command || "home").toLowerCase();
    const param = args.join(" ");

    switch (cmd) {
      case "home":
        result = await getHome();
        break;
      case "latest":
        result = await getLatest(param && !isNaN(param) ? Number(param) : 1);
        break;
      case "anime":
      case "list":
        result = await getAnimeList({ page: param && !isNaN(param) ? Number(param) : 1 });
        break;
      case "search":
        result = await search(param || "battle", 1);
        break;
      case "detail":
        result = await getDetail(param || "battle-through-the-heavens-season-5");
        break;
      case "episode":
      case "stream":
        result = await getEpisode(param || "azure-legacy-the-demon-hunter-episode-99-subtitle-indonesia");
        break;
      case "schedule":
        result = await getSchedule();
        break;
      case "genres":
        result = await getGenres();
        break;
      case "genre":
        result = await getByGenre(args[0] || "action", args[1] && !isNaN(args[1]) ? Number(args[1]) : 1);
        break;
      default:
        result = {
          status: false,
          error: `Perintah '${command}' tidak valid. Gunakan: home, latest, list, search, detail, episode, schedule, genres, genre`
        };
    }

    console.log(JSON.stringify(result, null, 2));
  })();
}

export default {
  getHome,
  getLatest,
  getAnimeList,
  search,
  getDetail,
  getEpisode,
  getSchedule,
  getGenres,
  getByGenre
};
