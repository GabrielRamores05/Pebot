import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkFeatureAccess } from '@/lib/auth';
import { logAction } from '@/lib/audit-log';

// GET /api/settings/business - Get business settings
export async function GET(req: NextRequest) {
  // Check if user has access to settings feature
  const { user, hasAccess } = await checkFeatureAccess(req, 'settings');

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAccess) {
    return NextResponse.json({ error: 'Feature not available in your subscription tier' }, { status: 403 });
  }

  try {
    let settings = await prisma.businessSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.businessSettings.create({
        data: {
          businessName: 'CaféOS Coffee Shop',
          businessAddress: '',
          tin: '',
          branchCode: '0000',
          vatRate: 12,
          receiptSerialPrefix: 'INV',
          lastReceiptNumber: 0,
          footerMessage: 'Thank you for your visit!',
          loyaltyEnabled: true,
          aiFolderAccess: false,
          aiReadBirPricing: false,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching business settings:', error);
    return NextResponse.json({ error: 'Failed to fetch business settings' }, { status: 500 });
  }
}

// PUT /api/settings/business - Update business settings
export async function PUT(req: NextRequest) {
  // Check if user has access to settings feature
  const { user, hasAccess } = await checkFeatureAccess(req, 'settings');

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAccess) {
    return NextResponse.json({ error: 'Feature not available in your subscription tier' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const {
      businessName,
      businessAddress,
      tin,
      branchCode,
      vatRate,
      receiptSerialPrefix,
      footerMessage,
      loyaltyEnabled,
      // Payment methods
      gcashAccountName,
      gcashQrImage,
      paymayaAccountName,
      paymayaQrImage,
      // AI Consultant
      aiApiKey,
      aiModel,
      aiSystemPrompt,
      aiFolderAccess,
      aiReadBirPricing,
    } = body;

    let settings = await prisma.businessSettings.findFirst();

    if (settings) {
      settings = await prisma.businessSettings.update({
        where: { id: settings.id },
        data: {
          businessName: String(businessName || settings.businessName),
          businessAddress: String(businessAddress ?? settings.businessAddress),
          tin: String(tin ?? settings.tin),
          branchCode: String(branchCode ?? settings.branchCode),
          vatRate: vatRate != null ? Number(vatRate) : settings.vatRate,
          receiptSerialPrefix: String(receiptSerialPrefix ?? settings.receiptSerialPrefix),
          footerMessage: String(footerMessage ?? settings.footerMessage),
          loyaltyEnabled: loyaltyEnabled ?? settings.loyaltyEnabled,
          gcashAccountName: gcashAccountName ?? settings.gcashAccountName,
          gcashQrImage: gcashQrImage ?? settings.gcashQrImage,
          paymayaAccountName: paymayaAccountName ?? settings.paymayaAccountName,
          paymayaQrImage: paymayaQrImage ?? settings.paymayaQrImage,
          aiApiKey: aiApiKey ?? settings.aiApiKey,
          aiModel: aiModel ?? settings.aiModel,
          aiSystemPrompt: aiSystemPrompt ?? settings.aiSystemPrompt,
          aiFolderAccess: aiFolderAccess ?? settings.aiFolderAccess,
          aiReadBirPricing: aiReadBirPricing ?? settings.aiReadBirPricing,
        },
      });
    } else {
      settings = await prisma.businessSettings.create({
        data: {
          businessName: String(businessName) || 'CaféOS Coffee Shop',
          businessAddress: String(businessAddress) || '',
          tin: String(tin) || '',
          branchCode: String(branchCode) || '0000',
          vatRate: vatRate != null ? Number(vatRate) : 12,
          receiptSerialPrefix: String(receiptSerialPrefix) || 'INV',
          lastReceiptNumber: 0,
          footerMessage: String(footerMessage) || 'Thank you for your visit!',
          loyaltyEnabled: loyaltyEnabled ?? true,
          gcashAccountName: gcashAccountName ?? null,
          gcashQrImage: gcashQrImage ?? null,
          paymayaAccountName: paymayaAccountName ?? null,
          paymayaQrImage: paymayaQrImage ?? null,
          aiApiKey: aiApiKey ?? null,
          aiModel: aiModel ?? 'google/gemma-4-31b-it',
          aiSystemPrompt: aiSystemPrompt ?? 'You are CaféOS Assistant, a helpful AI consultant for coffee shop management.',
          aiFolderAccess: aiFolderAccess ?? false,
          aiReadBirPricing: aiReadBirPricing ?? false,
        },
      });
    }

    await logAction({
      action: 'SETTINGS_UPDATE',
      resource: 'business_settings',
      resourceId: settings.id,
      details: { updatedFields: Object.keys(body) },
      userId: user.userId,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating business settings:', error);
    return NextResponse.json({ error: 'Failed to update business settings: ' + String(error) }, { status: 500 });
  }
}

// POST /api/settings/business/generate-serial - Generate next receipt serial
export async function POST(req: NextRequest) {
  // Check if user has access to settings feature
  const { user, hasAccess } = await checkFeatureAccess(req, 'settings');

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAccess) {
    return NextResponse.json({ error: 'Feature not available in your subscription tier' }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (body.action === 'generateSerial') {
      let settings = await prisma.businessSettings.findFirst();

      if (!settings) {
        settings = await prisma.businessSettings.create({
          data: {
            businessName: 'CaféOS Coffee Shop',
            businessAddress: '',
            tin: '',
            branchCode: '0000',
            vatRate: 12,
            receiptSerialPrefix: 'INV',
            lastReceiptNumber: 0,
            footerMessage: 'Thank you for your visit!',
            loyaltyEnabled: true,
          },
        });
      }

      // Increment and get next serial
      const newNumber = settings.lastReceiptNumber + 1;
      await prisma.businessSettings.update({
        where: { id: settings.id },
        data: { lastReceiptNumber: newNumber },
      });

      const serial = `${settings.receiptSerialPrefix}-${newNumber.toString().padStart(6, '0')}`;

      return NextResponse.json({ serial, number: newNumber });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error generating serial:', error);
    return NextResponse.json({ error: 'Failed to generate serial' }, { status: 500 });
  }
}
