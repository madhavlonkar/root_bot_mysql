export enum LedgerAction {
  PURCHASE = 'purchase',
  BOOST_ADD = 'boost_add',
  BOOST_REFUND = 'boost_refund',
  ADMIN_ADJ = 'admin_adj',
}

export enum PaymentGateway {
  RAZORPAY = 'razorpay',
  PAYPAL = 'paypal',
  STRIPE = 'stripe',
}

export enum PaymentStatus {
  CREATED = 'created',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
}
