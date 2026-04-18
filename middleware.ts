import { rewrite, next } from '@vercel/functions';

export default function middleware(request: Request) {
  const url = new URL(request.url);

  if (url.hostname === 'meet.savestate.dev') {
    const path = url.pathname === '/' ? '/meet/index.html' : `/meet${url.pathname}`;
    return rewrite(new URL(path, request.url));
  }

  return next();
}
