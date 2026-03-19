import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  generateAdventureId, 
  hashPassword, 
  validateAdventureYamlContent,
} from '@/lib/adventure-utils';
import { sendAdventureNotification } from '@/lib/discord-webhook';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// POST - Create a new adventure
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yamlContent, adminPassword, playerPassword } = body;
    const normalizedPlayerPassword = typeof playerPassword === 'string' ? playerPassword.trim() : '';

    if (typeof yamlContent !== 'string' || yamlContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'yamlContent is required' },
        { status: 400 }
      );
    }

    if (typeof adminPassword !== 'string' || adminPassword.length === 0) {
      return NextResponse.json(
        { error: 'adminPassword is required' },
        { status: 400 }
      );
    }

    if (playerPassword !== undefined && playerPassword !== null && typeof playerPassword !== 'string') {
      return NextResponse.json(
        { error: 'playerPassword must be a string when provided' },
        { status: 400 }
      );
    }

    const validation = validateAdventureYamlContent(yamlContent);
    if (validation.status === 'Invalid' || !validation.parsed) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors, warnings: validation.warnings },
        { status: 400 }
      );
    }

    const parsed = validation.parsed;

    // Generate ID and hash password
    const id = generateAdventureId();
    const adminPasswordHash = await hashPassword(adminPassword);
    const playerPasswordHash = normalizedPlayerPassword ? await hashPassword(normalizedPlayerPassword) : null;

    // Save to database
    const adventure = await db.adventure.create({
      data: {
        id,
        title: parsed.meta.title,
        adminPasswordHash,
        playerPasswordHash,
        yamlContent,
        theme: parsed.meta.theme,
      },
    });

    await sendAdventureNotification('created', {
      adventureId: adventure.id,
      title: adventure.title,
      theme: adventure.theme,
      baseUrl: request.nextUrl.origin,
    });

    return NextResponse.json({ 
      success: true, 
      adventure: {
        id: adventure.id,
        title: adventure.title,
        theme: adventure.theme,
      }
    });
  } catch (error) {
    console.error('Error creating adventure:', error);
    return NextResponse.json(
      { error: 'Failed to create adventure' },
      { status: 500 }
    );
  }
}
