'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserMultiFormatReader } from '@zxing/library';

interface Table {
  id: number;
  name: string;
  capacity: number;
}

export default function ExitPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tableName, setTableName] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    // Get the table from localStorage (set when customer scanned entry QR)
    const storedTable = localStorage.getItem('cafe_current_table');
    if (storedTable) {
      setTableName(storedTable);
      // Auto-process exit
      processExit(storedTable);
    } else {
      setError('No active table found. Please scan your table\'s entry QR first.');
      setLoading(false);
    }
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, []);

  async function startScanner() {
    setShowScanner(true);
    setScanning(true);
    setError('');
    
    try {
      codeReaderRef.current = new BrowserMultiFormatReader();
      
      if (videoRef.current) {
        await codeReaderRef.current.decodeFromVideoDevice(
          null,
          videoRef.current,
          (result, error) => {
            if (result) {
              const scannedText = result.getText();
              // Check if it's a table QR code
              if (scannedText.includes('table=') || scannedText.includes('/menu')) {
                const url = new URL(scannedText);
                const tableParam = url.searchParams.get('table');
                if (tableParam) {
                  // Store the table and process exit
                  localStorage.setItem('cafe_current_table', tableParam);
                  setTableName(tableParam);
                  processExit(tableParam);
                } else {
                  setError('Invalid QR code. Please scan a table QR.');
                }
              } else {
                setError('Please scan a valid table QR code.');
              }
              // Stop scanning
              if (codeReaderRef.current) {
                codeReaderRef.current.reset();
              }
              setShowScanner(false);
              setScanning(false);
            }
          }
        );
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.');
      setScanning(false);
    }
  }

  function stopScanner() {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setShowScanner(false);
    setScanning(false);
  }

  async function processExit(tableToExit: string) {
    setExiting(true);
    setError('');
    setMessage('');

    try {
      // Find table by slug or name (QR links carry the slug)
      const res = await fetch('/api/tables');
      const tables: Table[] = await res.json();
      const foundTable = tables.find((t: any) => t.slug === tableToExit || t.name === tableToExit);
      
      if (!foundTable) {
        setError('Table not found');
        setExiting(false);
        return;
      }

      const exitRes = await fetch('/api/tables/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: foundTable.id })
      });

      const data = await exitRes.json();

      if (!exitRes.ok) {
        setError(data.error || 'Failed to process exit');
        setExiting(false);
        return;
      }

      // Clear the stored table
      localStorage.removeItem('cafe_current_table');
      // Clear the remembered visit so a fresh scan starts a fresh visit
      localStorage.removeItem('cafe_table_session_id');
      // Also clear mood data
      localStorage.removeItem('customerMood');
      localStorage.removeItem('customerMoodNote');
      
      setMessage(data.message || 'Thank you! Have a great day!');
      
      // Show success for 3 seconds then redirect to menu
      setTimeout(() => {
        router.push('/menu');
      }, 3000);

    } catch (err) {
      setError('Error processing exit');
      setExiting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-900 to-amber-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">👋</div>
          <h1 className="text-2xl font-bold text-white mb-2">Processing your exit...</h1>
          <div className="animate-spin w-8 h-8 border-4 border-amber-200 border-t-amber-400 rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-900 to-amber-800 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-white mb-2">Oops!</h1>
          <p className="text-amber-200 mb-6">{error}</p>
          
          {/* Scanner Button */}
          {!showScanner && (
            <button
              onClick={startScanner}
              className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-semibold mb-3 w-full flex items-center justify-center gap-2"
            >
              <span>📷</span> Scan QR to Exit
            </button>
          )}
          
          <button
            onClick={() => router.push('/menu')}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-semibold w-full"
          >
            Go to Menu
          </button>
        </div>
        
        {/* Scanner Modal */}
        {showScanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-gray-900 rounded-2xl p-4 max-w-sm w-full">
              <div className="relative">
                <video 
                  ref={videoRef} 
                  className="w-full rounded-xl"
                  autoPlay 
                  playsInline
                />
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/50 rounded-full p-4">
                      <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full"></div>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-white text-center mt-3 text-sm">
                Point your camera at the table QR code
              </p>
              <button
                onClick={stopScanner}
                className="mt-3 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-xl font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-900 to-amber-800 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        {exiting ? (
          <>
            <div className="text-6xl mb-4">👋</div>
            <h1 className="text-2xl font-bold text-white mb-2">Processing...</h1>
            <div className="animate-spin w-8 h-8 border-4 border-amber-200 border-t-amber-400 rounded-full mx-auto"></div>
          </>
        ) : message ? (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-white mb-2">You&apos;re All Set!</h1>
            <p className="text-amber-200 text-lg">{message}</p>
          </>
        ) : null}
        
        {/* Scanner Button - always available */}
        {!exiting && !message && (
          <button
            onClick={startScanner}
            className="mt-6 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-semibold w-full flex items-center justify-center gap-2"
          >
            <span>📷</span> Scan QR to Exit
          </button>
        )}
      </div>
      
      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-900 rounded-2xl p-4 max-w-sm w-full">
            <div className="relative">
              <video 
                ref={videoRef} 
                className="w-full rounded-xl"
                autoPlay 
                playsInline
              />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/50 rounded-full p-4">
                    <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full"></div>
                  </div>
                </div>
              )}
            </div>
            <p className="text-white text-center mt-3 text-sm">
              Point your camera at the table QR code
            </p>
            <button
              onClick={stopScanner}
              className="mt-3 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-xl font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
