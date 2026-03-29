import { useEffect, useState } from 'react';
import { fetchGeneratedImage } from '../services/api';

const palette = [
  {
    from: '#d94f2b',
    to: '#f59e0b',
    panel: '#fff3df',
    line: '#8a2d18',
    glow: '#ffe0b0',
  },
  {
    from: '#1d4ed8',
    to: '#38bdf8',
    panel: '#eef6ff',
    line: '#1e40af',
    glow: '#c8e8ff',
  },
  {
    from: '#065f46',
    to: '#10b981',
    panel: '#eafbf3',
    line: '#065f46',
    glow: '#bdf3d7',
  },
  {
    from: '#7c2d12',
    to: '#d97706',
    panel: '#fff2e2',
    line: '#7c2d12',
    glow: '#ffd0a8',
  },
];

const generatedImageCache = new Map();
const pendingImageRequests = new Map();
let aiImageGenerationDisabled = false;

const COUNTRY_HINTS = [
  'ukraine',
  'russia',
  'israel',
  'gaza',
  'palestine',
  'iran',
  'iraq',
  'syria',
  'lebanon',
  'yemen',
  'sudan',
  'india',
  'pakistan',
  'china',
  'taiwan',
  'japan',
  'south korea',
  'north korea',
  'afghanistan',
  'turkey',
  'france',
  'germany',
  'uk',
  'britain',
  'united states',
  'us',
];

const pickPalette = (seed = '') => {
  const value = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[value % palette.length];
};

const escapeXml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const trimLine = (value, limit) => {
  if (!value) {
    return '';
  }

  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
};

const inferRegionFromHeadline = (value = '') => {
  const normalized = value.toLowerCase();
  return COUNTRY_HINTS.find((country) => normalized.includes(country)) || '';
};

const buildImagePrompt = ({ title, source, alt }) => {
  const headline = title || alt || 'latest news coverage';
  const normalized = headline.toLowerCase();
  const region = inferRegionFromHeadline(`${headline} ${source || ''}`);

  if (
    normalized.includes('war') ||
    normalized.includes('battle') ||
    normalized.includes('missile') ||
    normalized.includes('strike') ||
    normalized.includes('troop') ||
    normalized.includes('military') ||
    normalized.includes('invasion') ||
    normalized.includes('conflict') ||
    normalized.includes('ceasefire')
  ) {
    return `Create a realistic editorial news image of a war scene${region ? ` in ${region}` : ''}. Show conflict-related visuals such as soldiers, damaged streets, smoke, military vehicles, or civilians in a tense environment. Keep it serious, news-photography inspired, and directly related to this headline: "${headline}".`;
  }

  if (
    normalized.includes('protest') ||
    normalized.includes('riot') ||
    normalized.includes('demonstration') ||
    normalized.includes('unrest')
  ) {
    return `Create a realistic editorial news image of a public protest${region ? ` in ${region}` : ''}, with crowds, signs, police presence, and a serious on-the-ground journalism feel. Base it on this headline: "${headline}".`;
  }

  if (
    normalized.includes('election') ||
    normalized.includes('vote') ||
    normalized.includes('parliament') ||
    normalized.includes('president') ||
    normalized.includes('prime minister')
  ) {
    return `Create a realistic editorial political news image${region ? ` set in ${region}` : ''}, showing election or government visuals such as campaign stages, ballot imagery, parliament buildings, or press microphones. Keep it relevant to: "${headline}".`;
  }

  if (
    normalized.includes('market') ||
    normalized.includes('stocks') ||
    normalized.includes('shares') ||
    normalized.includes('earnings') ||
    normalized.includes('inflation') ||
    normalized.includes('trade') ||
    normalized.includes('economy')
  ) {
    return `Create a realistic editorial business news image${region ? ` connected to ${region}` : ''}, showing stock-market screens, traders, city financial districts, factories, shipping, or economic activity. Keep it directly relevant to this headline: "${headline}".`;
  }

  if (
    normalized.includes('flood') ||
    normalized.includes('earthquake') ||
    normalized.includes('wildfire') ||
    normalized.includes('storm') ||
    normalized.includes('hurricane')
  ) {
    return `Create a realistic editorial disaster news image${region ? ` in ${region}` : ''}, showing the impact of the event in a way that matches this headline: "${headline}".`;
  }

  return `Create a realistic editorial news image${region ? ` related to ${region}` : ''} that visually represents this headline: "${headline}". Avoid abstract art and keep it like a strong newspaper photo illustration.`;
};

