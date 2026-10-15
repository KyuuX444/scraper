import playwright from 'playwright';
import axios from 'axios';
import FormData from 'form-data';

const WATERMARK = 'Mommy Kyuu';
const NOTE = 'Berhasil mengambil data dari Play Store';

async function uploadToHost(imageUrl, fileName = 'image.png') {
  try {
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const form = new FormData();
    form.append('file', Buffer.from(res.data), {
      filename: fileName,
      contentType: 'image/png'
    });

    const uploadRes = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
      headers: form.getHeaders(),
      timeout: 15000
    });

    if (uploadRes.data && uploadRes.data.status === 'success' && uploadRes.data.data && uploadRes.data.data.url) {
      return uploadRes.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    }
  } catch (err) {
  }
  return imageUrl;
}

export async function getPlayStoreHome() {
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US'
  });

  const page = await context.newPage();
  
  const sniffedRequests = [];
  page.on('request', req => {
    const u = req.url();
    if (u.includes('batchexecute') || u.includes('/store/api/')) {
      sniffedRequests.push({ method: req.method(), url: u });
    }
  });

  await page.goto('https://play.google.com/store/apps?hl=en', { waitUntil: 'domcontentloaded' });
  
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) {
      window.scrollBy(0, 1000);
      await new Promise(r => setTimeout(r, 800));
    }
  });

  const rawHomeSections = await page.evaluate(() => {
    const sections = [];

    document.querySelectorAll('header, div[header]').forEach(headerEl => {
      const categoryTitle = headerEl.innerText?.split('\n')[0]?.trim();
      const parentContainer = headerEl.parentElement;
      if (!categoryTitle || !parentContainer) return;

      const apps = [];
      parentContainer.querySelectorAll('a[href*="/store/apps/details"]').forEach(el => {
        const fullText = el.innerText?.trim() || '';
        const title = fullText.split('\n')[0];
        const href = el.getAttribute('href');
        const icon = el.querySelector('img')?.src || '';
        const pkgMatch = href ? href.match(/id=([^&]+)/) : null;

        if (title && pkgMatch && pkgMatch[1] && !apps.some(a => a.package_id === pkgMatch[1])) {
          apps.push({
            title,
            package_id: pkgMatch[1],
            url: `https://play.google.com${href}`,
            icon_raw: icon
          });
        }
      });

      if (categoryTitle && apps.length > 0 && !sections.some(s => s.category === categoryTitle)) {
        sections.push({
          category: categoryTitle,
          total_apps: apps.length,
          apps
        });
      }
    });

    if (sections.length === 0) {
      const fallbackApps = [];
      document.querySelectorAll('a[href*="/store/apps/details"]').forEach(el => {
        const fullText = el.innerText?.trim() || '';
        const title = fullText.split('\n')[0];
        const href = el.getAttribute('href');
        const icon = el.querySelector('img')?.src || '';
        const pkgMatch = href ? href.match(/id=([^&]+)/) : null;

        if (title && pkgMatch && pkgMatch[1] && !fallbackApps.some(a => a.package_id === pkgMatch[1])) {
          fallbackApps.push({
            title,
            package_id: pkgMatch[1],
            url: `https://play.google.com${href}`,
            icon_raw: icon
          });
        }
      });

      sections.push({
        category: "Featured & Popular Apps",
        total_apps: fallbackApps.length,
        apps: fallbackApps
      });
    }

    return sections;
  });

  const formattedSections = [];
  let secIdx = 1;
  for (const sec of rawHomeSections.slice(0, 5)) {
    const processedApps = [];
    let appIdx = 1;
    for (const app of sec.apps.slice(0, 6)) {
      const uploadedIcon = app.icon_raw ? await uploadToHost(app.icon_raw, `home_sec${secIdx}_app${appIdx}.png`) : 'N/A';
      processedApps.push({
        title: app.title,
        package_id: app.package_id,
        url: app.url,
        icon_url: uploadedIcon
      });
      appIdx++;
    }

    formattedSections.push({
      category: sec.category,
      total_apps: processedApps.length,
      apps: processedApps
    });
    secIdx++;
  }

  await browser.close();

  return {
    status: true,
    watermark: WATERMARK,
    note: NOTE,
    mode: "home",
    sniffed_api_calls: sniffedRequests.length,
    total_categories: formattedSections.length,
    results: formattedSections
  };
}

