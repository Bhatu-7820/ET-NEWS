import { generateNewsSummary, answerNewsQuestion, generateNewsImage } from '../services/aiService.js';

export const getSummary = async (req, res, next) => {
  try {
    const { articles } = req.body;

    if (!Array.isArray(articles) || !articles.length) {
      return res.status(400).json({ message: 'A non-empty "articles" array is required.' });
    }

    const summary = await generateNewsSummary(articles);
    res.json(summary);
  } catch (error) {
    next(error);
  }
};

export const chatWithNews = async (req, res, next) => {
  try {
    const { question, context } = req.body;

    if (!question?.trim()) {
      return res.status(400).json({ message: 'A "question" value is required.' });
    }

    const answer = await answerNewsQuestion({
      question,
      context,
    });

    res.json({ answer });
  } catch (error) {
    next(error);
  }
};

export const createNewsImage = async (req, res, next) => {
  try {
    const { prompt, context } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({ message: 'A "prompt" value is required.' });
    }

    const image = await generateNewsImage({
      prompt,
      context,
    });

    res.json(image);
  } catch (error) {
    next(error);
  }
};
