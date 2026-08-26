
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  password: 'password',
  role: 'role',
  active: 'active',
  permissions: 'permissions',
  subscriptionId: 'subscriptionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubscriptionScalarFieldEnum = {
  id: 'id',
  tier: 'tier',
  features: 'features',
  price: 'price',
  billingCycle: 'billingCycle',
  startDate: 'startDate',
  endDate: 'endDate',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.POSLicenseScalarFieldEnum = {
  id: 'id',
  licenseKey: 'licenseKey',
  isActivated: 'isActivated',
  activatedAt: 'activatedAt',
  activatedBy: 'activatedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  icon: 'icon',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  price: 'price',
  imageUrl: 'imageUrl',
  available: 'available',
  prepTimeMinutes: 'prepTimeMinutes',
  stationType: 'stationType',
  categoryId: 'categoryId',
  capitalCost: 'capitalCost',
  marginType: 'marginType',
  marginValue: 'marginValue',
  vatExempt: 'vatExempt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReviewScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  customerName: 'customerName',
  rating: 'rating',
  comment: 'comment',
  tasteSuggestion: 'tasteSuggestion',
  imageUrl: 'imageUrl',
  createdAt: 'createdAt'
};

exports.Prisma.IngredientScalarFieldEnum = {
  id: 'id',
  name: 'name',
  category: 'category',
  baseUnit: 'baseUnit',
  purchaseUnit: 'purchaseUnit',
  currentStock: 'currentStock',
  minStock: 'minStock',
  costPerUnit: 'costPerUnit',
  supplierId: 'supplierId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.IngredientTransactionScalarFieldEnum = {
  id: 'id',
  ingredientId: 'ingredientId',
  type: 'type',
  quantity: 'quantity',
  purchaseCost: 'purchaseCost',
  unitCost: 'unitCost',
  purchaseUnit: 'purchaseUnit',
  referenceId: 'referenceId',
  referenceType: 'referenceType',
  notes: 'notes',
  userId: 'userId',
  createdAt: 'createdAt'
};

exports.Prisma.SupplierScalarFieldEnum = {
  id: 'id',
  name: 'name',
  contactPerson: 'contactPerson',
  phone: 'phone',
  email: 'email',
  address: 'address',
  notes: 'notes',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductIngredientScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  ingredientId: 'ingredientId',
  quantity: 'quantity',
  required: 'required',
  createdAt: 'createdAt'
};

exports.Prisma.RestaurantTableScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  capacity: 'capacity',
  status: 'status',
  assignedOrderId: 'assignedOrderId',
  section: 'section',
  positionX: 'positionX',
  positionY: 'positionY',
  occupiedSince: 'occupiedSince',
  currentOccupants: 'currentOccupants',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TableSessionScalarFieldEnum = {
  id: 'id',
  tableId: 'tableId',
  occupants: 'occupants',
  entryTime: 'entryTime',
  exitTime: 'exitTime',
  dwellMinutes: 'dwellMinutes',
  createdAt: 'createdAt'
};

exports.Prisma.OrderScalarFieldEnum = {
  id: 'id',
  orderNumber: 'orderNumber',
  customerName: 'customerName',
  loyaltyCustomerName: 'loyaltyCustomerName',
  tableId: 'tableId',
  status: 'status',
  totalAmount: 'totalAmount',
  barcodeValue: 'barcodeValue',
  notes: 'notes',
  loyaltyPromo: 'loyaltyPromo',
  paymentMethod: 'paymentMethod',
  paymentScreenshot: 'paymentScreenshot',
  queueNumber: 'queueNumber',
  orderType: 'orderType',
  deliveryAddress: 'deliveryAddress',
  sessionId: 'sessionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderItemScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  productId: 'productId',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  subtotal: 'subtotal',
  notes: 'notes',
  selections: 'selections'
};

exports.Prisma.OptionGroupScalarFieldEnum = {
  id: 'id',
  name: 'name',
  selectionType: 'selectionType',
  scalesRecipe: 'scalesRecipe',
  sortOrder: 'sortOrder',
  available: 'available',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OptionScalarFieldEnum = {
  id: 'id',
  groupId: 'groupId',
  name: 'name',
  priceDelta: 'priceDelta',
  sizeMultiplier: 'sizeMultiplier',
  sortOrder: 'sortOrder',
  available: 'available',
  createdAt: 'createdAt'
};

exports.Prisma.ProductOptionGroupScalarFieldEnum = {
  productId: 'productId',
  groupId: 'groupId',
  sortOrder: 'sortOrder'
};

exports.Prisma.OrderMessageScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  type: 'type',
  content: 'content',
  sender: 'sender',
  createdAt: 'createdAt'
};

exports.Prisma.InventoryScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  quantity: 'quantity',
  lowStockThreshold: 'lowStockThreshold',
  unit: 'unit',
  updatedAt: 'updatedAt'
};

exports.Prisma.SettingScalarFieldEnum = {
  key: 'key',
  value: 'value',
  updatedAt: 'updatedAt'
};