export async function searchPlayStore(query) {
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US'
  });

  const page = await context.newPage();
  
  const sniffedRequests = [];
  page.on('request', req => {
    const u = req.url();
    if (u.includes('batchexecute') || u.includes('/store/api/')) {
      sniffedRequests.push({ method: req.method(), url: u });
    }
  });

  const searchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps&hl=en`;

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const rawApps = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('a[href*="/store/apps/details"]').forEach(el => {
      const fullText = el.innerText?.trim() || '';
      const title = fullText.split('\n')[0];
      const href = el.getAttribute('href');
      const icon = el.querySelector('img')?.src || '';
      const pkgMatch = href ? href.match(/id=([^&]+)/) : null;
      
      if (title && pkgMatch && pkgMatch[1] && !items.some(i => i.package_id === pkgMatch[1])) {
        items.push({
          title,
          package_id: pkgMatch[1],
          url: `https://play.google.com${href}`,
          icon_raw: icon
        });
      }
    });
    return items;
  });

  const results = [];
  let idx = 1;
  for (const app of rawApps.slice(0, 5)) {
    const uploadedIcon = app.icon_raw ? await uploadToHost(app.icon_raw, `search_icon_${idx}.png`) : 'N/A';
    results.push({
      title: app.title,
      package_id: app.package_id,
      url: app.url,
      icon_url: uploadedIcon
    });
    idx++;
  }

  await browser.close();

  return {
    status: true,
    watermark: WATERMARK,
    note: NOTE,
    mode: "search",
    query,
    sniffed_api_calls: sniffedRequests.length,
    total_results: results.length,
    results
  };
}

export async function detailPlayStore(appQueryOrPackage) {
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US'
  });

  const page = await context.newPage();

  const sniffedRequests = [];
  page.on('request', req => {
    const u = req.url();
    if (u.includes('batchexecute') || u.includes('/store/api/')) {
      sniffedRequests.push({ method: req.method(), url: u });
    }
  });

  let targetUrl = '';
  if (appQueryOrPackage.includes('.')) {
    targetUrl = `https://play.google.com/store/apps/details?id=${appQueryOrPackage}&hl=en`;
  } else {
    targetUrl = `https://play.google.com/store/search?q=${encodeURIComponent(appQueryOrPackage)}&c=apps&hl=en`;
  }

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const isNotFound = await page.evaluate(() => {
    return document.title.includes('Not Found') || document.body.innerText.includes('requested URL was not found');
  });

  if (isNotFound) {
    const searchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(appQueryOrPackage)}&c=apps&hl=en`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const firstAppUrl = await page.evaluate(() => {
      const firstAnchor = document.querySelector('a[href*="/store/apps/details"]');
      return firstAnchor ? firstAnchor.href : null;
    });

    if (firstAppUrl) {
      await page.goto(firstAppUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    } else {
      await browser.close();
      return {
        status: false,
        watermark: WATERMARK,
        note: NOTE,
        mode: "detail",
        message: `Package or App "${appQueryOrPackage}" not found on Play Store.`
      };
    }
  }

  const rawData = await page.evaluate(() => {
    const title = document.querySelector('h1')?.innerText?.trim() || 'N/A';
    const developer = document.querySelector('a[href*="/store/apps/dev"] span')?.innerText?.trim() || 'Google LLC';
    const icon = document.querySelector('img[alt="Icon image"], img[alt="Cover art"], img[src*="googleusercontent"]')?.src || '';
    const rating = document.querySelector('div[aria-label*="stars"]')?.getAttribute('aria-label') || 'N/A';

    const screenshotImgs = [];
    document.querySelectorAll('img[src*="googleusercontent"]').forEach(img => {
      if (img.src && (img.src.includes('=w') || img.src.includes('=h')) && img.src !== icon) {
        screenshotImgs.push(img.src);
      }
    });

    const description = document.querySelector('div[data-g-id="description"]')?.innerText?.trim() || 
                        document.querySelector('article')?.innerText?.trim() || 'N/A';

    return {
      packageId: window.location.href.split('id=')[1]?.split('&')[0] || 'N/A',
      title,
      developer,
      rating,
      icon,
      screenshots: [...new Set(screenshotImgs)],
      description
    };
  });

  const uploadedIcon = rawData.icon ? await uploadToHost(rawData.icon, 'icon.png') : 'N/A';

  const uploadedScreenshots = [];
  const targetScreenshots = rawData.screenshots.slice(0, 5);
  let count = 1;
  for (const imgUrl of targetScreenshots) {
    const directUrl = await uploadToHost(imgUrl, `screenshot_${count}.png`);
    uploadedScreenshots.push(directUrl);
    count++;
  }

  await browser.close();

  return {
    status: true,
    watermark: WATERMARK,
    note: NOTE,
    mode: "detail",
    sniffed_api_calls: sniffedRequests.length,
    result: {
      package_id: rawData.packageId,
      title: rawData.title,
      developer: rawData.developer,
      rating: rawData.rating.replace('Rated ', '').replace(' out of five stars', ' / 5.0'),
      icon_url: uploadedIcon,
      screenshots_count: uploadedScreenshots.length,
      screenshots: uploadedScreenshots,
      description: rawData.description
    }
  };
}

const mode = process.argv[2] || 'home';
const param = process.argv[3] || 'com.google.android.apps.bard';

(async () => {
  let result;
  if (mode === 'home') {
    result = await getPlayStoreHome();
  } else if (mode === 'search') {
    result = await searchPlayStore(param);
  } else if (mode === 'detail') {
    result = await detailPlayStore(param);
  } else {
    console.log('Usage: node playstore.js [home | search <query> | detail <package_or_query>]');
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
})();
