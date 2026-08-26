import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/loyalty/settings
export async function GET(req: NextRequest) {
  try {
    const categoryId = req.nextUrl.searchParams.get('categoryId');
    
    if (categoryId) {
      let settings = await prisma.loyaltySetting.findUnique({
        where: { categoryId: parseInt(categoryId) },
        include: { category: true }
      });
      
      if (!settings) {
        return NextResponse.json({ error: 'Loyalty settings not found for this category' }, { status: 404 });
      }

      return NextResponse.json(formatSettings(settings));
    }

    const allSettings = await prisma.loyaltySetting.findMany({
      include: { category: true }
    });
    
    // If empty and no categoryId requested, create a default global one if desired
    // Or just return empty list
    return NextResponse.json(allSettings.map(formatSettings));
  } catch (e) {
    console.error('[LOYALTY] Error fetching settings:', e);
    return NextResponse.json({ error: 'Failed to fetch loyalty settings' }, { status: 500 });
  }
}

function formatSettings(settings: any) {
  let rewardDescription = 'Free Item';
  if (settings.rewardType === 'PERCENTAGE') {
    rewardDescription = `${settings.rewardValue}% Off`;
  } else if (settings.rewardType === 'FIXED_AMOUNT') {
    rewardDescription = `₱${settings.rewardValue} Off`;
  }
  
  return {
    id: settings.id,
    categoryId: settings.categoryId,
    categoryName: settings.category?.name || 'Global',
    coffeesRequiredForFree: settings.coffeesRequiredForFree,
    enabled: settings.enabled,
    cardColor: settings.cardColor,
    cardTitle: settings.cardTitle,
    cardDescription: settings.cardDescription,
    rewardType: settings.rewardType,
    rewardValue: settings.rewardValue,
    rewardDescription,
    isMilestoneMode: settings.isMilestoneMode,
    milestones: JSON.parse(settings.milestones || '[]'),
    maxHeldRewards: settings.maxHeldRewards,
  };
}

// PATCH /api/loyalty/settings
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      id,
      categoryId,
      coffeesRequiredForFree, 
      enabled, 
      cardColor, 
      cardTitle, 
      cardDescription,
      rewardType,
      rewardValue,
      isMilestoneMode,
      milestones,
      maxHeldRewards,
    } = body;

    // Validation
    if (coffeesRequiredForFree !== undefined && coffeesRequiredForFree < 1) {
      return NextResponse.json({ error: 'Threshold must be at least 1' }, { status: 400 });
    }

    let settings;
      if (id) {
        settings = await prisma.loyaltySetting.update({
          where: { id },
          data: {
            categoryId: (categoryId === '' || categoryId === null) ? null : parseInt(categoryId as string),
            coffeesRequiredForFree,
            enabled,
            cardColor,
            cardTitle,
            cardDescription,
            rewardType,
            rewardValue,
            isMilestoneMode,
            milestones: milestones ? JSON.stringify(milestones) : undefined,
            maxHeldRewards: maxHeldRewards != null ? parseInt(maxHeldRewards as any) : undefined,
          },
          include: { category: true }
        });
      } else {
        // Create new
        const targetCatId = categoryId === '' ? null : (categoryId ? parseInt(categoryId as string) : null);

        // When categoryId is null, we can't use findUnique with categoryId: undefined
        // so we skip the existence check and just create a global default
        if (targetCatId !== null) {
          const existing = await prisma.loyaltySetting.findUnique({
            where: { categoryId: targetCatId }
          });

          if (existing) {
            return NextResponse.json({ error: 'A loyalty module already exists for this category' }, { status: 400 });
          }
        }

        settings = await prisma.loyaltySetting.create({
          data: {
            categoryId: targetCatId,
            coffeesRequiredForFree: coffeesRequiredForFree || 10,
            enabled: enabled ?? true,
            cardColor: cardColor || '#8B4513',
            cardTitle: cardTitle || 'Loyalty Card',
            cardDescription: cardDescription || 'Earn rewards',
            rewardType: rewardType || 'FREE',
            rewardValue: rewardValue ?? 0,
            isMilestoneMode: isMilestoneMode ?? false,
            milestones: milestones ? JSON.stringify(milestones) : "[]",
            maxHeldRewards: maxHeldRewards != null ? parseInt(maxHeldRewards as any) : 3,
          },
          include: { category: true }
        });
      }


    
    return NextResponse.json(formatSettings(settings));
  } catch (e) {
    console.error('[LOYALTY] Error updating settings:', e);
    return NextResponse.json({ error: 'Failed to update loyalty settings' }, { status: 500 });
  }
}

// DELETE /api/loyalty/settings
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.loyaltySetting.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
