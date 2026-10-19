export type OrderStatus =
  | 'Processing'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export interface MockOrder {
  orderId: string;
  customer: string;
  product: string;
  valueInr: number;
  status: OrderStatus;
  courier?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  delivered?: string;
  note?: string;
  isScenarioData: boolean;
}

export type OrderLookupResult =
  | {
      success: true;
      found: true;
      order: MockOrder;
    }
  | {
      success: false;
      found: false;
      code: 'NOT_FOUND';
      message: string;
    }
  | {
      success: false;
      found: false;
      code: 'INVALID_ORDER_ID';
      message: string;
    };
