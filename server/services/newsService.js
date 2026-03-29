import axios from 'axios';

const GNEWS_BASE_URL = 'https://gnews.io/api/v4';
const NEWSDATA_BASE_URL = 'https://newsdata.io/api/1';
const STOP_WORDS = new Set(['the', 'a', 'an', 'for', 'of', 'and', 'or', 'to', 'in', 'on', 'at']);
const newsCache = new Map();
let trendingCache = [];
let gnewsCooldownUntil = 0;

const isValidHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const buildImageProxyUrl = (imageUrl, articleUrl) => {
  const params = new URLSearchParams();

  if (isValidHttpUrl(imageUrl)) {
    params.set('url', imageUrl);
  }

  if (isValidHttpUrl(articleUrl)) {
    params.set('articleUrl', articleUrl);
  }

  return params.toString() ? `/api/news/image?${params.toString()}` : '';
};

const sanitizeQuery = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildQueryCandidates = (keyword) => {
  const sanitized = sanitizeQuery(keyword).slice(0, 200);
  const words = sanitized
    .split(' ')
    .filter(Boolean)
    .filter((word) => !STOP_WORDS.has(word));
  const shortened = words.slice(0, 3).join(' ');
  const firstWord = words[0] || '';
  const secondWord = words[1] || '';

  return [...new Set([firstWord, `${firstWord} ${secondWord}`.trim(), shortened].filter(Boolean))];
};

const normalizeArticle = (article) => ({
  title: article.title,
  description: article.description,
  url: article.url,
  image: buildImageProxyUrl(article.image, article.url),
  publishedAt: article.publishedAt,
  source: article.source?.name || 'Unknown',
});

const normalizeNewsDataArticle = (article) => ({
  title: article.title,
  description: article.description || article.content || '',
  url: article.link,
  image: buildImageProxyUrl(article.image_url, article.link),
  publishedAt: article.pubDate,
  source: article.source_name || 'Unknown',
});

export const getCachedNewsByKeyword = (keyword) => newsCache.get(sanitizeQuery(keyword)) || [];
export const getCachedTrendingNews = () => trendingCache;

export const isGNewsQuotaOrTimeoutError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  const detailText = JSON.stringify(error?.details || {}).toLowerCase();

  return (
    error?.statusCode === 403 ||
    error?.statusCode === 408 ||
    error?.statusCode === 502 ||
    code === 'econnaborted' ||
    code === 'econnreset' ||
    code === 'etimedout' ||
    code === 'socket hang up' ||
    message.includes('request limit') ||
    message.includes('change-plan') ||
    message.includes('econnaborted') ||
    message.includes('econnreset') ||
    message.includes('socket hang up') ||
    message.includes('timeout') ||
    detailText.includes('request limit') ||
    detailText.includes('change-plan') ||
    detailText.includes('econnreset') ||
    detailText.includes('timeout')
  );
};

const isTransientUpstreamError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  return (
    isGNewsQuotaOrTimeoutError(error) ||
    code === 'eai_again' ||
    code === 'enotfound' ||
    code === 'ehostunreach' ||
    code === 'econnrefused' ||
    message.includes('network error') ||
    message.includes('temporary failure')
  );
};

const isGNewsCoolingDown = () => Date.now() < gnewsCooldownUntil;

const setGNewsCooldown = (error) => {
  if (isGNewsQuotaOrTimeoutError(error)) {
    gnewsCooldownUntil = Date.now() + 30 * 60 * 1000;
  }
};

const buildRequestError = (error, fallbackMessage) => {
  const syntaxErrorMessage = error.response?.data?.errors?.q;
  const upstreamMessage =
    syntaxErrorMessage ||
    error.response?.data?.errors?.[0] ||
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.code ||
    error.message ||
    fallbackMessage;

  const requestError = new Error(upstreamMessage);
  requestError.statusCode = error.response?.status || 502;
  requestError.details = error.response?.data || {
    code: error.code,
    message: error.message,
  };

  if (syntaxErrorMessage) {
    requestError.message =
      'GNews rejected that search. Try a simpler keyword like "tesla", "nvidia", or "inflation".';
  }

  return requestError;
};

const getApiKey = () => {
  if (!process.env.GNEWS_API_KEY) {
    const error = new Error('GNEWS_API_KEY is missing from the environment configuration.');
    error.statusCode = 500;
    throw error;
  }

  return process.env.GNEWS_API_KEY;
};

const getNewsDataApiKey = () => process.env.NEWSDATA_API_KEY;

const fetchNewsDataByKeyword = async (keyword) => {
  const apiKey = getNewsDataApiKey();
  if (!apiKey) {
    return [];
  }

  const { data } = await axios.get(`${NEWSDATA_BASE_URL}/latest`, {
    params: {
      apikey: apiKey,
      q: keyword,
      country: 'us',
      language: 'en',
      size: 10,
      image: 1,
    },
    timeout: 15000,
  });

  return (data.results || []).map(normalizeNewsDataArticle);
};

const fetchNewsDataTrending = async () => {
  const apiKey = getNewsDataApiKey();
  if (!apiKey) {
    return [];
  }

  const { data } = await axios.get(`${NEWSDATA_BASE_URL}/latest`, {
    params: {
      apikey: apiKey,
      q: 'business',
      category: 'business',
      country: 'us',
      language: 'en',
      size: 10,
      image: 1,
    },
    timeout: 15000,
  });

  return (data.results || []).map(normalizeNewsDataArticle);
};