const buildGeneratedVisual = ({ title, source, alt }) => {
  const colors = pickPalette(title || source || alt);
  const label = trimLine(source || 'Related visual', 22);
  const headline = trimLine(title || alt || 'Live market coverage', 58);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors.from}" />
          <stop offset="100%" stop-color="${colors.to}" />
        </linearGradient>
        <linearGradient id="fade" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0.72" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="1200" height="720" fill="url(#bg)" />
      <circle cx="930" cy="120" r="180" fill="${colors.glow}" fill-opacity="0.34" />
      <circle cx="1040" cy="200" r="88" fill="#ffffff" fill-opacity="0.16" />
      <rect x="84" y="108" width="316" height="216" rx="26" fill="${colors.panel}" fill-opacity="0.94" />
      <rect x="120" y="146" width="116" height="20" rx="10" fill="${colors.line}" fill-opacity="0.24" />
      <rect x="120" y="188" width="188" height="18" rx="9" fill="${colors.line}" fill-opacity="0.16" />
      <rect x="120" y="224" width="148" height="18" rx="9" fill="${colors.line}" fill-opacity="0.16" />
      <rect x="120" y="268" width="44" height="24" rx="8" fill="${colors.line}" fill-opacity="0.65" />
      <path d="M480 456 L618 388 L734 418 L842 298 L966 344 L1080 228" fill="none" stroke="#fff9ef" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="618" cy="388" r="14" fill="#fff9ef" />
      <circle cx="842" cy="298" r="14" fill="#fff9ef" />
      <circle cx="1080" cy="228" r="16" fill="#fff9ef" />
      <rect x="470" y="510" width="620" height="18" rx="9" fill="#fff9ef" fill-opacity="0.30" />
      <rect x="470" y="548" width="540" height="18" rx="9" fill="#fff9ef" fill-opacity="0.18" />
      <rect x="0" y="0" width="1200" height="720" fill="url(#fade)" />
      <text x="84" y="560" fill="#fff7eb" font-family="Arial, Helvetica, sans-serif" font-size="28" letter-spacing="7">GENERATED NEWS VISUAL</text>
      <text x="84" y="610" fill="#fff7eb" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="700">${escapeXml(label)}</text>
      <text x="84" y="668" fill="#fff7eb" font-family="Georgia, Times New Roman, serif" font-size="42">${escapeXml(headline)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const NewsImage = ({
  src,
  alt,
  title,
  source,
  className,
  fallbackClassName = '',
  eager = false,
}) => {
  const [failed, setFailed] = useState(false);
  const [generatedSrc, setGeneratedSrc] = useState('');
  const showFallback = !src || failed;

  useEffect(() => {
    if (!showFallback) {
      return;
    }

    if (aiImageGenerationDisabled) {
      return;
    }

    const cacheKey = JSON.stringify({
      title: title || alt || '',
      source: source || '',
    });

    if (generatedImageCache.has(cacheKey)) {
      setGeneratedSrc(generatedImageCache.get(cacheKey));
      return;
    }

    if (pendingImageRequests.has(cacheKey)) {
      pendingImageRequests.get(cacheKey).then(setGeneratedSrc).catch(() => {});
      return;
    }

    let active = true;
    const request = fetchGeneratedImage({
      prompt: buildImagePrompt({ title, source, alt }),
      context: {
        title,
        alt,
        source,
      },
    })
      .then((result) => {
        const nextSrc = result?.imageBase64
          ? `data:${result.mimeType || 'image/png'};base64,${result.imageBase64}`
          : '';

        if (nextSrc) {
          generatedImageCache.set(cacheKey, nextSrc);
        }

        return nextSrc;
      })
      .catch((error) => {
        const statusCode = error?.response?.status;
        const message = String(error?.response?.data?.message || error?.message || '').toLowerCase();

        if (
          statusCode === 503 &&
          message.includes('image generation is currently disabled')
        ) {
          aiImageGenerationDisabled = true;
        }

        return '';
      })
      .finally(() => {
        pendingImageRequests.delete(cacheKey);
      });

    pendingImageRequests.set(cacheKey, request);

    request.then((nextSrc) => {
      if (active && nextSrc) {
        setGeneratedSrc(nextSrc);
      }
    });

    return () => {
      active = false;
    };
  }, [showFallback, title, source, alt]);

  if (showFallback) {
    const generatedVisual = generatedSrc || buildGeneratedVisual({ title, source, alt });

    return (
      <div
        className={`relative overflow-hidden ${fallbackClassName || className}`}
      >
        <img
          src={generatedVisual}
          alt={alt || title || 'Generated news visual'}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
            {generatedSrc ? source || 'AI News Visual' : source || 'Generated Visual'}
          </p>
          <p className="mt-2 font-display text-lg leading-6">
            {title || alt || 'Latest news coverage'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || title || 'News image'}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

export default NewsImage;
