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

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
