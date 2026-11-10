// Re-export payment notification hooks for backward compatibility
export {
  usePaymentNotifications,
  useApprovePaymentNotification as useApproveNotification,
  useRejectPaymentNotification as useRejectNotification,
} from './usePayments';
