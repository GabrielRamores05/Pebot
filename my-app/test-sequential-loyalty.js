/**
 * Test: Sequential Loyalty System (0-9 Cycle with Locking)
 * 
 * Requirements:
 * 1. Progress counts 0-9
 * 2. At 9, voucher auto-generates and progress LOCKS
 * 3. Cannot add more coffees while locked
 * 4. After claiming, progress resets to 0 and unlocks
 * 5. Can add more coffees after reset
 */

const BASE_URL = 'http://localhost:3000';

async function test() {
  try {
    console.log('\n========================================');
    console.log('SEQUENTIAL LOYALTY SYSTEM TEST');
    console.log('Progress 0-9 with Locking');
    console.log('========================================\n');

    // ═════════════════════════════════════════════════════════════
    // TEST 1: Add coffees one by one until reaching 9
    // ═════════════════════════════════════════════════════════════
    console.log('TEST 1: Add coffees 1-9 (progress should count 0-9)\n');
    
    let testName = `SeqTest1_${Date.now()}`;
    
    // Register customer
    let res = await fetch(`${BASE_URL}/api/loyalty/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: testName }),
    });
    let data = await res.json();
    console.log(`  Registered: ${testName}\n`);

    // Add coffees one at a time and track progress
    for (let i = 1; i <= 9; i++) {
      res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        console.log(`  ✗ Coffee ${i}: ERROR - ${err.error}`);
        break;
      }
      
      data = await res.json();
      console.log(`  ✓ Coffee ${i}: Progress ${data.progress}/${data.coffeesRequiredForFree}, Locked: ${data.isProgressLocked}, HasVoucher: ${data.hasUnclaimedVoucher}`);
      
      if (i === 9) {
        if (data.progress !== 9) throw new Error(`Expected progress 9, got ${data.progress}`);
        if (!data.hasUnclaimedVoucher) throw new Error('Expected voucher to be generated at 9');
        if (!data.isProgressLocked) throw new Error('Expected progress to be locked');
        console.log(`  ✓ At 9: Voucher auto-generated and progress locked\n`);
      }
    }

    // ═════════════════════════════════════════════════════════════
    // TEST 2: Try to add coffee while locked (should fail)
    // ═════════════════════════════════════════════════════════════
    console.log('TEST 2: Try to add coffee while locked (should fail)\n');
    
    res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    });
    
    if (res.ok) {
      throw new Error('Should have failed to add coffee while locked');
    }
    
    data = await res.json();
    console.log(`  ✓ Addition blocked: "${data.error}"\n`);

    // ═════════════════════════════════════════════════════════════
    // TEST 3: Claim the voucher
    // ═════════════════════════════════════════════════════════════
    console.log('TEST 3: Claim the free coffee\n');
    
    res = await fetch(`${BASE_URL}/api/loyalty/vouchers/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: testName }),
    });
    
    if (!res.ok) {
      throw new Error('Failed to claim voucher');
    }
    
    data = await res.json();
    const claimedCode = data.voucherCode;
    console.log(`  ✓ Voucher claimed: ${claimedCode}`);
    console.log(`  ✓ Progress reset to: ${data.newProgress}\n`);

    if (data.newProgress !== 0) throw new Error(`Expected progress to reset to 0, got ${data.newProgress}`);

    // ═════════════════════════════════════════════════════════════
    // TEST 4: Verify progress is unlocked (back to 0)
    // ═════════════════════════════════════════════════════════════
    console.log('TEST 4: Verify progress is unlocked and reset\n');
    
    res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testName)}`);
    data = await res.json();
    
    console.log(`  ✓ Card state: Progress ${data.progress}/${data.coffeesRequiredForFree}, Locked: ${data.isProgressLocked}, HasVoucher: ${data.hasUnclaimedVoucher}\n`);
    
    if (data.progress !== 0) throw new Error(`Expected progress 0, got ${data.progress}`);
    if (data.isProgressLocked) throw new Error('Progress should be unlocked');
    if (data.hasUnclaimedVoucher) throw new Error('Should not have unclaimed voucher');

    // ═════════════════════════════════════════════════════════════
    // TEST 5: Add coffee again after reset (should work)
    // ═════════════════════════════════════════════════════════════
    console.log('TEST 5: Add coffee after reset and unlock\n');
    
    res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    });
    
    if (!res.ok) {
      throw new Error('Failed to add coffee after reset');
    }
    
    data = await res.json();
    console.log(`  ✓ Added 1 coffee after reset`);
    console.log(`  ✓ Progress: ${data.progress}/${data.coffeesRequiredForFree}, Locked: ${data.isProgressLocked}\n`);
    
    if (data.progress !== 1) throw new Error(`Expected progress 1, got ${data.progress}`);

    // ═════════════════════════════════════════════════════════════
    // TEST 6: Full cycle - add 9 more coffees to lock again
    // ═════════════════════════════════════════════════════════════
    console.log('TEST 6: Complete second cycle (add 8 more to reach 9)\n');
    
    for (let i = 0; i < 8; i++) {
      res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to add coffee ${i + 2}`);
      }
      data = await res.json();
    }
    
    console.log(`  ✓ Added 8 more coffees`);
    console.log(`  ✓ Final progress: ${data.progress}/${data.coffeesRequiredForFree}, Locked: ${data.isProgressLocked}, HasVoucher: ${data.hasUnclaimedVoucher}\n`);
    
    if (data.progress !== 9) throw new Error(`Expected progress 9, got ${data.progress}`);
    if (!data.isProgressLocked) throw new Error('Should be locked at 9 again');
    if (!data.hasUnclaimedVoucher) throw new Error('Should have new voucher');

    console.log('========================================');
    console.log('✅ SEQUENTIAL LOYALTY SYSTEM TEST PASSED!');
    console.log('========================================');
    console.log('\nResults:');
    console.log('  ✓ Progress counts 0-9');
    console.log('  ✓ Voucher auto-generates at 9');
    console.log('  ✓ Progress locks and cannot add more');
    console.log('  ✓ After claiming, progress resets to 0');
    console.log('  ✓ Can add more coffees after reset');
    console.log('  ✓ Can reach 9 again for another cycle');
    console.log('');

  } catch (e) {
    console.error('\n❌ TEST FAILED:', e.message);
    process.exit(1);
  }
}

test();