exports.Prisma.BusinessSettingsScalarFieldEnum = {
  id: 'id',
  businessName: 'businessName',
  businessAddress: 'businessAddress',
  tin: 'tin',
  branchCode: 'branchCode',
  vatRate: 'vatRate',
  receiptSerialPrefix: 'receiptSerialPrefix',
  lastReceiptNumber: 'lastReceiptNumber',
  footerMessage: 'footerMessage',
  loyaltyEnabled: 'loyaltyEnabled',
  gcashAccountName: 'gcashAccountName',
  gcashQrImage: 'gcashQrImage',
  paymayaAccountName: 'paymayaAccountName',
  paymayaQrImage: 'paymayaQrImage',
  aiApiKey: 'aiApiKey',
  aiModel: 'aiModel',
  aiSystemPrompt: 'aiSystemPrompt',
  aiFolderAccess: 'aiFolderAccess',
  aiReadBirPricing: 'aiReadBirPricing',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LoyaltySettingScalarFieldEnum = {
  id: 'id',
  categoryId: 'categoryId',
  coffeesRequiredForFree: 'coffeesRequiredForFree',
  enabled: 'enabled',
  cardColor: 'cardColor',
  cardTitle: 'cardTitle',
  cardDescription: 'cardDescription',
  rewardType: 'rewardType',
  rewardValue: 'rewardValue',
  isMilestoneMode: 'isMilestoneMode',
  milestones: 'milestones',
  updated: 'updated'
};

exports.Prisma.LoyaltyCardScalarFieldEnum = {
  id: 'id',
  customerName: 'customerName',
  membershipCode: 'membershipCode',
  memberSince: 'memberSince',
  categoryId: 'categoryId',
  paidCoffeesCount: 'paidCoffeesCount',
  loyaltyPoints: 'loyaltyPoints',
  claimedMilestones: 'claimedMilestones',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LoyaltyTransactionScalarFieldEnum = {
  id: 'id',
  cardId: 'cardId',
  orderId: 'orderId',
  type: 'type',
  points: 'points',
  description: 'description',
  createdAt: 'createdAt'
};

exports.Prisma.LoyaltyVoucherScalarFieldEnum = {
  id: 'id',
  code: 'code',
  customerName: 'customerName',
  cardId: 'cardId',
  discountType: 'discountType',
  discountValue: 'discountValue',
  rewardName: 'rewardName',
  minPurchase: 'minPurchase',
  maxRedemptions: 'maxRedemptions',
  usedCount: 'usedCount',
  validDays: 'validDays',
  targetType: 'targetType',
  targetCategoryId: 'targetCategoryId',
  targetProductId: 'targetProductId',
  status: 'status',
  issuedDate: 'issuedDate',
  expiryDate: 'expiryDate',
  redeemedDate: 'redeemedDate',
  redeemedOrderId: 'redeemedOrderId',
  updatedAt: 'updatedAt'
};

exports.Prisma.RewardHistoryScalarFieldEnum = {
  id: 'id',
  customerName: 'customerName',
  action: 'action',
  rewardCount: 'rewardCount',
  rewardType: 'rewardType',
  voucherCode: 'voucherCode',
  orderId: 'orderId',
  notes: 'notes',
  createdAt: 'createdAt'
};

exports.Prisma.PaymentTransactionScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  amount: 'amount',
  method: 'method',
  status: 'status',
  referenceNo: 'referenceNo',
  terminalId: 'terminalId',
  processedAt: 'processedAt',
  createdAt: 'createdAt'
};

exports.Prisma.TableGuestScalarFieldEnum = {
  id: 'id',
  tableId: 'tableId',
  sessionId: 'sessionId',
  displayName: 'displayName',
  moodEmoji: 'moodEmoji',
  moodNote: 'moodNote',
  active: 'active',
  exitedAt: 'exitedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffStationControlScalarFieldEnum = {
  id: 'id',
  stationType: 'stationType',
  emoji: 'emoji',
  staffCount: 'staffCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  action: 'action',
  resource: 'resource',
  resourceId: 'resourceId',
  details: 'details',
  ip: 'ip',
  createdAt: 'createdAt'
};

exports.Prisma.AIConversationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AIMessageScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  role: 'role',
  content: 'content',
  createdAt: 'createdAt'
};

exports.Prisma.ExpenseCategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ExpenseScalarFieldEnum = {
  id: 'id',
  categoryId: 'categoryId',
  userId: 'userId',
  supplierId: 'supplierId',
  amount: 'amount',
  description: 'description',
  expenseDate: 'expenseDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  User: 'User',
  Subscription: 'Subscription',
  POSLicense: 'POSLicense',
  Category: 'Category',
  Product: 'Product',
  Review: 'Review',
  Ingredient: 'Ingredient',
  IngredientTransaction: 'IngredientTransaction',
  Supplier: 'Supplier',
  ProductIngredient: 'ProductIngredient',
  RestaurantTable: 'RestaurantTable',
  TableSession: 'TableSession',
  Order: 'Order',
  OrderItem: 'OrderItem',
  OptionGroup: 'OptionGroup',
  Option: 'Option',
  ProductOptionGroup: 'ProductOptionGroup',
  OrderMessage: 'OrderMessage',
  Inventory: 'Inventory',
  Setting: 'Setting',
  BusinessSettings: 'BusinessSettings',
  LoyaltySetting: 'LoyaltySetting',
  LoyaltyCard: 'LoyaltyCard',
  LoyaltyTransaction: 'LoyaltyTransaction',
  LoyaltyVoucher: 'LoyaltyVoucher',
  RewardHistory: 'RewardHistory',
  PaymentTransaction: 'PaymentTransaction',
  TableGuest: 'TableGuest',
  StaffStationControl: 'StaffStationControl',
  AuditLog: 'AuditLog',
  AIConversation: 'AIConversation',
  AIMessage: 'AIMessage',
  ExpenseCategory: 'ExpenseCategory',
  Expense: 'Expense'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
