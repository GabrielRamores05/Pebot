import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { serverError } from '@/lib/api-response';

// Get log file path - same as electron main process
function getLogFilePath() {
  // In Electron packaged app, userData is in app.getPath('userData')
  // In development, we can use a local path
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    return join(process.cwd(), 'cafeos.log');
  }
  // For Electron, the log file is in userData
  const userData = process.env.APPDATA || process.env.HOME || process.cwd();
  return join(userData, 'cafeos', 'cafeos.log');
}

export async function GET() {
  try {
    const logPath = getLogFilePath();
    
    if (!existsSync(logPath)) {
      return NextResponse.json({ content: '', lines: 0 });
    }

    const content = readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim()).length;
    
    return NextResponse.json({ content, lines });
  } catch (error) {
    return serverError(error, 'Failed to read log');
  }
}

export async function DELETE() {
  try {
    const logPath = getLogFilePath();
    
    if (existsSync(logPath)) {
      writeFileSync(logPath, '');
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, 'Failed to clear log');
  }
}