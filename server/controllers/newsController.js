import SearchHistory from '../models/SearchHistory.js';
import {
  fetchNewsByKeyword,
  fetchTrendingBusinessNews,
  getCachedNewsByKeyword,
  getCachedTrendingNews,
  isGNewsQuotaOrTimeoutError,
  proxyNewsImage,
} from '../services/newsService.js';

export const getNews = async (req, res, next) => {
  try {
    const query = req.query.q?.trim();

    if (!query) {
      return res.status(400).json({ message: 'Query parameter "q" is required.' });
    }

    const articles = await fetchNewsByKeyword(query);

    await SearchHistory.create({
      query,
      articleCount: articles.length,
    });

    res.json({
      query,
      total: articles.length,
      articles,
    });
  } catch (error) {
    if (isGNewsQuotaOrTimeoutError(error)) {
      const cachedArticles = getCachedNewsByKeyword(req.query.q?.trim()) || getCachedTrendingNews();

      return res.json({
        query: req.query.q?.trim() || '',
        total: cachedArticles.length,
        articles: cachedArticles,
        warning:
          'Live GNews requests are temporarily unavailable due to timeout or daily request limit. Showing the latest cached coverage instead.',
      });
    }

    next(error);
  }
};

export const getTrendingTopics = async (_req, res, next) => {
  try {
    const articles = await fetchTrendingBusinessNews();

    res.json({
      total: articles.length,
      articles,
    });
  } catch (error) {
    const cachedArticles = getCachedTrendingNews();

    res.json({
      total: cachedArticles.length,
      articles: cachedArticles,
      warning:
        'Trending news is temporarily unavailable from GNews. Showing cached headlines when available.',
    });
  }
};

export const getNewsImage = async (req, res, next) => {
  try {
    const imageUrl = req.query.url?.trim();
    const articleUrl = req.query.articleUrl?.trim();

    if (!imageUrl && !articleUrl) {
      return res.status(400).json({ message: 'An image URL or article URL is required.' });
    }

    const response = await proxyNewsImage({ imageUrl, articleUrl });
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    response.data.pipe(res);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(204).end();
    }

    next(error);
  }
};
