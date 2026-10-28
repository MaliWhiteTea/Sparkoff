export const safeDraftFields = {
    announcement: ['title', 'body', 'type', 'placement', 'audience', 'is_published', 'is_pinned', 'requires_acknowledgement', 'starts_at', 'ends_at', 'role_ids'],
    inventoryItem: ['name', 'sku', 'category_id', 'location_id', 'item_type', 'unit', 'quantity', 'minimum_stock', 'public_visibility', 'description', 'is_active'],
    workshopHours: ['hours'],
    bookingRules: ['hours', 'values'],
    privacyRetention: ['appointmentRetentionMonths', 'fileRetentionDays', 'noticeVersion', 'isDraft'],
    printer: ['name', 'status', 'description'],
    newPrinter: ['code', 'name', 'status', 'description'],
    printerSchedule: ['printer_id', 'kind', 'is_all_day', 'starts_at', 'ends_at', 'reason'],
    filament: ['material', 'color', 'brand', 'diameter_mm', 'spool_weight_grams', 'nozzle_temp_min', 'nozzle_temp_max', 'bed_temp_min', 'bed_temp_max', 'technical_notes'],
} as const;
