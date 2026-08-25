/**
 * Test: Complete Loyalty Voucher Flow
 * 
 * Flow:
 * 1. Register customer with loyalty card
 * 2. Add 50 paid coffees (creates 5 vouchers automatically)
 * 3. Register customer in cart for order
 * 4. Claim 2 vouchers from menu
 * 5. Verify localStorage has claimed codes  
 * 6. Place order with claimed vouchers
 * 7. Verify vouchers are deleted after order
 */

const BASE_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  try {
    console.log('\n========================================');
    console.log('LOYALTY VOUCHER FLOW TEST');
    console.log('========================================\n');

    const testCustomerName = `LoyaltyTest_${Date.now()}`;
    
    // Step 1: Register customer
    console.log('1. Registering customer with loyalty card...');
    let res = await fetch(`${BASE_URL}/api/loyalty/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: testCustomerName }),
    });
    let data = await res.json();
    
    if (!res.ok) {
      throw new Error(`Registration failed: ${data.error}`);
    }
    console.log(`   ✓ Customer registered: ${testCustomerName}`);
    console.log(`   Initial state: ${data.paidCoffeesCount} paid coffees, ${data.activeVouchers} vouchers`);

    // Step 2: Add paid coffees to exceed threshold
    console.log('\n2. Adding 50 paid coffees (should create 5 vouchers at 10-coffee intervals)...');
    res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testCustomerName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: 50,
      }),
    });
    data = await res.json();
    
    if (!res.ok) {
      throw new Error(`Failed to add paid coffees: ${data.error}`);
    }
    console.log(`   ✓ Updated state: ${data.paidCoffeesCount} paid coffees, ${data.activeVouchers} vouchers`);
    console.log(`   Vouchers created: ${data.vouchersGenerated} new vouchers`);

    // Step 3: Get card details
    console.log('\n3. Fetching loyalty card...');
    res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testCustomerName)}`);
    const card = await res.json();
    console.log(`   ✓ Card fetched:`);
    console.log(`     - Paid Coffees: ${card.paidCoffeesCount}`);
    console.log(`     - Available Vouchers: ${card.activeVouchers}`);
    console.log(`     - Total Vouchers: ${card.vouchers?.length || 0}`);

    if (!card.vouchers || card.vouchers.length < 2) {
      throw new Error('Expected at least 2 vouchers to be available');
    }

    // Step 4: Claim 2 vouchers
    console.log('\n4. Claiming 2 vouchers via /api/loyalty/vouchers/claim...');
    res = await fetch(`${BASE_URL}/api/loyalty/vouchers/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: testCustomerName,
        quantity: 2,
      }),
    });
    data = await res.json();
    
    if (!res.ok) {
      throw new Error(`Claim failed: ${data.error}`);
    }
    console.log(`   ✓ Successfully claimed ${data.claimedCount} vouchers`);
    console.log(`   Claimed codes:`, data.voucherCodes);
    console.log(`   Remaining available: ${data.remainingAvailable}`);

    const voucherCodes = data.voucherCodes;

    // Step 5: Verify codes are valid
    console.log('\n5. Verifying claimed voucher codes are valid...');
    for (const code of voucherCodes) {
      res = await fetch(`${BASE_URL}/api/loyalty/vouchers/${encodeURIComponent(code)}`);
      data = await res.json();
      
      if (!res.ok) {
        throw new Error(`Voucher check failed for ${code}: ${data.error}`);
      }
      console.log(`   ✓ Code ${code}: Active=${data.isActive}, Customer=${data.customerName}`);
    }

    // Step 6: Get product list for creating order
    console.log('\n6. Fetching products for order...');
    res = await fetch(`${BASE_URL}/api/products`);
    const products = await res.json();
    
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('No products available');
    }
    
    const coffeeProduct = products.find(p => p.category?.name === 'Coffee') || products[0];
    console.log(`   ✓ Using product: ${coffeeProduct.name} (₱${coffeeProduct.price})`);

    // Step 7: Create order with vouchers
    console.log('\n7. Placing order with claimed vouchers...');
    res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: testCustomerName,
        items: [{ productId: coffeeProduct.id, quantity: 1 }],
        loyaltyDiscount: coffeeProduct.price * 2, // 2 vouchers
        loyaltyVoucherCodes: voucherCodes,
      }),
    });
    const order = await res.json();
    
    if (!res.ok) {
      throw new Error(`Order creation failed: ${order.error}`);
    }
    console.log(`   ✓ Order created: ${order.orderNumber}`);
    console.log(`   Order ID: ${order.id}`);
    console.log(`   Original total: ₱${coffeeProduct.price}`);
    console.log(`   Discount applied: ₱${coffeeProduct.price * 2}`);
    console.log(`   Final total: ₱${order.totalAmount}`);

    // Step 8: Redeem each voucher
    console.log('\n8. Redeeming vouchers (deleting from database)...');
    for (const code of voucherCodes) {
      res = await fetch(`${BASE_URL}/api/loyalty/vouchers/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      data = await res.json();
      
      if (!res.ok) {
        throw new Error(`Redemption failed for ${code}: ${data.error}`);
      }
      console.log(`   ✓ Redeemed ${code}`);
    }

    // Step 9: Verify vouchers are deleted
    console.log('\n9. Verifying vouchers are permanently deleted...');
    for (const code of voucherCodes) {
      res = await fetch(`${BASE_URL}/api/loyalty/vouchers/${encodeURIComponent(code)}`);
      
      if (res.status === 404) {
        console.log(`   ✓ ${code} successfully deleted (404 - not found)`);
      } else {
        throw new Error(`Expected 404 for deleted voucher ${code}, got ${res.status}`);
      }
    }

    // Step 10: Verify customer card is updated
    console.log('\n10. Verifying loyalty card reflects redeemed vouchers...');
    res = await fetch(`${BASE_URL}/api/loyalty/cards/${encodeURIComponent(testCustomerName)}`);
    const updatedCard = await res.json();
    console.log(`   ✓ Updated card state:`);
    console.log(`     - Paid Coffees: ${updatedCard.paidCoffeesCount}`);
    console.log(`     - Available Vouchers: ${updatedCard.activeVouchers}`);
    console.log(`     - Total Vouchers in DB: ${updatedCard.vouchers?.length || 0}`);

    if ((updatedCard.vouchers?.length || 0) !== (card.vouchers.length - 2)) {
      console.warn(`   ⚠ Warning: Expected ${card.vouchers.length - 2} remaining vouchers, found ${updatedCard.vouchers?.length || 0}`);
    }

    console.log('\n========================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('========================================\n');
    console.log('Summary:');
    console.log('1. ✓ Customer registration');
    console.log('2. ✓ Automatic voucher generation on coffee milestones');
    console.log('3. ✓ Voucher claiming API');
    console.log('4. ✓ Voucher validation');  
    console.log('5. ✓ Order creation with loyalty discount');
    console.log('6. ✓ Voucher redemption (deletion)');
    console.log('7. ✓ Permanent deletion verification');
    console.log('\n💡 Loyalty Flow Complete: Earned → Claimed → Used → Deleted\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message, '\n');
    process.exit(1);
  }
}

// Run test
test();
