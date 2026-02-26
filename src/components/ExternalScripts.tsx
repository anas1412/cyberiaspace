import { useEffect } from 'react';

const scripts = [
  { src: 'https://platform.twitter.com/widgets.js', charset: 'utf-8', async: true },
  { src: 'https://www.instagram.com/embed.js', async: true },
  { src: 'https://www.tiktok.com/embed.js', async: true },
  { src: 'https://embed.reddit.com/widgets.js', charset: 'utf-8', async: true },
];

export default function ExternalScripts() {
  useEffect(() => {
    scripts.forEach(({ src, charset, async }) => {
      if (document.querySelector(`script[src="${src}"]`)) return;

      const script = document.createElement('script');
      script.src = src;
      if (charset) script.charset = charset;
      if (async) script.async = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    });
  }, []);

  return null;
}
