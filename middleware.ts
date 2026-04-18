import { rewrite, next } from '@vercel/functions';

export default function middleware(request: Request) {
  const url = new URL(request.url);

  if (url.hostname === 'meet.savestate.dev') {
    const path = url.pathname === '/' ? '/meet/' : `/meet${url.pathname}`;
    return rewrite(new URL(path, request.url));
  }

  return next();
}
