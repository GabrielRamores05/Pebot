import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface CustomerTier {
  customerName: string;
  tier: 'VIP' | 'REGULAR' | 'CASUAL' | 'AT_RISK';
  lifetimeValue: number;
  totalOrders: number;
  averageOrderValue: number;
  vouchersIssued: number;
  vouchersRedeemed: number;
  coffeeProgress: number;
  coffeesClaimed: number;
  lastOrderDate: string | null;
  firstOrderDate: string;
  daysSinceLastOrder: number;
  visitFrequency: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface TierStats {
  vipCount: number;
  regularCount: number;
  casualCount: number;
  atRiskCount: number;
  totalCustomers: number;
  avgLifetimeValue: number;
  retentionRate: number;
  churnRate: number;
  tierDistribution: { name: string; value: number; count: number }[];
}

function getCustomerTier(
  lifetimeValue: number,
  totalOrders: number,
  daysSinceLastOrder: number,
  avgLifetimeValue: number,
): 'VIP' | 'REGULAR' | 'CASUAL' | 'AT_RISK' {
  // VIP: High lifetime value + recent visits
  if (lifetimeValue >= avgLifetimeValue * 2 && daysSinceLastOrder <= 30) {
    return 'VIP';
  }
  
  // At Risk: Hasn't visited in 60+ days
  if (daysSinceLastOrder > 60) {
    return 'AT_RISK';
  }
  
  // Regular: Consistent orderer with decent value
  if (totalOrders >= 5 && lifetimeValue >= avgLifetimeValue * 0.7) {
    return 'REGULAR';
  }
  
  // Casual: Lower frequency/value
  return 'CASUAL';
}

function getVisitFrequency(totalOrders: number, daysSinceFirstOrder: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (daysSinceFirstOrder === 0) return 'LOW';
  
  const ordersPerDay = totalOrders / daysSinceFirstOrder;
  
  // High: Multiple orders per week
  if (ordersPerDay >= 0.14) return 'HIGH';
  
  // Medium: At least weekly
  if (ordersPerDay >= 0.02) return 'MEDIUM';
  
  return 'LOW';
}

export async function GET(req: NextRequest) {
  try {
    // Fetch all loyalty cards with related data
    const loyaltyCards = await prisma.loyaltyCard.findMany({
      include: {
        vouchers: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch all orders
    const allOrders = await prisma.order.findMany({
      select: {
        id: true,
        customerName: true,
        totalAmount: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build customer data from loyalty cards first so members without orders still appear
    const customerMap = new Map<string, CustomerTier>();
    const now = new Date();

    loyaltyCards.forEach(card => {
      if (!customerMap.has(card.customerName)) {
        customerMap.set(card.customerName, {
          customerName: card.customerName,
          tier: 'CASUAL',
          lifetimeValue: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          vouchersIssued: 0,
          vouchersRedeemed: 0,
          coffeeProgress: 0,
          coffeesClaimed: 0,
          lastOrderDate: null,
          firstOrderDate: card.createdAt.toISOString(),
          daysSinceLastOrder: 0,
          visitFrequency: 'LOW',
        });
      }

      const customer = customerMap.get(card.customerName)!;
      customer.coffeeProgress = Math.max(customer.coffeeProgress, card.paidCoffeesCount);
      customer.vouchersIssued += card.vouchers.length;
      customer.vouchersRedeemed += card.vouchers.filter(v => v.status === 'REDEEMED').length;
      customer.coffeesClaimed += card.vouchers.filter(v => v.status === 'REDEEMED').length;

      if (new Date(customer.firstOrderDate) > new Date(card.createdAt)) {
        customer.firstOrderDate = card.createdAt.toISOString();
      }
    });

    allOrders.forEach(order => {
      if (!customerMap.has(order.customerName)) {
        customerMap.set(order.customerName, {
          customerName: order.customerName,
          tier: 'CASUAL',
          lifetimeValue: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          vouchersIssued: 0,
          vouchersRedeemed: 0,
          coffeeProgress: 0,
          coffeesClaimed: 0,
          lastOrderDate: null,
          firstOrderDate: order.createdAt.toISOString(),
          daysSinceLastOrder: 0,
          visitFrequency: 'LOW',
        });
      }

      const customer = customerMap.get(order.customerName)!;
      customer.lifetimeValue += order.totalAmount;
      customer.totalOrders += 1;

      if (!customer.lastOrderDate || new Date(order.createdAt) > new Date(customer.lastOrderDate)) {
        customer.lastOrderDate = order.createdAt.toISOString();
      }

      customer.daysSinceLastOrder = Math.floor(
        (now.getTime() - new Date(customer.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (order.createdAt < new Date(customer.firstOrderDate)) {
        customer.firstOrderDate = order.createdAt.toISOString();
      }
    });

    // Convert to array and calculate metrics
    const customers = Array.from(customerMap.values());
    
    customers.forEach(customer => {
      customer.averageOrderValue = customer.totalOrders > 0 
        ? customer.lifetimeValue / customer.totalOrders 
        : 0;
        
      const daysSinceFirst = Math.max(
        1,
        Math.floor((now.getTime() - new Date(customer.firstOrderDate).getTime()) / (1000 * 60 * 60 * 24))
      );
      
      customer.visitFrequency = getVisitFrequency(customer.totalOrders, daysSinceFirst);
    });

    const avgLifetimeValue = customers.length > 0
      ? customers.reduce((sum, c) => sum + c.lifetimeValue, 0) / customers.length
      : 0;

    // Assign tiers
    customers.forEach(customer => {
      customer.tier = getCustomerTier(
        customer.lifetimeValue,
        customer.totalOrders,
        customer.daysSinceLastOrder,
        avgLifetimeValue,
      );
    });

    // Calculate stats
    const vipCount = customers.filter(c => c.tier === 'VIP').length;
    const regularCount = customers.filter(c => c.tier === 'REGULAR').length;
    const casualCount = customers.filter(c => c.tier === 'CASUAL').length;
    const atRiskCount = customers.filter(c => c.tier === 'AT_RISK').length;
    
    // Active = not AT_RISK
    const activeCount = vipCount + regularCount + casualCount;
    const retentionRate = customers.length > 0 ? activeCount / customers.length : 0;
    const churnRate = customers.length > 0 ? atRiskCount / customers.length : 0;

    // Tier distribution with average lifetime value
    const tierMetrics = new Map<string, { count: number; totalValue: number }>();
    
    customers.forEach(c => {
      const key = c.tier;
      const existing = tierMetrics.get(key) || { count: 0, totalValue: 0 };
      existing.count += 1;
      existing.totalValue += c.lifetimeValue;
      tierMetrics.set(key, existing);
    });

    const tierDistribution = [
      {
        name: 'VIP',
        count: vipCount,
        value: vipCount > 0 ? tierMetrics.get('VIP')!.totalValue / vipCount : 0,
      },
      {
        name: 'Regular',
        count: regularCount,
        value: regularCount > 0 ? tierMetrics.get('REGULAR')!.totalValue / regularCount : 0,
      },
      {
        name: 'Casual',
        count: casualCount,
        value: casualCount > 0 ? tierMetrics.get('CASUAL')!.totalValue / casualCount : 0,
      },
      {
        name: 'At Risk',
        count: atRiskCount,
        value: atRiskCount > 0 ? tierMetrics.get('AT_RISK')!.totalValue / atRiskCount : 0,
      },
    ];

    const stats: TierStats = {
      vipCount,
      regularCount,
      casualCount,
      atRiskCount,
      totalCustomers: customers.length,
      avgLifetimeValue,
      retentionRate,
      churnRate,
      tierDistribution,
    };

    return NextResponse.json({
      customers: customers.sort((a, b) => b.lifetimeValue - a.lifetimeValue),
      stats,
    });
  } catch (e) {
    console.error('[CUSTOMER LOYALTY] Error:', e);
    return NextResponse.json({ error: 'Failed to fetch customer data' }, { status: 500 });
  }
}
