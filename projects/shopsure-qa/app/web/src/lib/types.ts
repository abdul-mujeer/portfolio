export interface User {
  id: number;
  email: string;
  name: string;
  role: "CUSTOMER" | "ADMIN";
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  image: string;
  active: number;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface CartItem {
  id: number;
  quantity: number;
  productId: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  lineTotal: number;
}

export interface CartPayload {
  items: CartItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderEvent {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  actorId: number | null;
  createdAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELED";
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostcode: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  items: OrderItem[];
  events: OrderEvent[];
}

export interface OrderSummary {
  id: number;
  orderNumber: string;
  status: Order["status"];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  createdAt: string;
  itemCount: number;
  unitCount: number;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminOrderRow {
  id: number;
  orderNumber: string;
  status: Order["status"];
  total: number;
  createdAt: string;
  customerEmail: string;
  customerName: string;
  itemCount: number;
}

export interface AdminProductRow {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  active: number;
  categoryId: number;
  categoryName: string;
}
