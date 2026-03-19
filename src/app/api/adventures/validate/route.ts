import { NextRequest, NextResponse } from 'next/server';
import { validateAdventureYamlContent } from '@/lib/adventure-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const MAX_YAML_SIZE = 500_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yamlContent } = body;

    if (typeof yamlContent !== 'string' || yamlContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'yamlContent is required' },
        { status: 400 }
      );
    }

    if (yamlContent.length > MAX_YAML_SIZE) {
      return NextResponse.json(
        { error: `yamlContent exceeds ${MAX_YAML_SIZE} characters` },
        { status: 413 }
      );
    }

    const validation = validateAdventureYamlContent(yamlContent);

    return NextResponse.json({
      status: validation.status,
      errors: validation.errors,
      warnings: validation.warnings,
      graph: validation.graph,
    });
  } catch (error) {
    console.error('Error validating adventure YAML:', error);
    return NextResponse.json(
      { error: 'Failed to validate adventure YAML' },
      { status: 500 }
    );
  }
}
