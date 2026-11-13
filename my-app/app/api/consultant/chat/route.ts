import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';

// GET /api/consultant/chat — return available business context for AI
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return unauthorized();
    }

    const settings = await prisma.businessSettings.findFirst();
    const aiFolderAccess = settings?.aiFolderAccess ?? false;

    if (!aiFolderAccess) {
      return NextResponse.json({
        hasAccess: false,
        message: 'AI folder access is disabled. Enable it in Settings > AI Consultant.',
      });
    }

    const [products, ingredients, recentOrders, loyaltyCards, staff] = await Promise.all([
      prisma.product.findMany({
        include: { category: { select: { name: true } } },
        take: 50,
      }),
      aiFolderAccess && (settings?.aiReadBirPricing ?? false)
        ? prisma.ingredient.findMany({ include: { supplier: { select: { name: true } } }, take: 50 })
        : [],
      aiFolderAccess
        ? prisma.order.findMany({
            include: { items: { include: { product: { select: { name: true } } } } },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : [],
      aiFolderAccess
        ? prisma.loyaltyCard.findMany({
            include: { category: { select: { name: true } }, vouchers: { where: { status: 'ACTIVE' } } },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : [],
      aiFolderAccess
        ? prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, active: true },
            where: { active: true },
          })
        : [],
    ]);

    return NextResponse.json({
      hasAccess: true,
      businessName: settings?.businessName || 'Pebot',
      businessInfo: {
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        tin: settings?.tin,
        vatRate: settings?.vatRate,
      },
      menu: products.map((p) => ({
        name: p.name,
        price: p.price,
        category: p.category?.name,
        description: p.description,
      })),
      inventory: aiFolderAccess && (settings?.aiReadBirPricing ?? false)
        ? ingredients.map((i) => ({
            name: i.name,
            currentStock: i.currentStock,
            minStock: i.minStock,
            costPerUnit: i.costPerUnit,
            supplier: i.supplier?.name,
          }))
        : [],
      recentOrders: recentOrders.map((o) => ({
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        status: o.status,
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
        items: o.items.map((i) => ({ name: i.product?.name || 'Unknown', quantity: i.quantity })),
      })),
      loyalty: aiFolderAccess
        ? loyaltyCards.map((c) => ({
            customerName: c.customerName,
            loyaltyPoints: c.loyaltyPoints,
            paidCoffeesCount: c.paidCoffeesCount,
            category: c.category?.name || null,
            activeVouchers: c.vouchers.length,
          }))
        : [],
      staff: aiFolderAccess
        ? staff.map((s) => ({
            name: s.name,
            email: s.email,
            role: s.role,
          }))
        : [],
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch business context');
  }
}

// POST /api/consultant/chat - proxy chat to OpenRouter
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return unauthorized();
    }

    const body = await req.json();
    const { messages, model: overrideModel, conversationId } = body as {
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      model?: string;
      conversationId?: number;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return badRequest('Messages are required');
    }

    // Save messages to conversation if conversationId provided
    if (conversationId) {
      const conversation = await prisma.aIConversation.findFirst({
        where: { id: conversationId, userId: user.userId },
      });
      if (conversation) {
        const messagesToSave = messages.filter((m) => m.role !== 'system');
        for (const msg of messagesToSave) {
          await prisma.aIMessage.create({
            data: {
              conversationId,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            },
          });
        }
      }
    }

    // Fetch business settings for AI config
    const settings = await prisma.businessSettings.findFirst();
    const apiKey = settings?.aiApiKey;
    const model = overrideModel || settings?.aiModel || 'google/gemma-2-27b-it';
    const systemPrompt = settings?.aiSystemPrompt || 'You are Pebot Assistant, a helpful AI consultant for restaurant management.';
    const aiFolderAccess = settings?.aiFolderAccess ?? false;

    if (!apiKey) {
      return NextResponse.json({ error: 'AI API key not configured. Please add it in Settings > AI Consultant.' }, { status: 503 });
    }

    // Build the messages array with system prompt first
    let apiMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'system' as const, content: systemPrompt },
    ];

    // If AI folder access is enabled, append business context as a system message
    if (aiFolderAccess) {
      const context = await fetch(`${req.nextUrl.origin}/api/consultant/chat`, { headers: { cookie: req.headers.get('cookie') || '' } }).then((r) => r.ok ? r.json() : null);
      if (context && context.hasAccess) {
        let businessContext = `You have access to the following business data for this restaurant:\n\n`;
        businessContext += `Business Name: ${context.businessName}\n\n`;
        businessContext += `Menu (${context.menu.length} items):\n${context.menu.map((p: any) => `- ${p.name} (₱${p.price}) - ${p.category}`).join('\n')}\n\n`;

        if (context.inventory && context.inventory.length > 0) {
          businessContext += `Inventory (${context.inventory.length} items):\n${context.inventory.map((i: any) => `- ${i.name}: ${i.currentStock}${i.supplier ? ` (Supplier: ${i.supplier})` : ''}`).join('\n')}\n\n`;
        }

        if (context.recentOrders && context.recentOrders.length > 0) {
          businessContext += `Recent Orders (${context.recentOrders.length} recent):\n${context.recentOrders.map((o: any) => `- #${o.orderNumber}: ₱${o.totalAmount} (${o.status}) - ${o.items.map((i: any) => i.name).join(', ')}`).join('\n')}`;
        }

        apiMessages.push({ role: 'system', content: businessContext });
      }
    }

    // Add user messages (excluding any system messages they sent)
    apiMessages = [...apiMessages, ...messages.filter((m) => m.role !== 'system')];

    // Proxy to OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://caferep.app',
        'X-Title': 'Pebot Consultant',
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: `OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || 'No response from AI.';

    return NextResponse.json({
      message: assistantMessage,
      model: data.model,
      conversationId,
    });
  } catch (error) {
    return serverError(error, 'Failed to process chat request');
  }
}
