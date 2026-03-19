import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseAdventureYaml, verifyPassword } from '@/lib/adventure-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// GET - Get adventure details (public, without password)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const adventure = await db.adventure.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        theme: true,
        playerPasswordHash: true,
        yamlContent: true,
        createdAt: true,
      },
    });

    if (!adventure) {
      return NextResponse.json({ error: 'Adventure not found' }, { status: 404 });
    }

    // Parse YAML to get metadata
    const parsed = parseAdventureYaml(adventure.yamlContent);

    return NextResponse.json({ 
      adventure: {
        ...adventure,
        requiresPlayerPassword: Boolean(adventure.playerPasswordHash),
        meta: parsed.meta,
        scenes: parsed.scenes.map(s => ({ id: s.id, title: s.title })),
      }
    });
  } catch (error) {
    console.error('Error fetching adventure:', error);
    return NextResponse.json(
      { error: 'Failed to fetch adventure' },
      { status: 500 }
    );
  }
}

// DELETE - Delete adventure
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { adminPassword } = body;

    const adventure = await db.adventure.findUnique({
      where: { id },
    });

    if (!adventure) {
      return NextResponse.json({ error: 'Adventure not found' }, { status: 404 });
    }

    // For DELETE, we need the DM password in the body or we can check via query param
    const providedPassword = adminPassword || request.nextUrl.searchParams.get('password');
    
    if (!providedPassword) {
      return NextResponse.json(
        { error: 'Admin password required' },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(providedPassword, adventure.adminPasswordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Delete adventure (cascade will delete game states)
    await db.adventure.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting adventure:', error);
    return NextResponse.json(
      { error: 'Failed to delete adventure' },
      { status: 500 }
    );
  }
}
