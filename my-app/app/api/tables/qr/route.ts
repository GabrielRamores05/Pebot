import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';
import os from 'os';
import { badRequest, notFound, serverError } from '@/lib/api-response';

// Get the server's local IP address automatically
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const info of iface) {
      // Look for IPv4 addresses that are internal (not external)
      if (info.family === 'IPv4' && !info.internal) {
        // Prefer common local network prefixes
        if (info.address.startsWith('192.168.') || info.address.startsWith('10.') || info.address.startsWith('172.')) {
          return info.address;
        }
      }
    }
  }
  // Fallback to localhost if no local IP found
  return 'localhost';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');

    if (!tableId || isNaN(Number(tableId))) {
      return badRequest('Valid tableId is required');
    }

    const table = await prisma.restaurantTable.findUnique({
      where: { id: Number(tableId) },
    });

    if (!table) {
      return notFound('Table not found');
    }

    // Build a menu URL that matches how you're actually reaching the app.
    // If NEXT_PUBLIC_MENU_BASE_URL is set, always use that.
    // Otherwise, use LAN IP or current host **with port 3000**, since
    // you've confirmed `http://<LAN-IP>:3000/menu` works on phones.
    const requestUrl = new URL(req.url);
    const envBase = process.env.NEXT_PUBLIC_MENU_BASE_URL;

    let origin: string;
    if (envBase) {
      origin = envBase.replace(/\/+$/, '');
    } else {
      const originalHost = requestUrl.hostname;
      const protocol = requestUrl.protocol || 'http:';
      const originalPort = requestUrl.port || '3000';

      let hostForMenu = originalHost;
      if (originalHost === 'localhost' || originalHost === '127.0.0.1' || originalHost === '0.0.0.0') {
        // Auto-detect server's local IP for QR codes
        hostForMenu = getLocalIP();
      }

      const portPart = originalPort ? `:${originalPort}` : '';
      origin = `${protocol}//${hostForMenu}${portPart}`;
    }

    // Use the table's permanent slug in the QR link. The slug never changes when
    // a table is renamed, so printed stickers keep working after a rename. The
    // menu resolves the slug and falls back to the name for old stickers.
    const menuUrl = `${origin}/menu?table=${encodeURIComponent(table.slug)}`;

    const format = searchParams.get('format') || 'png';

    if (format === 'svg') {
      const svg = await QRCode.toString(menuUrl, {
        type: 'svg',
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      return new NextResponse(svg, {
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }

    // Default: return PNG as base64 data URL
    const dataUrl = await QRCode.toDataURL(menuUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return NextResponse.json({
      tableId: table.id,
      tableName: table.name,
      tableSlug: table.slug,
      menuUrl,
      qrDataUrl: dataUrl,
    });
  } catch (e) {
    return serverError(e);
  }
}
