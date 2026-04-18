import { rewrite, next } from '@vercel/functions';

const ASSET_EXT = /\.(png|svg|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|woff2?|ttf|eot|otf|json|xml|txt|map|webmanifest)$/i;

export default function middleware(request: Request) {
  const url = new URL(request.url);

  if (url.hostname === 'meet.savestate.dev') {
    // Static assets serve from project root, not /meet/
    if (ASSET_EXT.test(url.pathname)) {
      return next();
    }
    const path = url.pathname === '/' ? '/meet/' : `/meet${url.pathname}`;
    return rewrite(new URL(path, request.url));
  }

  return next();
}
