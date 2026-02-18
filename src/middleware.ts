import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fullmind — Coming Soon</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #FFFCFA;
      color: #403770;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 480px;
    }
    .logo {
      width: 48px;
      height: 48px;
      background: #F37167;
      border-radius: 12px;
      margin: 0 auto 2rem;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
    }
    p {
      font-size: 1.05rem;
      color: #6EA3BE;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo"></div>
    <h1>We're building something new</h1>
    <p>Fullmind is under active development. Check back soon.</p>
  </div>
</body>
</html>`

export async function middleware(request: NextRequest) {
  // Maintenance mode — toggle via MAINTENANCE_MODE env var in Vercel
  if (process.env.MAINTENANCE_MODE === 'true') {
    // Let static assets through
    if (
      request.nextUrl.pathname.startsWith('/_next') ||
      request.nextUrl.pathname.startsWith('/favicon')
    ) {
      return NextResponse.next()
    }
    return new NextResponse(MAINTENANCE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html', 'Retry-After': '3600' },
    })
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - API routes that should be public (tiles for map rendering)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/tiles).*)',
  ],
}