const extractMetaImage = (html, pageUrl) => {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      try {
        return new URL(match[1], pageUrl).toString();
      } catch {
        // Ignore malformed URLs.
      }
    }
  }

  return '';
};

export const proxyNewsImage = async ({ imageUrl, articleUrl }) => {
  const tryFetchImage = async (targetUrl) => {
    if (!isValidHttpUrl(targetUrl)) {
      return null;
    }

    try {
      const response = await axios.get(targetUrl, {
        responseType: 'stream',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 ET-NewsEra/1.0',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: articleUrl || targetUrl,
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      return response;
    } catch {
      return null;
    }
  };

  try {
    const directImage = await tryFetchImage(imageUrl);
    if (directImage) {
      return directImage;
    }
  } catch {
    // Fall through to article scraping.
  }

  if (isValidHttpUrl(articleUrl)) {
    try {
      const articleResponse = await axios.get(articleUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 ET-NewsEra/1.0',
        },
        responseType: 'text',
      });

      const discoveredImage = extractMetaImage(articleResponse.data, articleUrl);

      if (discoveredImage) {
        const discoveredResponse = await tryFetchImage(discoveredImage);
        if (discoveredResponse) {
          return discoveredResponse;
        }
      }
    } catch {
      // Ignore article-page fetch issues and fall through to 404.
    }
  }

  const error = new Error('Unable to resolve a related image for this article.');
  error.statusCode = 404;
  throw error;
};

export const fetchNewsByKeyword = async (keyword) => {
  const queryCandidates = buildQueryCandidates(keyword);
  const cacheKey = sanitizeQuery(keyword);

  if (!queryCandidates.length) {
    const error = new Error('Please enter a simpler search term.');
    error.statusCode = 400;
    throw error;
  }

  let lastError;
  let hadSyntaxError = false;

  if (!isGNewsCoolingDown()) {
    for (const safeQuery of queryCandidates) {
      try {
        const { data } = await axios.get(`${GNEWS_BASE_URL}/search`, {
          params: {
            q: safeQuery,
            lang: 'en',
            country: 'us',
            max: 10,
            sortby: 'publishedAt',
            apikey: getApiKey(),
          },
          timeout: 15000,
        });

        const articles = (data.articles || []).map(normalizeArticle);
        newsCache.set(cacheKey, articles);
        return articles;
      } catch (error) {
        lastError = error;
        setGNewsCooldown(error);

        const syntaxError =
          error.response?.data?.errors?.q &&
          String(error.response.data.errors.q).toLowerCase().includes('syntax');

        hadSyntaxError = hadSyntaxError || Boolean(syntaxError);

        if (!syntaxError) {
          break;
        }
      }
    }
  } else {
    lastError = new Error('GNews is temporarily cooling down after a quota or timeout issue.');
    lastError.statusCode = 503;
  }

  if (hadSyntaxError) {
    try {
      const fallbackArticles = await fetchTrendingBusinessNews();
      return fallbackArticles;
    } catch (fallbackError) {
      lastError = fallbackError;
    }
  }

  try {
    const newsDataArticles = await fetchNewsDataByKeyword(queryCandidates[0]);

    if (newsDataArticles.length) {
      newsCache.set(cacheKey, newsDataArticles);
      return newsDataArticles;
    }
  } catch (fallbackProviderError) {
    lastError = fallbackProviderError;
  }

  throw buildRequestError(lastError, 'Unable to fetch live news from GNews.');
};

export const fetchTrendingBusinessNews = async () => {
  if (!isGNewsCoolingDown()) {
    try {
      const { data } = await axios.get(`${GNEWS_BASE_URL}/top-headlines`, {
        params: {
          category: 'business',
          lang: 'en',
          country: 'us',
          max: 10,
          apikey: getApiKey(),
        },
        timeout: 15000,
      });

      const articles = (data.articles || []).map(normalizeArticle);
      trendingCache = articles;
      return articles;
    } catch (error) {
      setGNewsCooldown(error);

      if (isTransientUpstreamError(error)) {
        // Avoid immediately issuing another GNews request when the upstream is already unstable.
      } else {
        try {
          const { data } = await axios.get(`${GNEWS_BASE_URL}/search`, {
            params: {
              q: 'business market economy',
              lang: 'en',
              country: 'us',
              max: 10,
              sortby: 'publishedAt',
              apikey: getApiKey(),
            },
            timeout: 15000,
          });

          const articles = (data.articles || []).map(normalizeArticle);
          trendingCache = articles;
          return articles;
        } catch (fallbackError) {
          setGNewsCooldown(fallbackError);
        }
      }
    }
  }

  try {
    const newsDataArticles = await fetchNewsDataTrending();

    if (newsDataArticles.length) {
      trendingCache = newsDataArticles;
      return newsDataArticles;
    }
  } catch (newsDataError) {
    throw buildRequestError(
      newsDataError,
      'Unable to fetch trending business news from the configured providers.'
    );
  }

  throw buildRequestError(
    new Error('Trending business news is temporarily unavailable from all providers.'),
    'Unable to fetch trending business news from the configured providers.'
  );
};
