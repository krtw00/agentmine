import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, settings } from '@/lib/db';

/**
 * GET /api/settings - List all settings
 */
export async function GET() {
  try {
    const db = getDb();
    const result = await db.select().from(settings);

    // Convert to key-value object for easier consumption
    const settingsObj: Record<string, unknown> = {};
    for (const setting of result) {
      settingsObj[setting.key] = setting.value;
    }

    return NextResponse.json({
      settings: settingsObj,
      raw: result,
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings - Update settings (upsert)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, updatedBy } = body;

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if setting exists
    const [existing] = await db.select().from(settings).where(eq(settings.key, key));

    if (existing) {
      // Update
      const [updated] = await db
        .update(settings)
        .set({
          value,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(settings.key, key))
        .returning();
      return NextResponse.json(updated);
    } else {
      // Insert
      const [created] = await db.insert(settings).values({
        key,
        value,
        updatedBy,
      }).returning();
      return NextResponse.json(created, { status: 201 });
    }
  } catch (error) {
    console.error('Failed to update setting:', error);
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings - Delete a setting
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    await db.delete(settings).where(eq(settings.key, key));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete setting:', error);
    return NextResponse.json(
      { error: 'Failed to delete setting' },
      { status: 500 }
    );
  }
}
