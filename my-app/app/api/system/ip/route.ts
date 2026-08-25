import { NextResponse } from 'next/server';
import os from 'os';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const ip = getLocalIP();
  const port = process.env.PORT || '3000';
  return NextResponse.json({ ip, origin: `http://${ip}:${port}` });
}
