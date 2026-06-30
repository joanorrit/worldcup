import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { syncWorldCupMatches } from '@/lib/world-cup-matches';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REVALIDATE_PATHS = ['/', '/group2'];

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const cache = await syncWorldCupMatches();
    for (const path of REVALIDATE_PATHS) {
      revalidatePath(path);
    }

    return NextResponse.json({
      ok: true,
      generatedAt: cache.generatedAt,
      matches: cache.matches.length,
      path: process.env.WORLD_CUP_CACHE_BLOB_PATH ?? 'worldcup/matches/latest.json',
      revalidatedPaths: REVALIDATE_PATHS,
      source: cache.source,
    });
  } catch (error) {
    console.error('Could not sync World Cup fixtures.', error);

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'World Cup fixture sync failed.',
      },
      { status: 500 },
    );
  }
}

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    return process.env.NODE_ENV === 'development';
  }

  const authorization = request.headers.get('authorization');
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const querySecret = request.nextUrl.searchParams.get('secret');

  return bearer === configuredSecret || querySecret === configuredSecret;
}
