/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Project {
  id: string;
  country: string;
  province: string;
  address: string;
  ownerName: string;
  monthlyCost: number;
  depositAmount: number;
  firstPaymentDate: string;
  contractSigningDate: string;
  contractEndDate: string;
  ownerPhone: string;
  photos: string[]; // Store URLs/base64 for demo
  createdAt: string;
  folio: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

export interface PaymentInstallment {
  id: string;
  ProjectId: string;
  dueDate: string;
  amount: number;
  status: PaymentStatus;
  paymentDate?: string;
  receiptDate?: string;
  paymentMethod?: 'cash' | 'transfer' | 'deposit';
  concept?: string;
  observations?: string;
  receiptPhotos?: string[];
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}
