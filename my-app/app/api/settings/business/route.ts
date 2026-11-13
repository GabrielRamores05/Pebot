import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/audit-log';
import { badRequest, serverError } from '@/lib/api-response';
import { guardFeature } from '@/lib/api-guards';
import { createBusinessSettings, findBusinessSettings } from '@/modules/system/repository';

// GET /api/settings/business - Get business settings.
// Public: customers' cart/order pages load branding, payment-account and
// receipt info without a session. Only PUT (updates) requires the settings role.
export async function GET() {
  try {
    let settings = await findBusinessSettings();

    // Create default settings if none exist
    if (!settings) {
      settings = await createBusinessSettings({
        businessName: 'My Restaurant',
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
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    return serverError(error, 'Failed to fetch business settings');
  }
}

// PUT /api/settings/business - Update business settings
export async function PUT(req: NextRequest) {
  // Check if user has access to settings feature
  const { user, error } = await guardFeature(req, 'settings');
  if (error) return error;

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
      studentPwdDiscountRate,
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
          studentPwdDiscountRate: studentPwdDiscountRate != null ? Number(studentPwdDiscountRate) : settings.studentPwdDiscountRate,
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
          businessName: String(businessName) || 'My Restaurant',
          businessAddress: String(businessAddress) || '',
          tin: String(tin) || '',
          branchCode: String(branchCode) || '0000',
          vatRate: vatRate != null ? Number(vatRate) : 12,
          receiptSerialPrefix: String(receiptSerialPrefix) || 'INV',
          lastReceiptNumber: 0,
          footerMessage: String(footerMessage) || 'Thank you for your visit!',
          loyaltyEnabled: loyaltyEnabled ?? true,
          studentPwdDiscountRate: studentPwdDiscountRate != null ? Number(studentPwdDiscountRate) : 20,
          gcashAccountName: gcashAccountName ?? null,
          gcashQrImage: gcashQrImage ?? null,
          paymayaAccountName: paymayaAccountName ?? null,
          paymayaQrImage: paymayaQrImage ?? null,
          aiApiKey: aiApiKey ?? null,
          aiModel: aiModel ?? 'google/gemma-4-31b-it',
          aiSystemPrompt: aiSystemPrompt ?? 'You are Pebot Assistant, a helpful AI consultant for restaurant management.',
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
  const { error } = await guardFeature(req, 'settings');
  if (error) return error;

  try {
    const body = await req.json();

    if (body.action === 'generateSerial') {
      let settings = await prisma.businessSettings.findFirst();

      if (!settings) {
        settings = await prisma.businessSettings.create({
          data: {
            businessName: 'My Restaurant',
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

    return badRequest('Invalid action');
  } catch (error) {
    return serverError(error, 'Failed to generate serial');
  }
}
