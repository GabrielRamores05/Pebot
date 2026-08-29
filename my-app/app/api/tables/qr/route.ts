import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import os from 'os';
import { badRequest, notFound, serverError } from '@/lib/api-response';
import { findTableUnique } from '@/modules/tables/repository';

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        if (info.address.startsWith('192.168.') || info.address.startsWith('10.') || info.address.startsWith('172.')) {
          return info.address;
        }
      }
    }
  }
  return 'localhost';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');

    if (!tableId || isNaN(Number(tableId))) {
      return badRequest('Valid tableId is required');
    }

    const table = await findTableUnique(Number(tableId));

    if (!table) {
      return notFound('Table not found');
    }

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
        hostForMenu = getLocalIP();
      }

      const portPart = originalPort ? `:${originalPort}` : '';
      origin = `${protocol}//${hostForMenu}${portPart}`;
    }

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
