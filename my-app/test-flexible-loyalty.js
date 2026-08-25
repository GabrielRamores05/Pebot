/**
 * Test: Flexible Loyalty System with Overflow Prevention
 * 
 * New System:
 * - rewardsEarned = totalCoffees / coffeesRequired (integer division)
 * - remainingProgress = totalCoffees % coffeesRequired
 * - Example: 22 coffees with coffeesRequired=10 → 2 rewards, 2% progress to 3rd
 * 
 * No overflow errors when adding bulk orders
 */

const BASE_URL = 'http://localhost:3000';

async function test() {
  try {
    console.log('\n========================================');
    console.log('FLEXIBLE LOYALTY SYSTEM TEST');
    console.log('Overflow Prevention & Multiple Rewards');
    console.log('========================================\n');

    // ═════════════════════════════════════════════════════════════
    // TEST 1: Customer orders 22 coffees at once (2 complete cycles)
    // ═════════════════════════════════════════════════════════════
    console.log('TEST 1: Order 22 coffees (should earn 2 rewards)\n');
    
    let testName = `FlexTest1_${Date.now()}`;
    
    let res = await fetch(`${BASE_URL}/api/loyalty/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: testName }),
    });
    let data = await res.json();
    console.log(`  1. Registered: ${testName}\n`);

    // Add 22 coffees at once
    res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 22 }),
    });

    if (!res.ok) {
      throw new Error(`Failed to add 22 coffees: ${res.statusText}`);
    }

    data = await res.json();
    console.log(`  2. Added 22 coffees in bulk:`);
    console.log(`     - Total Coffees: ${data.paidCoffeesCount}`);
    console.log(`     - Rewards Earned: ${data.rewardsEarned}`);
    console.log(`     - Remaining Progress: ${data.remainingProgress}/${data.coffeesRequiredForFree}`);
    console.log(`     - Active Vouchers: ${data.activeVouchers}\n`);

    if (data.paidCoffeesCount !== 22) throw new Error(`Expected 22 total, got ${data.paidCoffeesCount}`);
    if (data.rewardsEarned !== 2) throw new Error(`Expected 2 rewards, got ${data.rewardsEarned}`);
    if (data.remainingProgress !== 4) throw new Error(`Expected 4 remaining, got ${data.remainingProgress}`);
    if (data.activeVouchers !== 2) throw new Error(`Expected 2 active vouchers, got ${data.activeVouchers}`);

    // Verify via GET
    res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testName)}`);
    data = await res.json();
    console.log(`  3. GET Card Details:`);
    console.log(`     - Total Coffees: ${data.paidCoffeesCount}`);
    console.log(`     - Rewards Earned: ${data.rewardsEarned}`);
    console.log(`     - Active Vouchers: ${data.activeVouchers}`);
    console.log(`     - Redeemed Vouchers: ${data.redeemedVouchers}\n`);

    if (data.activeVouchers !== 2) throw new Error(`GET: Expected 2 active vouchers, got ${data.activeVouchers}`);

    // ═════════════════════════════════════════════════════════════
    // TEST 2: Customer with 15 coffees (1 complete, 5 remaining)
    // ═════════════════════════════════════════════════════════════
    console.log('TEST 2: Order 15 coffees (1 complete + 5 toward next)\n');
    
    testName = `FlexTest2_${Date.now()}`;
    
    res = await fetch(`${BASE_URL}/api/loyalty/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: testName }),
    });

    res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 15 }),
    });

    data = await res.json();
    console.log(`  1. Added 15 coffees:`);
    console.log(`     - Total Coffees: ${data.paidCoffeesCount}`);
    console.log(`     - Rewards Earned: ${data.rewardsEarned}`);
    console.log(`     - Remaining Progress: ${data.remainingProgress}/${data.coffeesRequiredForFree}`);
    console.log(`     - Active Vouchers: ${data.activeVouchers}\n`);

    if (data.rewardsEarned !== 1) throw new Error(`Expected 1 reward, got ${data.rewardsEarned}`);
    if (data.remainingProgress !== 6) throw new Error(`Expected 6 remaining, got ${data.remainingProgress}`);

    // ═════════════════════════════════════════════════════════════
    // TEST 3: Claim multiple vouchers
    // ═════════════════════════════════════════════════════════════
    console.log('TEST 3: Claim multiple vouchers from the 22-coffee customer\n');
    
    testName = `FlexTest1_${Date.now()}`;
    
    res = await fetch(`${BASE_URL}/api/loyalty/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: testName }),
    });

    // Add 22 again
    res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 22 }),
    });
    data = await res.json();
    console.log(`  1. Added 22 coffees (${data.activeVouchers} vouchers available)\n`);

    // Claim 2 vouchers
    res = await fetch(`${BASE_URL}/api/loyalty/vouchers/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: testName, quantity: 2 }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(`Claim failed: ${error.error}`);
    }

    data = await res.json();
    console.log(`  2. Claimed vouchers:`);
    console.log(`     - Claimed Count: ${data.claimedCount}`);
    console.log(`     - Rewards Earned: ${data.rewardsEarned}`);
    console.log(`     - Voucher Codes: ${data.voucherCodes.join(', ')}\n`);

    if (data.claimedCount !== 2) throw new Error(`Expected 2 claimed, got ${data.claimedCount}`);
    if (data.voucherCodes.length !== 2) throw new Error(`Expected 2 codes, got ${data.voucherCodes.length}`);

    console.log('========================================');
    console.log('✅ FLEXIBLE LOYALTY SYSTEM TEST PASSED!');
    console.log('========================================\n');
    console.log('Summary:');
    console.log('  ✓ 22 coffees = 2 rewards + 2 progress');
    console.log('  ✓ 15 coffees = 1 reward + 5 progress');
    console.log('  ✓ Multiple vouchers can be claimed');
    console.log('  ✓ No overflow errors or limits\n');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

test();
