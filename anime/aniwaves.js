/**
 * Creator : Ryza 
 * Ch : https://whatsapp.com/channel/0029VbE4NyXFSAt8jKbRHt2o
 * 
 * note : don't claim this code
 */

import axios from "axios";
import * as cheerio from "cheerio";

const BASE_URL = "https://aniwaves.ru";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": `${BASE_URL}/`
};

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 25000,
  headers: HEADERS
});

function cleanText(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

function parseCard($, el) {
  const item = $(el);
  const link = item.find("a[href*='/watch/']").first().length
    ? item.find("a[href*='/watch/']").first()
    : item.is("a") ? item : item.find("a").first();
  const url = link.attr("href") || item.attr("href") || "";
  const fullUrl = url ? (url.startsWith("http") ? url : `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`) : "";
  const slugMatch = url.match(/\/watch\/([^/?#]+)/i);
  const slug = slugMatch ? slugMatch[1] : "";
  const idMatch = slug.match(/-(\d+)$/);
  const id = item.find("[data-tip]").attr("data-tip") || item.attr("data-tip") || (idMatch ? idMatch[1] : null);

  const titleEl = item.find(".name.d-title, .title.d-title, .title a, .name a, h5 a, h5").first();
  const title = cleanText(titleEl.text()) || cleanText(link.attr("title")) || cleanText(item.find("img").attr("alt")) || "";
  const japaneseTitle = titleEl.attr("data-jp") || null;

  const poster = item.find("img").attr("src") || item.find("img").attr("data-src") || "";
  const sub = cleanText(item.find(".ep-status.sub").text()) || null;
  const dub = cleanText(item.find(".ep-status.dub").text()) || null;
  const total = cleanText(item.find(".ep-status.total").text()) || null;

  let type = cleanText(item.find(".meta .right").text()) || null;
  if (!type) {
    item.find(".meta span.dot").each((_, dot) => {
      const t = cleanText($(dot).text());
      if (t && !$(dot).hasClass("ep-wrap") && !$(dot).hasClass("score")) {
        type = t;
      }
    });
  }

  const genres = [];
  item.find(".genre a, .genres a").each((_, g) => {
    const gn = cleanText($(g).text());
    if (gn) genres.push(gn);
  });

  const rating = cleanText(item.find(".m-item.rated span, .score").text().replace(/[^0-9.]/g, "")) || null;

  return {
    id,
    title,
    japaneseTitle,
    slug,
    url: fullUrl,
    poster,
    episodes: {
      sub,
      dub,
      total
    },
    type,
    genres: genres.length ? genres : undefined,
    rating
  };
}

export async function getHome() {
  try {
    const res = await client.get("/home");
    const $ = cheerio.load(res.data);

    const spotlight = [];
    $("#slider .swiper-slide, .swiper-slide.item").each((_, el) => {
      const slide = $(el);
      const titleEl = slide.find(".title.d-title");
      const title = cleanText(titleEl.text());
      const japaneseTitle = titleEl.attr("data-jp") || null;
      const playLink = slide.find("a.play, .actions a").attr("href") || "";
      const url = playLink ? (playLink.startsWith("http") ? playLink : `${BASE_URL}${playLink.startsWith("/") ? "" : "/"}${playLink}`) : "";
      const slugMatch = playLink.match(/\/watch\/([^/?#]+)/i);
      const slug = slugMatch ? slugMatch[1] : "";
      const idMatch = slug.match(/-(\d+)$/);
      const id = idMatch ? idMatch[1] : null;

      const rating = cleanText(slide.find(".meta .rating").text()) || null;
      const quality = cleanText(slide.find(".meta .quality").text()) || null;
      const hasSub = slide.find(".meta .sub").length > 0;
      const hasDub = slide.find(".meta .dub").length > 0;
      const synopsis = cleanText(slide.find(".synopsis").text());

      const bgStyle = slide.find(".image div").attr("style") || "";
      const bgMatch = bgStyle.match(/url\(['"]?(.*?)['"]?\)/);
      const banner = bgMatch ? bgMatch[1] : "";

      if (title) {
        spotlight.push({
          id,
          title,
          japaneseTitle,
          slug,
          url,
          rating,
          quality,
          hasSub,
          hasDub,
          synopsis,
          banner
        });
      }
    });

    const recentUpdates = [];
    $("#recent-update .ani.items .item, #recent-update .item").each((_, el) => {
      const card = parseCard($, el);
      if (card.title) recentUpdates.push(card);
    });

    const topTables = {
      newRelease: [],
      newAdded: [],
      justCompleted: []
    };

    $("section.top-table").each((_, sec) => {
      const heading = cleanText($(sec).find(".head, h2, .title").text()).toUpperCase();
      const items = [];
      $(sec).find(".item").each((_, el) => {
        const card = parseCard($, el);
        if (card.title) items.push(card);
      });

      if (heading.includes("RELEASE")) {
        topTables.newRelease = items;
      } else if (heading.includes("ADDED")) {
        topTables.newAdded = items;
      } else if (heading.includes("COMPLETED")) {
        topTables.justCompleted = items;
      }
    });

    const topAnime = {
      day: [],
      week: [],
      month: []
    };

    $("#top-anime [data-name='day'] .item, .top-anime [data-name='day'] .item").each((_, el) => {
      const card = parseCard($, el);
      if (card.title) topAnime.day.push(card);
    });

    $("#top-anime [data-name='week'] .item, .top-anime [data-name='week'] .item").each((_, el) => {
      const card = parseCard($, el);
      if (card.title) topAnime.week.push(card);
    });

    $("#top-anime [data-name='month'] .item, .top-anime [data-name='month'] .item").each((_, el) => {
      const card = parseCard($, el);
      if (card.title) topAnime.month.push(card);
    });

    return {
      status: true,
      data: {
        spotlight,
        recentUpdates,
        topTables,
        topAnime
      }
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: null
    };
  }
}

export async function getSchedule(options = {}) {
  try {
    const tz = options.tz !== undefined ? options.tz : 7;
    const dub = options.dub ? 1 : 0;
    const date = options.date || options.time || null;

    let res;
    let days = [];
    let items = [];

    if (date) {
      res = await client.get("/ajax/schedule/date", {
        params: { tz, time: date, dub },
        headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${BASE_URL}/home` }
      });
      const $ = cheerio.load(res.data?.result || res.data || "");
      $(".item").each((_, el) => {
        const item = $(el);
        const url = item.attr("href") || "";
        const fullUrl = url ? (url.startsWith("http") ? url : `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`) : "";
        const timeEl = item.find(".time");
        const time = cleanText(timeEl.text());
        const id = timeEl.attr("data-tip") || null;
        const episode = cleanText(item.find(".ep span").first().text()) || cleanText(item.find(".ep").first().text());
        const titleEl = item.find(".title.d-title, .title");
        const title = cleanText(titleEl.text());
        const japaneseTitle = titleEl.attr("data-jp") || null;
        const slugMatch = url.match(/\/watch\/([^/?#]+)/i);
        const slug = slugMatch ? slugMatch[1] : "";

        items.push({
          id,
          time,
          episode,
          title,
          japaneseTitle,
          slug,
          url: fullUrl
        });
      });
    } else {
      res = await client.get("/ajax/schedule", {
        params: { tz, dub },
        headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${BASE_URL}/home` }
      });
      const $ = cheerio.load(res.data?.result || res.data || "");

      $(".days .items .day").each((_, el) => {
        const dayEl = $(el);
        const inner = dayEl.find(".inner");
        days.push({
          day: cleanText(inner.find(".wday").text()),
          date: cleanText(inner.find(".date").text()),
          time: inner.attr("data-time") || "",
          active: dayEl.hasClass("active")
        });
      });

      $("section#schedule .item, .body .item").each((_, el) => {
        const item = $(el);
        const url = item.attr("href") || "";
        const fullUrl = url ? (url.startsWith("http") ? url : `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`) : "";
        const timeEl = item.find(".time");
        const time = cleanText(timeEl.text());
        const id = timeEl.attr("data-tip") || null;
        const episode = cleanText(item.find(".ep span").first().text()) || cleanText(item.find(".ep").first().text());
        const titleEl = item.find(".title.d-title, .title");
        const title = cleanText(titleEl.text());
        const japaneseTitle = titleEl.attr("data-jp") || null;
        const slugMatch = url.match(/\/watch\/([^/?#]+)/i);
        const slug = slugMatch ? slugMatch[1] : "";

        items.push({
          id,
          time,
          episode,
          title,
          japaneseTitle,
          slug,
          url: fullUrl
        });
      });
    }

    return {
      status: true,
      timezone: tz,
      type: dub ? "dub" : "sub",
      date: date || (days.find(d => d.active)?.time || null),
      days: days.length ? days : undefined,
      total: items.length,
      data: items
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: []
    };
  }
}

export async function getRecentUpdates(type = "updated", page = 1) {
  try {
    const map = {
      all: "updated",
      updated: "updated",
      sub: "subbed",
      subbed: "subbed",
      dub: "dubbed",
      dubbed: "dubbed",
      chinese: "china",
      china: "china",
      trending: "trending",
      random: "random"
    };
    const tabName = map[String(type).toLowerCase()] || "updated";
    const res = await client.get(`/ajax/home/widget/${tabName}`, {
      params: { page },
      headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${BASE_URL}/home` }
    });

    const $ = cheerio.load(res.data?.result || res.data || "");
    const items = [];
    $(".ani.items .item, .item").each((_, el) => {
      const card = parseCard($, el);
      if (card.title) items.push(card);
    });

    return {
      status: true,
      type: tabName,
      page: Number(page),
      total: items.length,
      data: items
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: []
    };
  }
}

export async function search(keyword, page = 1) {
  try {
    const res = await client.get("/filter", {
      params: {
        keyword,
        page
      }
    });

    const $ = cheerio.load(res.data);
    const results = [];
    $(".ani.items .item").each((_, el) => {
      const card = parseCard($, el);
      if (card.title) results.push(card);
    });

    const hasNextPage = $(".pagination .page-item:not(.active) a, .pagination a:contains('»')").length > 0;

    return {
      status: true,
      keyword,
      page: Number(page),
      hasNextPage,
      total: results.length,
      data: results
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: []
    };
  }
}

export async function getDetail(slugOrUrlOrId) {
  try {
    let targetPath = slugOrUrlOrId;
    if (String(slugOrUrlOrId).startsWith("http")) {
      targetPath = slugOrUrlOrId.replace(BASE_URL, "");
    } else if (!String(slugOrUrlOrId).startsWith("/")) {
      targetPath = `/watch/${slugOrUrlOrId}`;
    }

    const res = await client.get(targetPath);
    const $ = cheerio.load(res.data);
    const main = $("#watch-main");
    const infoEl = $("#w-info");

    const id = main.attr("data-id") || null;
    const title = cleanText(infoEl.find("h1.title").text());
    const japaneseTitle = infoEl.find("h1.title").attr("data-jp") || null;
    const names = cleanText(infoEl.find(".names").text()) || null;
    const poster = infoEl.find(".poster img").attr("src") || "";
    const rating = cleanText(infoEl.find(".rating").text()) || null;
    const quality = cleanText(infoEl.find(".quality").text()) || null;
    const hasSub = infoEl.find(".sub").length > 0;
    const hasDub = infoEl.find(".dub").length > 0;
    const synopsis = cleanText(infoEl.find(".synopsis .content, .synopsis").clone().children(".toggle").remove().end().text()) || null;

    const metadata = {};
    infoEl.find(".bmeta .meta > div").each((_, el) => {
      const raw = $(el).text();
      const parts = raw.split(":");
      if (parts.length >= 2) {
        const key = cleanText(parts[0]).toLowerCase().replace(/\s+/g, "_");
        const val = cleanText($(el).find("span").first().text()) || cleanText(parts.slice(1).join(":"));
        metadata[key] = val;
      }
    });

    const genres = [];
    infoEl.find("a[href*='/genre/']").each((_, el) => {
      const g = cleanText($(el).text());
      if (g && !genres.includes(g)) genres.push(g);
    });

    const seasons = [];
    $("#w-seasons .swiper-slide").each((_, el) => {
      const slide = $(el);
      const link = slide.find("a").attr("href") || "";
      const name = cleanText(slide.find(".title").text());
      const seasonNumber = cleanText(slide.find(".name").first().text());
      const type = cleanText(slide.find(".wa_type").first().text());
      const year = cleanText(slide.find(".wa_year").text());
      const tag = cleanText(slide.find(".watchord_btm .wa_type").text());
      const bg = slide.find("a").attr("style") || "";
      const bgMatch = bg.match(/url\(['"]?(.*?)['"]?\)/);
      const sPoster = bgMatch ? bgMatch[1] : "";
      const active = slide.hasClass("active");

      seasons.push({
        seasonNumber,
        title: name,
        type: type || null,
        year: year || null,
        tag: tag || null,
        poster: sPoster,
        url: link ? (link.startsWith("http") ? link : `${BASE_URL}${link.startsWith("/") ? "" : "/"}${link}`) : "",
        active
      });
    });

    const related = [];
    $("#w-related .item").each((_, el) => {
      const item = $(el);
      const link = item.attr("href") || "";
      const rTitle = cleanText(item.find(".name.d-title").text());
      const rJpTitle = item.find(".name.d-title").attr("data-jp") || null;
      const rPoster = item.find("img").attr("src") || "";
      const score = cleanText(item.find(".score").text().replace(/[^0-9.]/g, "")) || null;
      let rType = null;
      let rYear = null;
      item.find(".meta .dot").each((_, dot) => {
        const t = cleanText($(dot).text());
        if (!$(dot).hasClass("score")) {
          if (/^\d{4}$/.test(t)) rYear = t;
          else rType = t;
        }
      });

      related.push({
        title: rTitle,
        japaneseTitle: rJpTitle,
        poster: rPoster,
        score,
        type: rType,
        year: rYear,
        url: link ? (link.startsWith("http") ? link : `${BASE_URL}${link.startsWith("/") ? "" : "/"}${link}`) : ""
      });
    });

    return {
      status: true,
      data: {
        id,
        title,
        japaneseTitle,
        names,
        poster,
        rating,
        quality,
        hasSub,
        hasDub,
        synopsis,
        metadata,
        genres,
        seasons,
        related
      }
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: null
    };
  }
}

export async function getEpisodes(animeIdOrSlug) {
  try {
    let animeId = animeIdOrSlug;
    if (isNaN(animeId)) {
      const idMatch = String(animeIdOrSlug).match(/-(\d+)$/);
      if (idMatch) {
        animeId = idMatch[1];
      } else {
        const detailRes = await getDetail(animeIdOrSlug);
        animeId = detailRes.data?.id;
      }
    }

    if (!animeId) {
      throw new Error("Invalid Anime ID or Slug");
    }

    const res = await client.get(`/ajax/episode/list/${animeId}`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${BASE_URL}/`
      }
    });

    const $ = cheerio.load(res.data?.result || res.data || "");
    const episodes = [];

    $("ul li a").each((_, el) => {
      const a = $(el);
      const href = a.attr("href") || "";
      episodes.push({
        num: a.attr("data-num"),
        slug: a.attr("data-slug"),
        title: cleanText(a.find(".d-title").text()) || cleanText(a.text()),
        aired: a.attr("data-aired") || null,
        timestamp: a.attr("data-timestamp") || null,
        duration: Number(a.attr("data-duration")) || 0,
        isFiller: a.attr("data-filler") === "1",
        isRecap: a.attr("data-recap") === "1",
        hasSub: a.attr("data-sub") === "1",
        hasDub: a.attr("data-dub") === "1",
        dataIds: a.attr("data-ids") || null,
        url: href ? (href.startsWith("http") ? href : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`) : ""
      });
    });

    return {
      status: true,
      animeId,
      total: episodes.length,
      data: episodes
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: []
    };
  }
}

export async function getServers(animeIdOrDataIds, episodeNum) {
  try {
    let queryParam;
    if (episodeNum !== undefined) {
      queryParam = `servers=${animeIdOrDataIds}&eps=${episodeNum}`;
    } else {
      queryParam = String(animeIdOrDataIds).includes("&eps=")
        ? `servers=${animeIdOrDataIds}`
        : `servers=${animeIdOrDataIds}&eps=1`;
    }

    const res = await client.get(`/ajax/server/list?${queryParam}`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${BASE_URL}/`
      }
    });

    const $ = cheerio.load(res.data?.result || res.data || "");
    const servers = {};

    $(".servers .type").each((_, typeEl) => {
      const typeName = $(typeEl).attr("data-type") || "unknown";
      servers[typeName] = [];
      $(typeEl).find("ul li").each((_, li) => {
        const el = $(li);
        servers[typeName].push({
          name: cleanText(el.text()),
          serverId: el.attr("data-sv-id"),
          episodeId: el.attr("data-ep-id"),
          linkId: el.attr("data-link-id")
        });
      });
    });

    return {
      status: true,
      data: servers
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: {}
    };
  }
}

export async function getStream(linkId) {
  try {
    const res = await client.get(`/ajax/sources?id=${encodeURIComponent(linkId)}`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${BASE_URL}/`
      }
    });

    const result = res.data?.result || res.data;

    return {
      status: true,
      data: {
        url: result?.url || null,
        server: result?.server || null,
        skipIntro: result?.skip_data?.intro || null,
        skipOutro: result?.skip_data?.outro || null
      }
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: null
    };
  }
}

export async function getRecommendations(animeId, page = 1) {
  try {
    const res = await client.get("/ajax/v2/recommendations", {
      params: { mov_id: animeId, page },
      headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${BASE_URL}/` }
    });

    const $ = cheerio.load(res.data?.html || "");
    const items = [];
    $(".item").each((_, el) => {
      const card = parseCard($, el);
      if (card.title) items.push(card);
    });

    return {
      status: true,
      animeId,
      page: Number(page),
      hasMorePages: !!res.data?.has_more_pages,
      total: items.length,
      data: items
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: []
    };
  }
}

export async function getTrending(animeId) {
  try {
    const res = await client.get("/ajax/v2/trending", {
      params: { mov_id: animeId },
      headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${BASE_URL}/` }
    });

    const $ = cheerio.load(res.data?.html || "");
    const items = [];
    $(".item").each((_, el) => {
      const card = parseCard($, el);
      if (card.title) items.push(card);
    });

    return {
      status: true,
      animeId,
      total: items.length,
      data: items
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: []
    };
  }
}

export async function getTooltip(animeId) {
  try {
    const res = await client.get(`/ajax/anime/tooltip/${animeId}`, {
      headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${BASE_URL}/` }
    });

    const $ = cheerio.load(res.data || "");
    const titleEl = $(".title.d-title");
    const title = cleanText(titleEl.text());
    const japaneseTitle = titleEl.attr("data-jp") || null;
    const rating = cleanText($(".rating").text()) || null;
    const quality = cleanText($(".quality").text()) || null;
    const synopsis = cleanText($(".synopsis").text()) || null;

    const meta = {};
    $(".meta-bl > div").each((_, el) => {
      const spans = $(el).find("span");
      if (spans.length >= 2) {
        const key = cleanText(spans.first().text()).replace(/:$/, "").toLowerCase().replace(/\s+/g, "_");
        const val = cleanText(spans.last().text());
        meta[key] = val;
      }
    });

    const genres = [];
    $(".meta-bl a[href*='/genre/']").each((_, el) => {
      const g = cleanText($(el).text());
      if (g) genres.push(g);
    });

    return {
      status: true,
      animeId,
      data: {
        title,
        japaneseTitle,
        rating,
        quality,
        synopsis,
        meta,
        genres
      }
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: null
    };
  }
}

async function fetchAnimeList(path, page = 1) {
  try {
    const res = await client.get(path, {
      params: { page }
    });
    const $ = cheerio.load(res.data);
    const items = [];
    $(".ani.items .item").each((_, el) => {
      const card = parseCard($, el);
      if (card.title) items.push(card);
    });

    const hasNextPage = $(".pagination .page-item:not(.active) a, .pagination a:contains('»')").length > 0;

    return {
      status: true,
      path,
      page: Number(page),
      hasNextPage,
      total: items.length,
      data: items
    };
  } catch (err) {
    return {
      status: false,
      error: err.response?.data?.message || err.message,
      data: []
    };
  }
}

export async function getUpdated(page = 1) {
  return fetchAnimeList("/updated", page);
}

export async function getNewest(page = 1) {
  return fetchAnimeList("/newest", page);
}

export async function getOngoing(page = 1) {
  return fetchAnimeList("/ongoing", page);
}

export async function getCompleted(page = 1) {
  return fetchAnimeList("/completed", page);
}

export async function getByGenre(genre, page = 1) {
  const cleanGenre = String(genre).toLowerCase().trim().replace(new RegExp("^/genre/"), "").replace(/\s+/g, "-");
  return fetchAnimeList(`/genre/${cleanGenre}`, page);
}

export async function getByType(type, page = 1) {
  const cleanType = String(type).toLowerCase().trim().replace(new RegExp("^/type/"), "").replace(/\s+/g, "-");
  return fetchAnimeList(`/type/${cleanType}`, page);
}

export function getGenres() {
  return {
    status: true,
    data: [
      { name: "Action", slug: "action" },
      { name: "Adult Cast", slug: "adult-cast" },
      { name: "Adventure", slug: "adventure" },
      { name: "Anthropomorphic", slug: "anthropomorphic" },
      { name: "Avant Garde", slug: "avant-garde" },
      { name: "Award Winning", slug: "award-winning" },
      { name: "CGDCT", slug: "cgdct" },
      { name: "Childcare", slug: "childcare" },
      { name: "Combat Sports", slug: "combat-sports" },
      { name: "Comedy", slug: "comedy" },
      { name: "Crossdressing", slug: "crossdressing" },
      { name: "Delinquents", slug: "delinquents" },
      { name: "Detective", slug: "detective" },
      { name: "Drama", slug: "drama" },
      { name: "Ecchi", slug: "ecchi" },
      { name: "Educational", slug: "educational" },
      { name: "Erotica", slug: "erotica" },
      { name: "Fantasy", slug: "fantasy" },
      { name: "Gag Humor", slug: "gag-humor" },
      { name: "Gore", slug: "gore" },
      { name: "Gourmet", slug: "gourmet" },
      { name: "Harem", slug: "harem" },
      { name: "High Stakes Game", slug: "high-stakes-game" },
      { name: "Historical", slug: "historical" },
      { name: "Horror", slug: "horror" },
      { name: "Idols Female", slug: "idols-female" },
      { name: "Idols Male", slug: "idols-male" },
      { name: "Isekai", slug: "isekai" },
      { name: "Iyashikei", slug: "iyashikei" },
      { name: "Josei", slug: "josei" },
      { name: "Kids", slug: "kids" },
      { name: "Love Polygon", slug: "love-polygon" },
      { name: "Magical Sex Shift", slug: "magical-sex-shift" },
      { name: "Mahou Shoujo", slug: "mahou-shoujo" },
      { name: "Martial Arts", slug: "martial-arts" },
      { name: "Mecha", slug: "mecha" },
      { name: "Medical", slug: "medical" },
      { name: "Military", slug: "military" },
      { name: "Music", slug: "music" },
      { name: "Mystery", slug: "mystery" },
      { name: "Mythology", slug: "mythology" },
      { name: "Organized Crime", slug: "organized-crime" },
      { name: "Otaku Culture", slug: "otaku-culture" },
      { name: "Parody", slug: "parody" },
      { name: "Performing Arts", slug: "performing-arts" },
      { name: "Pets", slug: "pets" },
      { name: "Psychological", slug: "psychological" },
      { name: "Racing", slug: "racing" },
      { name: "Reincarnation", slug: "reincarnation" },
      { name: "Reverse Harem", slug: "reverse-harem" },
      { name: "Romance", slug: "romance" },
      { name: "Romantic Subtext", slug: "romantic-subtext" },
      { name: "Samurai", slug: "samurai" },
      { name: "School", slug: "school" },
      { name: "Sci-Fi", slug: "sci-fi" },
      { name: "Seinen", slug: "seinen" },
      { name: "Shounen", slug: "shounen" },
      { name: "Shoujo", slug: "shoujo" },
      { name: "Showbiz", slug: "showbiz" },
      { name: "Slice of Life", slug: "slice-of-life" },
      { name: "Space", slug: "space" },
      { name: "Strategy Game", slug: "strategy-game" },
      { name: "Super Power", slug: "super-power" },
      { name: "Supernatural", slug: "supernatural" },
      { name: "Survival", slug: "survival" },
      { name: "Suspense", slug: "suspense" },
      { name: "Team Sports", slug: "team-sports" },
      { name: "Time Travel", slug: "time-travel" },
      { name: "Vampire", slug: "vampire" },
      { name: "Video Game", slug: "video-game" },
      { name: "Visual Arts", slug: "visual-arts" },
      { name: "Workplace", slug: "workplace" }
    ]
  };
}

export function getTypes() {
  return {
    status: true,
    data: [
      { name: "TV Series", slug: "tv-series" },
      { name: "Movies", slug: "movies" },
      { name: "OVAs", slug: "ova" },
      { name: "ONAs", slug: "ona" },
      { name: "Specials", slug: "special" },
      { name: "Music", slug: "music" }
    ]
  };
}

const [,, command, ...cliArgs] = process.argv;

if (command) {
  (async () => {
    let result;
    const firstArg = cliArgs[0];
    const secondArg = cliArgs[1];

    switch (command.toLowerCase()) {
      case "home":
        result = await getHome();
        break;
      case "schedule":
      case "jadwal":
        result = await getSchedule({
          date: firstArg && firstArg !== "dub" ? firstArg : null,
          dub: firstArg === "dub" || secondArg === "dub"
        });
        break;
      case "search":
        result = await search(firstArg || "one piece", secondArg && !isNaN(secondArg) ? Number(secondArg) : 1);
        break;
      case "detail":
        result = await getDetail(firstArg || "one-piece-81553");
        break;
      case "episodes":
      case "eps":
        result = await getEpisodes(firstArg || "81553");
        break;
      case "servers":
        result = await getServers(firstArg || "81553", secondArg || 1);
        break;
      case "stream":
        result = await getStream(firstArg);
        break;
      case "recommendations":
        result = await getRecommendations(firstArg || "81553", secondArg || 1);
        break;
      case "trending":
        result = await getTrending(firstArg || "81553");
        break;
      case "tooltip":
        result = await getTooltip(firstArg || "81553");
        break;
      case "recent":
        result = await getRecentUpdates(firstArg || "updated", secondArg || 1);
        break;
      case "updated":
        result = await getUpdated(firstArg || 1);
        break;
      case "newest":
        result = await getNewest(firstArg || 1);
        break;
      case "ongoing":
        result = await getOngoing(firstArg || 1);
        break;
      case "completed":
        result = await getCompleted(firstArg || 1);
        break;
      case "genre":
        result = await getByGenre(firstArg || "action", secondArg || 1);
        break;
      case "type":
        result = await getByType(firstArg || "tv-series", secondArg || 1);
        break;
      case "genres":
        result = getGenres();
        break;
      case "types":
        result = getTypes();
        break;
      default:
        result = {
          status: false,
          error: `Perintah '${command}' tidak dikenali.`
        };
    }

    console.log(JSON.stringify(result, null, 2));
  })();
}

export default {
  getHome,
  getSchedule,
  getRecentUpdates,
  search,
  getDetail,
  getEpisodes,
  getServers,
  getStream,
  getRecommendations,
  getTrending,
  getTooltip,
  getUpdated,
  getNewest,
  getOngoing,
  getCompleted,
  getByGenre,
  getByType,
  getGenres,
  getTypes
};
