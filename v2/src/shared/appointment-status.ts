export const appointmentTransitions: Record<string, readonly string[]> = {
  pending_approval: ['change_requested', 'approved', 'rejected'],
  change_requested: ['approved', 'rejected'],
  approved: ['ready'],
  ready: ['printing'],
  printing: ['completed', 'failed'],
  failed: ['ready'],
};

export const appointmentStatusLabels: Record<string, string> = {
  pending_verification: 'E-posta doğrulaması bekleniyor', pending_approval: 'Onay bekliyor',
  change_requested: 'Değişiklik istendi', approved: 'Onaylandı', ready: 'Baskıya hazır',
  printing: 'Basılıyor', completed: 'Tamamlandı', failed: 'Baskı başarısız',
  rejected: 'Reddedildi', canceled: 'İptal edildi', expired: 'Süresi doldu',
};

export const appointmentActionLabels: Record<string, string> = {
  change_requested: 'Değişiklik iste', approved: 'Onayla', rejected: 'Reddet',
  ready: 'Baskıya hazır', printing: 'Baskıyı başlat', completed: 'Tamamlandı', failed: 'Başarısız',
};

export const reviewStatuses = ['change_requested', 'approved', 'rejected'] as const;
export const managedStatuses = ['ready', 'printing', 'completed', 'failed'] as const;
