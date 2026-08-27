import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth';
import { rewardLabel } from '@/lib/loyalty-utils';

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
        return notFound('Loyalty settings not found for this category');
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
    return serverError(e, 'Failed to fetch loyalty settings');
  }
}

function formatSettings(settings: any) {
  const rewardDescription = rewardLabel(settings.rewardType, settings.rewardValue);

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
  const user = await requirePermission(req, 'loyalty');
  if (!user) return unauthorized();

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
      return badRequest('Threshold must be at least 1');
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
            return badRequest('A loyalty module already exists for this category');
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
    return serverError(e, 'Failed to update loyalty settings');
  }
}

// DELETE /api/loyalty/settings
export async function DELETE(req: NextRequest) {
  const user = await requirePermission(req, 'loyalty');
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('ID required');

    await prisma.loyaltySetting.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return serverError(e, 'Failed to delete');
  }
}
