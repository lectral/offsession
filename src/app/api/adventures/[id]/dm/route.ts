import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/adventure-utils';
import { parseAdventureYaml } from '@/lib/adventure-utils';
import { normalizeHistoryEntry } from '@/lib/game-state';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// POST - Verify DM password and get dashboard data
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { password, sessionId } = body;

    const adventure = await db.adventure.findUnique({
      where: { id },
    });

    if (!adventure) {
      return NextResponse.json({ error: 'Adventure not found' }, { status: 404 });
    }

    // Verify password
    const isValid = await verifyPassword(password, adventure.adminPasswordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Get game states for this adventure
    const gameStates = await db.gameState.findMany({
      where: { adventureId: id },
      orderBy: { updatedAt: 'desc' },
    });

    // Parse YAML for scene info
    const parsed = parseAdventureYaml(adventure.yamlContent);

    const response: Record<string, unknown> = {
      adventure: {
        id: adventure.id,
        title: adventure.title,
        theme: adventure.theme,
        yamlContent: adventure.yamlContent,
      },
      gameStates: gameStates.map(gs => ({
        id: gs.id,
        currentSceneId: gs.currentSceneId,
        updatedAt: gs.updatedAt,
        historyLength: JSON.parse(gs.history).length,
      })),
      scenes: parsed.scenes,
    };

    if (typeof sessionId === 'string' && sessionId.length > 0) {
      const session = gameStates.find(gs => gs.id === sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      response.sessionDetail = {
        sessionId: session.id,
        currentSceneId: session.currentSceneId,
        updatedAt: session.updatedAt,
        history: JSON.parse(session.history).map((entry: unknown) => normalizeHistoryEntry(entry)),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in DM dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to access DM dashboard' },
      { status: 500 }
    );
  }
}
