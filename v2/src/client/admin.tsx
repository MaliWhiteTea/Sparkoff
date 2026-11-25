import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from './api';
import { Badge, Button, Card, Empty, MemberCard, Modal, Screen, Sheet, formatQuantity, taskStatusLabel } from './ui/kit';
import { importFieldLabels, importFields, type ImportField, type ImportMapping } from '../shared/inventory-import';
import { PERMISSIONS, TABS, type Permission, type Tab } from '../shared/access';
import { appointmentActionLabels, appointmentStatusLabels, appointmentTransitions, reviewStatuses } from '../shared/appointment-status';
import { SavedFilters } from './saved-filters';
import { useTableColumns } from './table-columns';

const inventoryColumns = [{ key: 'name', label: 'Malzeme adı' }, { key: 'brand', label: 'Marka' }, { key: 'model', label: 'Model' }, { key: 'category', label: 'Kategori' }, { key: 'location', label: 'Konum' }, { key: 'quantity', label: 'Stok miktarı' }, { key: 'visibility', label: 'Katalog görünürlüğü' }];
const loanColumns = [{ key: 'item', label: 'Malzeme' }, { key: 'recipient', label: 'Teslim alan' }, { key: 'quantity', label: 'Miktar' }, { key: 'issued_at', label: 'Teslim zamanı' }, { key: 'due_at', label: 'Beklenen iade' }, { key: 'status', label: 'Durum' }];
const appointmentColumns = [{ key: 'applicant', label: 'Başvuru sahibi' }, { key: 'starts_at', label: 'Başlangıç' }, { key: 'duration', label: 'Süre' }, { key: 'printer', label: 'Yazıcı' }, { key: 'status', label: 'Durum' }];
const feedbackColumns = [{ key: 'type', label: 'Bildirim türü' }, { key: 'message', label: 'Mesaj' }, { key: 'status', label: 'Durum' }, { key: 'created_at', label: 'Gönderim zamanı' }, { key: 'handler', label: 'İşlem yapan' }];
const userColumns = [{ key: 'name', label: 'Ad soyad' }, { key: 'email', label: 'E-posta' }, { key: 'roles', label: 'Roller' }, { key: 'status', label: 'Hesap durumu' }];

const tabLabels: Record<Tab, string> = { home: 'Ana sayfa', tasks: 'Görevler', chat: 'Sohbet', announcements: 'Duyurular', events: 'Etkinlikler', inventory: 'Envanter', members: 'Üyeler', board: 'Yönetim' };
const permissionLabels: Record<Permission, string> = {
  chat_write: 'Sohbete yaz', chat_files: 'Sohbet dosyalarını kullan', polls: 'Anketleri kullan', download: 'Dosya indir', announce_post: 'Eski V2 duyuru izni', announcements_view: 'Kamu duyurularını yönetimde gör', announcements_create: 'Kamu duyurusu oluştur', announcements_update: 'Kamu duyurusunu düzenle', announcements_archive: 'Kamu duyurusunu kaldır', staff_announcements_view: 'Yönetim duyurularını gör', staff_announcements_create: 'Yönetim duyurusu oluştur', staff_announcements_update: 'Yönetim duyurusunu düzenle', staff_announcements_archive: 'Yönetim duyurusunu kaldır', events_create: 'Etkinlik oluştur',
  inventory_view: 'Envanteri gör', inventory_view_movements: 'Stok hareketlerini gör', inventory_import: 'Envanter içe aktar', inventory_export: 'Envanter dışa aktar', inventory_create: 'Malzeme oluştur', inventory_update: 'Malzeme düzenle', inventory_change_item_type: 'Malzeme türünü değiştir', inventory_archive: 'Malzemeyi arşivle', inventory_adjust_stock: 'Stok düzelt', inventory_manage_categories: 'Kategorileri yönet', inventory_manage_locations: 'Konumları yönet', inventory_manage_media: 'Malzeme medyasını yönet',
  loans_view: 'Teslimleri gör', loans_create: 'Teslim oluştur', loans_receive_return: 'İade al', loans_extend_due_date: 'İade tarihini uzat', loans_export: 'Teslimleri dışa aktar', loans_view_personal_data: 'Teslim alanın adını ve notlarını gör', loans_view_email: 'Teslim alanın e-postasını gör', loans_report_damage: 'Hasar bildir', loans_report_lost: 'Kayıp bildir', loans_reverse_transaction: 'Teslimi geri al',
  printers_view: 'Yazıcıları yönetim ekranında gör', printers_create: 'Yazıcı oluştur', printers_update: 'Yazıcı bilgilerini düzenle', printers_change_status: 'Yazıcı durumunu değiştir', printers_manage_schedule: 'Yazıcı takvimini yönet', printers_manage_hours: 'Çalışma saatlerini yönet', printers_manage_filaments: 'Filamentleri yönet', appointments_view: 'Randevuları gör', appointments_review: 'Randevuyu incele', appointments_manage_status: 'Baskı durumunu yönet', appointments_download_file: 'Özel model dosyasını indir', appointments_export: 'Randevuları dışa aktar', appointments_view_personal_data: 'Randevu sahibi bilgilerini gör', feedback_view: 'Geri bildirimleri gör', feedback_update: 'Geri bildirim durumunu ve notunu güncelle',
  users_view: 'Kullanıcıları gör', users_create: 'Kullanıcı oluştur', users_update: 'Kullanıcı bilgilerini düzenle', users_disable: 'Hesabı pasifleştir veya etkinleştir', users_reset_password: 'Kullanıcı parolasını sıfırla', roles_view: 'Rolleri ve izinleri gör', roles_create: 'Rol oluştur', roles_update: 'Rolü düzenle', roles_delete: 'Kullanılmayan rolü sil', roles_assign: 'Kullanıcıya rol ata', units_manage: 'Birim oluştur ve üyelik yönet', audit_logs_view: 'İşlem geçmişini gör', privacy_settings_update: 'KVKK ve saklama ayarlarını düzenle', workshop_settings_update: 'Atölye ve iletişim ayarlarını düzenle', system_settings_update: 'Randevu kurallarını düzenle',
  general: 'Genel kanala eriş', view_pii: 'Kişi bilgilerini gör', download_models: 'Model dosyalarını indir',
};

type Unit = { id: number; name: string; isRoom?: boolean };
type InventoryMaterial = { id: number; name: string; kind: string; quantity: string; availableQuantity: string; unit: string; sku: string | null; brand: string | null; model: string | null; description: string | null; minimumStock: string | null; publicVisibility: string; categoryId: number | null; locationId: number | null; isActive: boolean; archivedAt: string | null; updatedAt: string };
type InventoryCategory = { id: number; name: string; description: string | null; isActive: boolean };
type InventoryLocation = { id: number; name: string; code: string | null; description: string | null; isPublic: boolean; isActive: boolean };
type InventoryLoan = { id: number; materialId: number; quantity: string; returnedQuantity: string; status: string; itemType: string | null; borrowerFirstName: string | null; borrowerLastName: string | null; borrowerNameOriginal: string | null; dueAt: string | null; issuedAt: string | null; closedAt: string | null; anonymizedAt: string | null; notes: string | null; closureNote: string | null };
function useLoad<T>(path: string, enabled = true) {
  const [result, setResult] = useState<{ path: string; data: T | null }>({ path, data: null });
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const reload = () => {
    if (!enabled) return;
    const current = ++requestId.current;
    api<T>(path).then(data => {
      if (current === requestId.current) { setResult({ path, data }); setError(''); }
    }).catch(cause => {
      if (current === requestId.current) setError((cause as Error).message);
    });
  };
  useEffect(() => { setError(''); reload(); return () => { requestId.current++; }; }, [path, enabled]);
  return { data: result.path === path ? result.data : null, error, reload };
}
function ErrorLine({ error }: { error: string }) { return error ? <p role="alert" className="form-error">{error}</p> : null; }
async function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}

export function AdminTasks({ manageableUnitIds }: { manageableUnitIds: number[] }) {
  const canCreate = manageableUnitIds.length > 0;
  const tasks = useLoad<{ tasks: { id: number; title: string; status: string; progress: number }[] }>('/tasks');
  const units = useLoad<{ units: Unit[] }>('/org/units', canCreate);
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [unitId, setUnitId] = useState(0); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await api('/tasks', { method: 'POST', body: JSON.stringify({ title, description, unitId }) }); setTitle(''); setDescription(''); setOpen(false); tasks.reload(); } catch (err) { setError((err as Error).message); } };
  return <Screen title="Görev panosu" subtitle="Birim görevlerini takip edin." actions={canCreate && <Button onClick={() => setOpen(true)}>+ Yeni görev</Button>}><Card>{tasks.data?.tasks.map(task => <div className="list-item resource-row" key={task.id}><div className="resource-copy"><strong>{task.title}</strong><p>İlerleme %{task.progress}</p></div><div className="resource-actions"><Badge tone={task.status === 'done' ? 'good' : 'warn'}>{taskStatusLabel(task.status)}</Badge></div></div>)}{!tasks.data?.tasks.length && <Empty>Görev bulunamadı.</Empty>}<ErrorLine error={tasks.error}/></Card><Sheet open={open} onClose={() => setOpen(false)} title="Yeni görev"><form id="task-form" onSubmit={submit}><label>Başlık<input value={title} onChange={e => setTitle(e.target.value)} minLength={2} required/></label><label>Açıklama<textarea value={description} onChange={e => setDescription(e.target.value)}/></label><label>Birim<select value={unitId} onChange={e => setUnitId(Number(e.target.value))} required><option value={0}>Birim seçin</option>{units.data?.units.filter(unit => manageableUnitIds.includes(unit.id)).map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><ErrorLine error={error}/><Button type="submit">Görevi oluştur</Button></form></Sheet></Screen>;
}

export function AdminInventory({ globalRole, permissions }: { globalRole: string; permissions: Permission[] }) {
  const inventoryView = useTableColumns('inventory', inventoryColumns, permissions.includes('inventory_view'));
  const loanView = useTableColumns('loans', loanColumns.filter(column => column.key !== 'recipient' || permissions.includes('loans_view_personal_data')), permissions.includes('loans_view'));
  const allowed = (permission: Permission) => permissions.includes(permission);
  const canManage = allowed('inventory_update');
  const canCreate = allowed('inventory_create');
  const canArchive = allowed('inventory_archive');
  const canChangeItemType = allowed('inventory_change_item_type');
  const canStock = allowed('inventory_adjust_stock');
  const canLoan = allowed('loans_create');
  const canReturn = allowed('loans_receive_return');
  const canExtendDueDate = allowed('loans_extend_due_date');
  const canExportLoans = allowed('loans_export') && permissions.includes('loans_view');
  const canReverse = allowed('loans_reverse_transaction');
  const canReportDamage = allowed('loans_report_damage');
  const canReportLost = allowed('loans_report_lost');
  const canMedia = allowed('inventory_manage_media');
  const canImport = allowed('inventory_import');
  const canExport = allowed('inventory_export');
  const canCategories = allowed('inventory_manage_categories');
  const canLocations = allowed('inventory_manage_locations');
  const materials = useLoad<{ materials: Pick<InventoryMaterial, 'id' | 'name' | 'kind' | 'isActive' | 'archivedAt'>[] }>('/inventory/options');
  const definitions = useLoad<{ categories: InventoryCategory[]; locations: InventoryLocation[] }>('/inventory/definitions');
  const movements = useLoad<{ movements: { id: number; materialId: number; movementType: string | null; delta: string; balanceAfter: string; reason: string | null; createdAt: string; canUndo: boolean }[] }>('/inventory/movements', permissions.includes('inventory_view_movements'));
  const undoMovement = async (id: number) => { try { await api(`/inventory/movements/${id}/undo`, { method: 'POST' }); setError(''); reloadMaterials(); movements.reload(); } catch (err) { setError((err as Error).message); movements.reload(); } };
  const [openStatus, setOpenStatus] = useState<'active' | 'overdue'>('active');
  const [openPage, setOpenPage] = useState(1);
  const [historyStatus, setHistoryStatus] = useState<'completed' | 'damaged' | 'lost' | 'reversed'>('completed');
  const [savedLoanStatus, setSavedLoanStatus] = useState('active');
  const [historyPage, setHistoryPage] = useState(1);
  const [loanSort, setLoanSort] = useState<'issued_at' | 'due_at' | 'quantity' | 'status'>('issued_at');
  const [loanDirection, setLoanDirection] = useState<'asc' | 'desc'>('desc');
  const loans = useLoad<{ loans: InventoryLoan[]; page: number; pageSize: number; total: number }>(`/inventory/loans?status=${openStatus}&sort=${loanSort}&direction=${loanDirection}&page=${openPage}`);
  const history = useLoad<{ loans: InventoryLoan[]; page: number; pageSize: number; total: number }>(`/inventory/loans?status=${historyStatus}&sort=${loanSort}&direction=${loanDirection}&page=${historyPage}`);
  const [mediaPage, setMediaPage] = useState(1);
  const media = useLoad<{ media: { id: number; materialId: number; type: string; title: string | null; altText: string | null; externalUrl: string | null; sortOrder: number; isCover: boolean }[]; total: number; page: number; pageSize: number }>(`/inventory/media/search?page=${mediaPage}`, canMedia);
  useEffect(() => {
    if (media.data && mediaPage > 1 && !media.data.media.length && media.data.total < (mediaPage - 1) * media.data.pageSize + 1) {
      setMediaPage(Math.max(1, Math.ceil(media.data.total / media.data.pageSize)));
    }
  }, [media.data, mediaPage]);
  const [panel, setPanel] = useState<'material' | 'stock' | 'loan' | 'return' | 'link' | 'image' | 'video' | 'import' | 'category' | 'location' | 'bulk' | null>(null);
  const [error, setError] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]); const [bulkOperation, setBulkOperation] = useState<'category' | 'location' | 'visibility' | 'archive'>('category'); const [bulkCategoryId, setBulkCategoryId] = useState(0); const [bulkLocationId, setBulkLocationId] = useState(0); const [bulkVisibility, setBulkVisibility] = useState('hidden'); const [bulkConfirm, setBulkConfirm] = useState(false); const [bulkResult, setBulkResult] = useState(''); const [bulkUndoId, setBulkUndoId] = useState<number | null>(null);
  const [search, setSearch] = useState(''); const [filterStatus, setFilterStatus] = useState('active'); const [filterKind, setFilterKind] = useState(''); const [filterCategory, setFilterCategory] = useState(0); const [sort, setSort] = useState('name'); const [materialPage, setMaterialPage] = useState(1);
  const materialQuery = new URLSearchParams({ search, status: filterStatus, kind: filterKind, category: String(filterCategory), sort, page: String(materialPage) });
  const materialList = useLoad<{ materials: InventoryMaterial[]; total: number; page: number; pageSize: number }>(`/inventory/search?${materialQuery}`);
  const reloadMaterials = () => { materials.reload(); materialList.reload(); };
  useEffect(() => {
    if (materialList.data && materialPage > 1 && !materialList.data.materials.length && materialList.data.total < (materialPage - 1) * materialList.data.pageSize + 1) {
      setMaterialPage(Math.max(1, Math.ceil(materialList.data.total / materialList.data.pageSize)));
    }
  }, [materialList.data, materialPage]);
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null); const [archiveTarget, setArchiveTarget] = useState<InventoryMaterial | null>(null); const [materialActive, setMaterialActive] = useState(true);
  const [name, setName] = useState(''); const [kind, setKind] = useState('consumable'); const [unit, setUnit] = useState('adet');
  const [sku, setSku] = useState(''); const [brand, setBrand] = useState(''); const [model, setModel] = useState('');
  const [description, setDescription] = useState(''); const [minimumStock, setMinimumStock] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [publicVisibility, setPublicVisibility] = useState('hidden');
  const [categoryId, setCategoryId] = useState(0); const [locationId, setLocationId] = useState(0);
  const [definitionId, setDefinitionId] = useState<number | null>(null);
  const [definitionName, setDefinitionName] = useState(''); const [definitionCode, setDefinitionCode] = useState('');
  const [definitionDescription, setDefinitionDescription] = useState(''); const [definitionActive, setDefinitionActive] = useState(true); const [definitionPublic, setDefinitionPublic] = useState(true);
  const [materialId, setMaterialId] = useState(0); const [amount, setAmount] = useState(''); const [reason, setReason] = useState('');
  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState(''); const [email, setEmail] = useState('');
  const [loanNotes, setLoanNotes] = useState(''); const [returnNote, setReturnNote] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [loanId, setLoanId] = useState(0); const [condition, setCondition] = useState('ok');
  const [reverseTarget, setReverseTarget] = useState<InventoryLoan | null>(null); const [reverseReason, setReverseReason] = useState(''); const [reverseError, setReverseError] = useState('');
  const [extendTarget, setExtendTarget] = useState<InventoryLoan | null>(null); const [extendDueAt, setExtendDueAt] = useState(''); const [extendError, setExtendError] = useState('');
  const [linkTitle, setLinkTitle] = useState(''); const [externalUrl, setExternalUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null); const [imageAlt, setImageAlt] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [editingMediaId, setEditingMediaId] = useState<number | null>(null);
  const [mediaEdit, setMediaEdit] = useState({ title: '', altText: '', externalUrl: '', sortOrder: 0, isCover: false });
  const saveMedia = async (id: number) => { try { await api(`/inventory/media/${id}`, { method: 'PATCH', body: JSON.stringify({ title: mediaEdit.title || null, altText: mediaEdit.altText || null, externalUrl: mediaEdit.externalUrl || null, sortOrder: mediaEdit.sortOrder, isCover: mediaEdit.isCover }) }); setEditingMediaId(null); setError(''); media.reload(); } catch (err) { setError((err as Error).message); } };
  const [csv, setCsv] = useState(''); const [xlsxBase64, setXlsxBase64] = useState(''); const [csvName, setCsvName] = useState('');
  const [importInspection, setImportInspection] = useState<{ headers: string[]; rowCount: number; sample: { line: number; values: Record<string, string> }[]; columnQuality: { header: string; emptyCount: number }[] } | null>(null);
  const [importMapping, setImportMapping] = useState<ImportMapping>({});
  const [importPreview, setImportPreview] = useState<{ totalCount: number; validCount: number; errorCount: number; rows: { line: number; name: string; quantity: string; kind: string }[]; errors: { line: number; message: string }[] } | null>(null);
  const [skipImportErrors, setSkipImportErrors] = useState(false);
  const openPanel = (next: typeof panel) => { setError(''); if (next === 'import') { setCsv(''); setXlsxBase64(''); setCsvName(''); setImportPreview(null); setImportInspection(null); setImportMapping({}); setSkipImportErrors(false); } setPanel(next); };
  const startMaterial = (item?: InventoryMaterial) => { setEditingMaterialId(item?.id || null); setName(item?.name || ''); setKind(item?.kind || 'consumable'); setUnit(item?.unit || 'adet'); setSku(item?.sku || ''); setBrand(item?.brand || ''); setModel(item?.model || ''); setDescription(item?.description || ''); setMinimumStock(item?.minimumStock || ''); setInitialQuantity('0'); setPublicVisibility(item?.publicVisibility || 'hidden'); setCategoryId(item?.categoryId || 0); setLocationId(item?.locationId || 0); setMaterialActive(item?.isActive ?? true); openPanel('material'); };
  const startDefinition = (type: 'category' | 'location', item?: InventoryCategory | InventoryLocation) => { setDefinitionId(item?.id || null); setDefinitionName(item?.name || ''); setDefinitionCode(item && 'code' in item ? item.code || '' : ''); setDefinitionDescription(item?.description || ''); setDefinitionActive(item?.isActive ?? true); setDefinitionPublic(item && 'isPublic' in item ? item.isPublic : true); openPanel(type); };
  const toggleSelected = (id: number) => setSelectedMaterials(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 100 ? [...current, id] : current);
  const confirmBulk = async () => { try { const result = await api<{ successCount: number; failureCount: number; failures: { name: string; reason: string }[]; undoAuditId: number | null }>('/inventory/bulk', { method: 'POST', body: JSON.stringify({ operation: bulkOperation, itemIds: selectedMaterials, confirmed: true, ...(bulkOperation === 'category' ? { categoryId: bulkCategoryId || null } : bulkOperation === 'location' ? { locationId: bulkLocationId || null } : bulkOperation === 'visibility' ? { publicVisibility: bulkVisibility } : {}) }) }); setBulkResult(`${result.successCount} malzeme güncellendi${result.failureCount ? `, ${result.failureCount} kayıt atlandı: ${result.failures.map(item => `${item.name} (${item.reason})`).join('; ')}` : '.'}`); setBulkUndoId(result.undoAuditId); if (result.undoAuditId) window.setTimeout(() => setBulkUndoId(current => current === result.undoAuditId ? null : current), 60_000); setSelectedMaterials([]); setBulkConfirm(false); setPanel(null); setError(''); reloadMaterials(); } catch (err) { setBulkConfirm(false); setError((err as Error).message); } };
  const undoBulk = async () => { if (!bulkUndoId) return; try { const result = await api<{ restoredCount: number }>(`/inventory/bulk/${bulkUndoId}/undo`, { method: 'POST' }); setBulkUndoId(null); setBulkResult(`${result.restoredCount} malzemenin toplu değişikliği geri alındı.`); reloadMaterials(); } catch (err) { setBulkUndoId(null); setError((err as Error).message); } };
  const reverseLoan = async () => { if (!reverseTarget) return; try { await api(`/inventory/loans/${reverseTarget.id}/reverse`, { method: 'POST', body: JSON.stringify({ reason: reverseReason }) }); setReverseTarget(null); setReverseReason(''); setReverseError(''); setOpenPage(1); setHistoryPage(1); loans.reload(); history.reload(); reloadMaterials(); movements.reload(); } catch (err) { setReverseError((err as Error).message); } };
  const extendLoan = async () => { if (!extendTarget || !extendDueAt) return; try { await api(`/inventory/loans/${extendTarget.id}/due-date`, { method: 'PATCH', body: JSON.stringify({ dueAt: new Date(extendDueAt).toISOString() }) }); setExtendTarget(null); setExtendDueAt(''); setExtendError(''); loans.reload(); } catch (err) { setExtendError((err as Error).message); } };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (panel === 'bulk') { if (selectedMaterials.length > 100) throw new Error('Bir toplu işlemde en fazla 100 malzeme seçin.'); setBulkConfirm(true); return; }
      if (panel === 'material') await api(editingMaterialId ? `/inventory/${editingMaterialId}` : '/inventory', { method: editingMaterialId ? 'PATCH' : 'POST', body: JSON.stringify({ name, kind, unit, sku: sku || null, brand: brand || null, model: model || null, description: description || null, minimumStock: minimumStock ? Number(minimumStock) : null, publicVisibility, categoryId: categoryId || null, locationId: locationId || null, ...(editingMaterialId ? { isActive: materialActive } : { quantity: Number(initialQuantity) }) }) });
      if (panel === 'category' || panel === 'location') await api(definitionId ? `/inventory/${panel === 'category' ? 'categories' : 'locations'}/${definitionId}` : `/inventory/${panel === 'category' ? 'categories' : 'locations'}`, { method: definitionId ? 'PATCH' : 'POST', body: JSON.stringify({ name: definitionName, description: definitionDescription || null, isActive: definitionActive, ...(panel === 'location' ? { code: definitionCode.toUpperCase(), isPublic: definitionPublic } : {}) }) });
      if (panel === 'stock') await api('/inventory/stock', { method: 'POST', body: JSON.stringify({ materialId, delta: Number(amount), reason }) });
      if (panel === 'loan') await api('/inventory/loans', { method: 'POST', body: JSON.stringify({ materialId, quantity: Number(amount), firstName, lastName, ...(email ? { email } : {}), ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}), notes: loanNotes || null }) });
      if (panel === 'return') await api(`/inventory/loans/${loanId}/return`, { method: 'POST', body: JSON.stringify({ quantity: Number(amount), condition, note: returnNote || null }) });
      if (panel === 'link') await api('/inventory/media/links', { method: 'POST', body: JSON.stringify({ materialId, title: linkTitle || null, externalUrl }) });
      if (panel === 'image') {
        if (!imageFile || imageFile.size > 8 * 1024 * 1024) throw new Error('En fazla 8 MB fotoğraf seçin.');
        const body = new FormData(); body.set('materialId', String(materialId)); body.set('altText', imageAlt); body.set('title', linkTitle); body.set('file', imageFile);
        await api('/inventory/media/images', { method: 'POST', body }); setImageFile(null); setImageAlt('');
      }
      if (panel === 'video') {
        if (!videoFile || videoFile.size > 50 * 1024 * 1024) throw new Error('En fazla 50 MB video seçin.');
        const body = new FormData(); body.set('materialId', String(materialId)); body.set('title', linkTitle); body.set('file', videoFile);
        await api('/inventory/media/videos', { method: 'POST', body }); setVideoFile(null);
      }
      if (panel === 'import') {
        const source = xlsxBase64 ? { xlsxBase64 } : { csv };
        if (!importPreview) { setImportPreview(await api('/inventory/import/preview', { method: 'POST', body: JSON.stringify({ ...source, mapping: importMapping }) })); return; }
        if (!importPreview.validCount || importPreview.errorCount && !skipImportErrors) throw new Error('Geçerli satırları aktarmak için hatalıları atlamayı açıkça seçin.');
        const result = await api<{ importedCount: number; skippedCount: number }>('/inventory/import/confirm', { method: 'POST', body: JSON.stringify({ ...source, mapping: importMapping, skipErrors: skipImportErrors }) });
        setBulkResult(`${result.importedCount} malzeme aktarıldı${result.skippedCount ? `; ${result.skippedCount} hatalı satır atlandı.` : '.'}`);
        setCsv(''); setXlsxBase64(''); setCsvName(''); setImportPreview(null); setImportInspection(null); setImportMapping({}); setSkipImportErrors(false);
      }
      if (panel === 'loan' || panel === 'return') { setOpenPage(1); setHistoryPage(1); }
      setPanel(null); setAmount(''); setExternalUrl(''); setLinkTitle(''); setLoanNotes(''); setReturnNote(''); reloadMaterials(); loans.reload(); history.reload(); media.reload(); definitions.reload(); movements.reload();
    } catch (err) { setError((err as Error).message); }
  };
  const filteredMaterials = materialList.data?.materials || [];
  const canReverseLoan = (loan: InventoryLoan) => canReverse && !loan.anonymizedAt && Number(loan.returnedQuantity) === 0 && (loan.itemType === 'consumable' ? loan.status === 'completed' : loan.status === 'open');
  const loanBorrowerName = (loan: InventoryLoan) => loan.borrowerNameOriginal || [loan.borrowerFirstName, loan.borrowerLastName].filter(Boolean).join(' ') || 'Gizli kullanıcı';
  const loanStatusLabel = (status: string) => ({ open: 'Açık', partial: 'Kısmi iade', completed: 'Tamamlandı', returned: 'İade edildi', damaged: 'Hasarlı', lost: 'Kayıp', reversed: 'Geri alındı' } as Record<string, string>)[status] || status;
  return <Screen title="Envanter yönetimi" subtitle="Malzemeler, stok hareketleri ve teslimler." actions={<>
      {canCreate && <Button onClick={() => startMaterial()}>+ Malzeme</Button>}
      {canStock && <Button variant="quiet" onClick={() => openPanel('stock')}>Stok hareketi</Button>}
      {canLoan && <Button variant="quiet" onClick={() => openPanel('loan')}>Teslim oluştur</Button>}
      {canMedia && <><Button variant="quiet" onClick={() => openPanel('link')}>Bağlantı ekle</Button>{import.meta.env.VITE_DEMO_MODE !== 'true' && <><Button variant="quiet" onClick={() => openPanel('image')}>Fotoğraf ekle</Button><Button variant="quiet" onClick={() => openPanel('video')}>Video ekle</Button></>}</>}
      {canImport && <Button variant="quiet" onClick={() => openPanel('import')}>{import.meta.env.VITE_DEMO_MODE === 'true' ? 'CSV içe aktar' : 'CSV / XLSX içe aktar'}</Button>}
      {canExport && import.meta.env.VITE_DEMO_MODE !== 'true' && <><a className="button button-quiet" href="/api/inventory/export.csv">CSV indir</a><a className="button button-quiet" href="/api/inventory/export.xlsx">XLSX indir</a></>}
      {canExportLoans && import.meta.env.VITE_DEMO_MODE !== 'true' && <a className="button button-quiet" href="/api/inventory/loans/export.csv">Teslim CSV indir</a>}
    </>}>
    <div className="grid inventory-grid">
      <Card title="Malzemeler"><div className="inventory-filters"><label>Arama<input type="search" value={search} onChange={e => { setSearch(e.target.value); setMaterialPage(1); }} placeholder="Ad, stok kodu, marka…"/></label><label>Durum<select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setMaterialPage(1); }}><option value="active">Aktif</option><option value="all">Arşiv dışı</option><option value="inactive">Pasif</option><option value="low">Düşük stok</option><option value="out">Tükenen</option><option value="archived">Arşiv</option></select></label><label>Tür<select value={filterKind} onChange={e => { setFilterKind(e.target.value); setMaterialPage(1); }}><option value="">Tümü</option><option value="consumable">Sarf</option><option value="loanable">Ödünç</option><option value="equipment">Demirbaş</option></select></label><label>Kategori<select value={filterCategory} onChange={e => { setFilterCategory(Number(e.target.value)); setMaterialPage(1); }}><option value={0}>Tümü</option>{definitions.data?.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Sırala<select value={sort} onChange={e => { setSort(e.target.value); setMaterialPage(1); }}><option value="name">Ada göre</option><option value="quantity">Miktara göre</option><option value="updated">Son güncellenen</option></select></label></div><SavedFilters table="inventory" current={{ search, categoryId: filterCategory, kind: filterKind, status: filterStatus }} onApply={filters => { setSearch(String(filters.search)); setFilterCategory(Number(filters.categoryId)); setFilterKind(String(filters.kind)); setFilterStatus(String(filters.status)); setSelectedMaterials([]); setMaterialPage(1); }}/>{inventoryView.controls}<div className="inventory-selection"><span>{materialList.data?.total ?? 0} kayıt · Sayfa {materialPage}{selectedMaterials.length ? ` · ${selectedMaterials.length} seçili` : ''}</span>{canManage && <><Button variant="quiet" onClick={() => setSelectedMaterials(filteredMaterials.filter(item => !item.archivedAt).slice(0, 100).map(item => item.id))}>Görünenleri seç</Button>{selectedMaterials.length > 0 && <Button variant="quiet" onClick={() => setSelectedMaterials([])}>Seçimi temizle</Button>}{selectedMaterials.length > 0 && <Button onClick={() => openPanel('bulk')}>Toplu işlem</Button>}</>}</div>{bulkResult && <div className="inventory-bulk-result" role="status"><span>{bulkResult}</span>{bulkUndoId && <Button variant="quiet" onClick={undoBulk}>Geri al · 60 sn</Button>}</div>}{filteredMaterials.map(item => <div className="list-item resource-row inventory-material-row" key={item.id}>
        {canManage && !item.archivedAt && <input type="checkbox" className="inventory-select" aria-label={`${item.name} seç`} checked={selectedMaterials.includes(item.id)} onChange={() => toggleSelected(item.id)}/>}
        <div className="resource-copy"><strong>{inventoryView.visible('name') ? item.name : `Malzeme #${item.id}`}</strong>{inventoryView.visible('brand') && item.brand && <p>Marka: {item.brand}</p>}{inventoryView.visible('model') && item.model && <p>Model: {item.model}</p>}{inventoryView.visible('category') && <small>Kategori: {definitions.data?.categories.find(category => category.id === item.categoryId)?.name || 'Belirtilmedi'}</small>}{inventoryView.visible('location') && <small>Konum: {definitions.data?.locations.find(location => location.id === item.locationId)?.name || 'Belirtilmedi'}</small>}{inventoryView.visible('visibility') && <small>{item.publicVisibility === 'hidden' ? 'Katalogda gizli' : item.publicVisibility === 'exact' ? 'Miktar görünür' : 'Stok durumu görünür'}</small>}</div>
        <div className="resource-actions">{inventoryView.visible('quantity') && <Badge tone={item.archivedAt || !item.isActive ? 'neutral' : Number(item.availableQuantity) > 0 ? 'good' : 'warn'}>{item.kind === 'equipment' ? `${formatQuantity(item.availableQuantity)} / ${formatQuantity(item.quantity)} ${item.unit}` : `${formatQuantity(item.quantity)} ${item.unit}`}</Badge>}{item.archivedAt ? <Badge>Arşivde</Badge> : !item.isActive ? <Badge>Pasif</Badge> : null}{canManage && !item.archivedAt && <Button variant="quiet" onClick={() => startMaterial(item)}>Düzenle</Button>}{canArchive && !item.archivedAt && <Button variant="quiet" onClick={() => setArchiveTarget(item)}>Arşivle</Button>}</div>
      </div>)}{materialList.data && !filteredMaterials.length && <Empty>Bu ölçütlerde malzeme yok.</Empty>}<ErrorLine error={materialList.error}/>{materialList.data && materialList.data.total > materialList.data.pageSize && <div className="inventory-selection"><span>Sayfa {materialPage}/{Math.ceil(materialList.data.total / materialList.data.pageSize)}</span><Button variant="quiet" disabled={materialPage <= 1} onClick={() => setMaterialPage(page => page - 1)}>Önceki</Button><Button variant="quiet" disabled={materialPage * materialList.data.pageSize >= materialList.data.total} onClick={() => setMaterialPage(page => page + 1)}>Sonraki</Button></div>}</Card>
      <Card title="Açık teslimler">
        <div className="inventory-filters"><label>Durum<select value={openStatus} onChange={e => { setOpenStatus(e.target.value as 'active' | 'overdue'); setSavedLoanStatus(e.target.value); setOpenPage(1); }}><option value="active">Aktif</option><option value="overdue">Gecikmiş</option></select></label><label>Sırala<select value={loanSort} onChange={e => { setLoanSort(e.target.value as typeof loanSort); setOpenPage(1); setHistoryPage(1); }}><option value="issued_at">Teslim zamanı</option><option value="due_at">Beklenen iade</option><option value="quantity">Miktar</option><option value="status">Durum</option></select></label><label>Yön<select value={loanDirection} onChange={e => { setLoanDirection(e.target.value as 'asc' | 'desc'); setOpenPage(1); setHistoryPage(1); }}><option value="desc">Yeniden eskiye</option><option value="asc">Eskiden yeniye</option></select></label></div>{permissions.includes('loans_view') && <><label>Kaydedilecek teslim durumu<select value={savedLoanStatus} onChange={event => setSavedLoanStatus(event.target.value)}><option value="active">Aktif</option><option value="overdue">Gecikmiş</option><option value="completed">Tamamlanan</option><option value="damaged">Hasarlı</option><option value="lost">Kayıp</option><option value="reversed">Geri alınan</option></select></label><SavedFilters table="loans" current={{ status: savedLoanStatus }} onApply={filters => { const next = String(filters.status); setSavedLoanStatus(next); if (next === 'active' || next === 'overdue') { setOpenStatus(next); setOpenPage(1); } else { setHistoryStatus(next as typeof historyStatus); setHistoryPage(1); } }}/></>}{loanView.controls}
        {loans.data?.loans.map(loan => <div className="list-item resource-row" key={loan.id}><div className="resource-copy"><strong>#{loan.id}{loanView.visible('recipient') ? ` · ${loanBorrowerName(loan)}` : ''}</strong>{loanView.visible('item') && <p>{materials.data?.materials.find(item => item.id === loan.materialId)?.name || 'Malzeme'}</p>}{loanView.visible('quantity') && <p>{formatQuantity(loan.returnedQuantity)}/{formatQuantity(loan.quantity)} iade</p>}{loanView.visible('issued_at') && loan.issuedAt && <small>Teslim: {new Date(loan.issuedAt).toLocaleString('tr-TR')}</small>}{loanView.visible('status') && <small>{loanStatusLabel(loan.status)}</small>}{loanView.visible('due_at') && loan.dueAt && <small className={new Date(loan.dueAt).getTime() < Date.now() ? 'text-warning' : ''}>Beklenen iade: {new Date(loan.dueAt).toLocaleString('tr-TR')}{new Date(loan.dueAt).getTime() < Date.now() ? ' · Gecikti' : ''}</small>}{loan.notes && <small>{loan.notes}</small>}</div>{(canReturn || canExtendDueDate && (loan.itemType === 'loanable' || materials.data?.materials.find(material => material.id === loan.materialId)?.kind === 'loanable') || canReverseLoan(loan)) && <div className="resource-actions">{canExtendDueDate && (loan.itemType === 'loanable' || materials.data?.materials.find(material => material.id === loan.materialId)?.kind === 'loanable') && <Button variant="quiet" onClick={() => { setExtendTarget(loan); setExtendDueAt(''); setExtendError(''); }}>Tarihi uzat</Button>}{canReturn && <Button variant="quiet" onClick={() => { setLoanId(loan.id); setAmount(String(Number(loan.quantity) - Number(loan.returnedQuantity))); setCondition('ok'); setReturnNote(''); openPanel('return'); }}>İade al</Button>}{canReverseLoan(loan) && <Button variant="quiet" onClick={() => { setReverseTarget(loan); setReverseReason(''); setReverseError(''); }}>Geri al</Button>}</div>}</div>)}
        {loans.data && !loans.data.loans.length && <Empty>Bu durumda açık teslim yok.</Empty>}<ErrorLine error={loans.error}/>
        {loans.data && loans.data.total > 20 && <div className="inventory-selection"><span>{loans.data.total} kayıt · Sayfa {openPage}/{Math.ceil(loans.data.total / 20)}</span><Button variant="quiet" disabled={openPage <= 1} onClick={() => setOpenPage(page => page - 1)}>Önceki</Button><Button variant="quiet" disabled={openPage * 20 >= loans.data.total} onClick={() => setOpenPage(page => page + 1)}>Sonraki</Button></div>}
      </Card>
      <Card title="Teslim geçmişi">
        <div className="inventory-filters"><label>Durum<select value={historyStatus} onChange={e => { setHistoryStatus(e.target.value as typeof historyStatus); setSavedLoanStatus(e.target.value); setHistoryPage(1); }}><option value="completed">Tamamlanan / iade edilen</option><option value="damaged">Hasarlı</option><option value="lost">Kayıp</option><option value="reversed">Geri alınan</option></select></label></div>
        {history.data?.loans.map(loan => <div className="list-item resource-row" key={loan.id}><div className="resource-copy"><strong>#{loan.id}{loanView.visible('item') ? ` · ${materials.data?.materials.find(item => item.id === loan.materialId)?.name || 'Malzeme'}` : ''}</strong>{loanView.visible('recipient') && <p>{loanBorrowerName(loan)}</p>}{loanView.visible('quantity') && <p>{formatQuantity(loan.quantity)}</p>}{loanView.visible('issued_at') && loan.issuedAt && <small>Teslim: {new Date(loan.issuedAt).toLocaleString('tr-TR')}</small>}{loanView.visible('due_at') && loan.dueAt && <small>Beklenen iade: {new Date(loan.dueAt).toLocaleString('tr-TR')}</small>}{loanView.visible('status') && <small>{loanStatusLabel(loan.status)}</small>}{loan.closureNote && <small>{loan.closureNote}</small>}</div><div className="resource-actions">{loanView.visible('status') && <Badge tone={loan.status === 'damaged' || loan.status === 'lost' ? 'warn' : 'neutral'}>{loanStatusLabel(loan.status)}</Badge>}{canReverseLoan(loan) && <Button variant="quiet" onClick={() => { setReverseTarget(loan); setReverseReason(''); setReverseError(''); }}>Geri al</Button>}</div></div>)}
        {history.data && !history.data.loans.length && <Empty>Bu durumda teslim kaydı yok.</Empty>}<ErrorLine error={history.error}/>
        {history.data && history.data.total > 20 && <div className="inventory-selection"><span>{history.data.total} kayıt · Sayfa {historyPage}/{Math.ceil(history.data.total / 20)}</span><Button variant="quiet" disabled={historyPage <= 1} onClick={() => setHistoryPage(page => page - 1)}>Önceki</Button><Button variant="quiet" disabled={historyPage * 20 >= history.data.total} onClick={() => setHistoryPage(page => page + 1)}>Sonraki</Button></div>}
      </Card>
      <Card title="Kategoriler ve konumlar" className="inventory-definitions">
        <div className="resource-row"><strong>Kategoriler</strong>{canCategories && <Button variant="quiet" onClick={() => startDefinition('category')}>+ Kategori</Button>}</div>
        {definitions.data?.categories.map(item => <div className="list-item resource-row" key={item.id}><div className="resource-copy"><strong>{item.name}</strong>{item.description && <p>{item.description}</p>}</div><div className="resource-actions">{!item.isActive && <Badge>Pasif</Badge>}{canCategories && <Button variant="quiet" onClick={() => startDefinition('category', item)}>Düzenle</Button>}</div></div>)}
        {!definitions.data?.categories.length && <Empty>Henüz kategori yok.</Empty>}
        <div className="resource-row"><strong>Konumlar</strong>{canLocations && <Button variant="quiet" onClick={() => startDefinition('location')}>+ Konum</Button>}</div>
        {definitions.data?.locations.map(item => <div className="list-item resource-row" key={item.id}><div className="resource-copy"><strong>{item.name}</strong><p>{item.code || 'Kod yok'} · {item.isPublic ? 'Katalogda görünür' : 'Gizli'}</p></div><div className="resource-actions">{!item.isActive && <Badge>Pasif</Badge>}{canLocations && <Button variant="quiet" onClick={() => startDefinition('location', item)}>Düzenle</Button>}</div></div>)}
        {!definitions.data?.locations.length && <Empty>Henüz konum yok.</Empty>}<ErrorLine error={definitions.error}/>
      </Card>
      {permissions.includes('inventory_view_movements') && <Card title="Son stok hareketleri">{movements.data?.movements.map(item => <div className="list-item resource-row" key={item.id}><div className="resource-copy"><strong>{materials.data?.materials.find(material => material.id === item.materialId)?.name || `Malzeme #${item.materialId}`}</strong><p>{item.reason || ({ initial: 'İlk stok', adjustment: 'Stok düzeltmesi', delivery: 'Teslim', return: 'İade', reversal: 'Geri alma' } as Record<string, string>)[item.movementType || ''] || 'Stok hareketi'}</p><small>{new Date(item.createdAt).toLocaleString('tr-TR')}</small></div><div className="resource-actions"><Badge tone={Number(item.delta) >= 0 ? 'good' : 'warn'}>{Number(item.delta) > 0 ? '+' : ''}{formatQuantity(item.delta)}</Badge><small>Kalan {formatQuantity(item.balanceAfter)}</small>{canStock && item.canUndo && <Button variant="quiet" onClick={() => undoMovement(item.id)}>Geri al</Button>}</div></div>)}{movements.data && !movements.data.movements.length && <Empty>Stok hareketi yok.</Empty>}<ErrorLine error={movements.error}/><ErrorLine error={error}/></Card>}
      {canMedia && <Card title="Malzeme medyası">{media.data?.media.map(medium => <div className="list-item" key={medium.id}><strong>{medium.title || (medium.type === 'image' ? 'Fotoğraf' : medium.type === 'video' ? 'Video' : 'Bağlantı')}{medium.isCover ? ' · Kapak' : ''}</strong><p>{materials.data?.materials.find(item => item.id === medium.materialId)?.name} · Sıra {medium.sortOrder}</p>{medium.externalUrl && <a href={medium.externalUrl} target="_blank" rel="noopener noreferrer">Bağlantıyı aç ↗</a>}{editingMediaId === medium.id ? <div><label>Başlık<input maxLength={180} value={mediaEdit.title} onChange={e => setMediaEdit({ ...mediaEdit, title: e.target.value })}/></label>{medium.type === 'image' && <label>Alternatif metin<input maxLength={180} required value={mediaEdit.altText} onChange={e => setMediaEdit({ ...mediaEdit, altText: e.target.value })}/></label>}{medium.type === 'link' && <label>HTTPS bağlantısı<input type="url" maxLength={2048} required value={mediaEdit.externalUrl} onChange={e => setMediaEdit({ ...mediaEdit, externalUrl: e.target.value })}/></label>}<label>Sıra<input type="number" min={0} max={999} value={mediaEdit.sortOrder} onChange={e => setMediaEdit({ ...mediaEdit, sortOrder: Number(e.target.value) })}/></label>{medium.type === 'image' && <label><input type="checkbox" checked={mediaEdit.isCover} onChange={e => setMediaEdit({ ...mediaEdit, isCover: e.target.checked })}/> Kapak fotoğrafı</label>}<Button variant="quiet" onClick={() => saveMedia(medium.id)}>Kaydet</Button><Button variant="quiet" onClick={() => setEditingMediaId(null)}>Vazgeç</Button></div> : <Button variant="quiet" onClick={() => { setEditingMediaId(medium.id); setMediaEdit({ title: medium.title || '', altText: medium.altText || '', externalUrl: medium.externalUrl || '', sortOrder: medium.sortOrder, isCover: medium.isCover }); }}>Düzenle</Button>} <Button variant="quiet" onClick={async () => { try { await api(`/inventory/media/${medium.id}`, { method: 'DELETE' }); media.reload(); } catch (err) { setError((err as Error).message); } }}>Kaldır</Button></div>)}{media.data && !media.data.media.length && <Empty>Medya yok.</Empty>}<ErrorLine error={media.error}/><ErrorLine error={error}/>{media.data && media.data.total > media.data.pageSize && <div className="inventory-selection"><span>{media.data.total} kayıt · Sayfa {mediaPage}/{Math.ceil(media.data.total / media.data.pageSize)}</span><Button variant="quiet" disabled={mediaPage <= 1} onClick={() => setMediaPage(page => page - 1)}>Önceki</Button><Button variant="quiet" disabled={mediaPage * media.data.pageSize >= media.data.total} onClick={() => setMediaPage(page => page + 1)}>Sonraki</Button></div>}</Card>}
    </div>
    <Sheet open={panel !== null} onClose={() => setPanel(null)} title={panel === 'material' ? editingMaterialId ? 'Malzemeyi düzenle' : 'Yeni malzeme' : panel === 'category' ? definitionId ? 'Kategoriyi düzenle' : 'Yeni kategori' : panel === 'location' ? definitionId ? 'Konumu düzenle' : 'Yeni konum' : panel === 'bulk' ? 'Toplu işlem' : panel === 'stock' ? 'Stok hareketi' : panel === 'loan' ? 'Teslim oluştur' : panel === 'link' ? 'Malzeme bağlantısı' : panel === 'image' ? 'Malzeme fotoğrafı' : panel === 'video' ? 'Malzeme videosu' : panel === 'import' ? import.meta.env.VITE_DEMO_MODE === 'true' ? 'CSV içe aktar' : 'CSV / XLSX içe aktar' : 'İade al'}>
      <form onSubmit={submit}>{panel === 'material' ? <>
        <label>Malzeme adı<input value={name} onChange={e => setName(e.target.value)} maxLength={180} required/></label>
        <label>Tür<select value={kind} onChange={e => setKind(e.target.value)} disabled={editingMaterialId !== null && !canChangeItemType}><option value="consumable">Sarf</option><option value="loanable">Ödünç</option><option value="equipment">Demirbaş</option></select></label>
        <label>Birim<input value={unit} onChange={e => setUnit(e.target.value)} maxLength={30} required/></label>
        {!editingMaterialId && <label>Başlangıç stoğu<input type="number" min="0" step="0.001" value={initialQuantity} onChange={e => setInitialQuantity(e.target.value)} required/></label>}
        <label>SKU<input value={sku} onChange={e => setSku(e.target.value)} maxLength={100}/></label>
        <label>Marka<input value={brand} onChange={e => setBrand(e.target.value)} maxLength={120}/></label>
        <label>Model<input value={model} onChange={e => setModel(e.target.value)} maxLength={160}/></label>
        <label>Kategori<select value={categoryId} onChange={e => setCategoryId(Number(e.target.value))}><option value={0}>Kategori seçilmedi</option>{definitions.data?.categories.filter(item => item.isActive || item.id === categoryId).map(item => <option key={item.id} value={item.id}>{item.name}{!item.isActive ? ' · Pasif' : ''}</option>)}</select></label>
        <label>Konum<select value={locationId} onChange={e => setLocationId(Number(e.target.value))}><option value={0}>Konum seçilmedi</option>{definitions.data?.locations.filter(item => item.isActive || item.id === locationId).map(item => <option key={item.id} value={item.id}>{item.name}{item.code ? ` · ${item.code}` : ''}{!item.isActive ? ' · Pasif' : ''}</option>)}</select></label>
        <label>Minimum stok<input type="number" min="0" step="0.001" value={minimumStock} onChange={e => setMinimumStock(e.target.value)}/></label>
        <label>Kamu görünürlüğü<select value={publicVisibility} onChange={e => setPublicVisibility(e.target.value)}><option value="hidden">Gizli</option><option value="status">Yalnız stok durumu</option><option value="exact">Kesin miktar</option></select></label>
        {editingMaterialId && <label><input type="checkbox" checked={materialActive} onChange={e => setMaterialActive(e.target.checked)}/> Aktif malzeme</label>}
        <label>Açıklama<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={3000}/></label>
      </> : panel === 'bulk' ? <>
        <p>{selectedMaterials.length} malzeme seçildi. En fazla 100 kayıt aynı işlemde değiştirilebilir.</p>
        <label>İşlem<select value={bulkOperation} onChange={e => setBulkOperation(e.target.value as typeof bulkOperation)}><option value="category">Kategori ata</option><option value="location">Konum ata</option><option value="visibility">Katalog görünürlüğü</option>{canArchive && <option value="archive">Arşivle</option>}</select></label>
        {bulkOperation === 'category' && <label>Kategori<select value={bulkCategoryId} onChange={e => setBulkCategoryId(Number(e.target.value))}><option value={0}>Kategori yok</option>{definitions.data?.categories.filter(item => item.isActive).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {bulkOperation === 'location' && <label>Konum<select value={bulkLocationId} onChange={e => setBulkLocationId(Number(e.target.value))}><option value={0}>Konum yok</option>{definitions.data?.locations.filter(item => item.isActive).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {bulkOperation === 'visibility' && <label>Görünürlük<select value={bulkVisibility} onChange={e => setBulkVisibility(e.target.value)}><option value="hidden">Gizli</option><option value="status">Yalnız stok durumu</option><option value="exact">Kesin miktar</option></select></label>}
      </> : panel === 'category' || panel === 'location' ? <>
        <label>Ad<input value={definitionName} onChange={e => setDefinitionName(e.target.value)} maxLength={120} required/></label>
        {panel === 'location' && <label>Konum kodu<input value={definitionCode} onChange={e => setDefinitionCode(e.target.value)} maxLength={50} required/></label>}
        <label>Açıklama<textarea value={definitionDescription} onChange={e => setDefinitionDescription(e.target.value)} maxLength={1000}/></label>
        {panel === 'location' && <label><input type="checkbox" checked={definitionPublic} onChange={e => setDefinitionPublic(e.target.checked)}/> Katalogda görünür</label>}
        <label><input type="checkbox" checked={definitionActive} onChange={e => setDefinitionActive(e.target.checked)}/> Aktif</label>
      </> : panel === 'import' ? <>
        <label>{import.meta.env.VITE_DEMO_MODE === 'true' ? 'UTF-8 CSV dosyası' : 'UTF-8 CSV veya XLSX dosyası'}<input type="file" accept={import.meta.env.VITE_DEMO_MODE === 'true' ? '.csv,.txt,text/csv' : '.csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'} onChange={async e => { const file = e.target.files?.[0]; setCsv(''); setXlsxBase64(''); setCsvName(''); setImportPreview(null); setImportInspection(null); setImportMapping({}); setSkipImportErrors(false); setError(''); if (!file) return; if (file.size > 2 * 1024 * 1024) { setError('Dosya en fazla 2 MB olabilir.'); return; } try { const isXlsx = file.name.toLocaleLowerCase('tr-TR').endsWith('.xlsx'); if (isXlsx && import.meta.env.VITE_DEMO_MODE === 'true') throw new Error('XLSX yalnız gerçek sunucu modunda kullanılabilir.'); const source = isXlsx ? { xlsxBase64: await fileBase64(file) } : { csv: new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()) }; const inspection = await api<typeof importInspection & { suggestedMapping: ImportMapping }>('/inventory/import/inspect', { method: 'POST', body: JSON.stringify(source) }); setCsv('csv' in source ? source.csv || '' : ''); setXlsxBase64('xlsxBase64' in source ? source.xlsxBase64 || '' : ''); setCsvName(file.name); setImportInspection(inspection); setImportMapping(inspection.suggestedMapping); } catch (cause) { setError((cause as Error).message); } }} required={!csv && !xlsxBase64}/></label>
        {csvName && <p>Dosya: {csvName} · {importInspection?.rowCount} satır</p>}
        {importInspection && <><h3>Sütun eşlemesi</h3><p>Malzeme adı zorunludur. Kullanmayacağınız sütunları atlayabilirsiniz.</p>{importInspection.headers.map(header => <label key={header}>{header} <small>({importInspection.rowCount - (importInspection.columnQuality.find(column => column.header === header)?.emptyCount || 0)} dolu)</small><select value={importMapping[header] || ''} onChange={event => { setImportMapping(current => ({ ...current, [header]: event.target.value ? event.target.value as ImportField : null })); setImportPreview(null); setSkipImportErrors(false); }}><option value="">Atla</option>{importFields.map(field => <option key={field} value={field}>{importFieldLabels[field]}</option>)}</select></label>)}<details><summary>İlk satırları göster</summary>{importInspection.sample.map(row => <p key={row.line}>#{row.line} · {Object.entries(row.values).map(([header, value]) => `${header}: ${value}`).join(' · ')}</p>)}</details></>}
        <p>Hatalı satırlar varsayılan olarak aktarımı durdurur. İsterseniz önizlemeden sonra yalnız geçerli satırları aktarabilirsiniz; onay sırasında kayıtlar yeniden kontrol edilir.</p>
        {importPreview && <><p>{importPreview.totalCount} satır · {importPreview.validCount} geçerli · {importPreview.errorCount} hatalı</p>{importPreview.rows.map(row => <p key={row.line}>#{row.line} · {row.name} · {row.quantity} · {row.kind}</p>)}{importPreview.errors.map((item, index) => <p key={index} role="alert">{item.line}. satır: {item.message}</p>)}{importPreview.errorCount > 0 && importPreview.validCount > 0 && <label><input type="checkbox" checked={skipImportErrors} onChange={event => setSkipImportErrors(event.target.checked)}/> {importPreview.errorCount} hatalı satırı atla, {importPreview.validCount} geçerli satırı aktar</label>}</>}
      </> : panel === 'image' ? <>
        <label>Malzeme<select value={materialId} onChange={e => setMaterialId(Number(e.target.value))} required><option value="">Malzeme seçin</option>{materials.data?.materials.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Fotoğraf (JPG, PNG, WebP; en fazla 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImageFile(e.target.files?.[0] || null)} required/></label>
        <label>Alternatif metin<input value={imageAlt} onChange={e => setImageAlt(e.target.value)} maxLength={180} required/></label>
        <label>Başlık<input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} maxLength={180}/></label>
      </> : panel === 'video' ? <>
        <label>Malzeme<select value={materialId} onChange={e => setMaterialId(Number(e.target.value))} required><option value="">Malzeme seçin</option>{materials.data?.materials.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Video (MP4 veya WebM; en fazla 50 MB)<input type="file" accept="video/mp4,video/webm" onChange={e => setVideoFile(e.target.files?.[0] || null)} required/></label>
        <label>Başlık<input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} maxLength={180}/></label>
      </> : panel === 'link' ? <>
        <label>Malzeme<select value={materialId} onChange={e => setMaterialId(Number(e.target.value))} required><option value="">Malzeme seçin</option>{materials.data?.materials.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Başlık<input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} maxLength={180}/></label>
        <label>HTTPS bağlantısı<input type="url" value={externalUrl} onChange={e => setExternalUrl(e.target.value)} pattern="https://.*" maxLength={2048} required/></label>
      </> : <>
        {panel !== 'return' && <label>Malzeme<select value={materialId} onChange={e => setMaterialId(Number(e.target.value))} required><option value="">Malzeme seçin</option>{materials.data?.materials.filter(item => item.isActive && !item.archivedAt).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label>{panel === 'stock' ? 'Miktar (+/-)' : 'Miktar'}<input type="number" step="0.001" min={panel === 'stock' ? undefined : '0.001'} value={amount} onChange={e => setAmount(e.target.value)} readOnly={panel === 'return' && condition !== 'ok'} required/></label>
        {panel === 'stock' && <label>Gerekçe<input value={reason} onChange={e => setReason(e.target.value)} minLength={3} required/></label>}
        {panel === 'loan' && <><label>Ad<input value={firstName} onChange={e => setFirstName(e.target.value)} required/></label><label>Soyad<input value={lastName} onChange={e => setLastName(e.target.value)} required/></label><label>E-posta (isteğe bağlı)<input type="email" value={email} onChange={e => setEmail(e.target.value)}/></label><label>Beklenen iade tarihi (ödünç malzemede zorunlu)<input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} required={materials.data?.materials.find(item => item.id === materialId)?.kind === 'loanable'}/></label><label>Teslim notu<textarea value={loanNotes} onChange={e => setLoanNotes(e.target.value)} maxLength={2000}/></label></>}
        {panel === 'return' && <><label>Durum<select value={condition} onChange={e => { setCondition(e.target.value); if (e.target.value !== 'ok') { const loan = [...(loans.data?.loans || []), ...(history.data?.loans || [])].find(item => item.id === loanId); if (loan) setAmount(String(Number(loan.quantity) - Number(loan.returnedQuantity))); } }}><option value="ok">Sağlam iade</option>{canReportDamage && <option value="damaged">Hasarlı kapat</option>}{canReportLost && <option value="lost">Kayıp kapat</option>}</select></label><label>{condition === 'ok' ? 'İade notu' : 'Hasar veya kayıp açıklaması'}<textarea value={returnNote} onChange={e => setReturnNote(e.target.value)} minLength={condition === 'ok' ? undefined : 3} maxLength={1000} required={condition !== 'ok'}/></label></>}
      </>}
      <ErrorLine error={error}/><Button type="submit" disabled={panel === 'import' && Boolean(importPreview && (!importPreview.validCount || importPreview.errorCount > 0 && !skipImportErrors))}>{panel === 'import' ? importPreview ? 'İçe aktarımı onayla' : 'Önizle' : 'Kaydet'}</Button></form>
    </Sheet>
    <Modal open={archiveTarget !== null} onClose={() => setArchiveTarget(null)} title="Malzeme arşivlensin mi?" action={<Button onClick={async () => { if (!archiveTarget) return; try { await api(`/inventory/${archiveTarget.id}/archive`, { method: 'POST' }); setArchiveTarget(null); reloadMaterials(); } catch (err) { setArchiveTarget(null); setError((err as Error).message); } }}>Arşivle</Button>}><p><strong>{archiveTarget?.name}</strong> katalogdan kaldırılacak ve yeni stok/teslim işlemlerine kapanacak. Önceki hareketler ve açık teslimler korunacak.</p></Modal>
    <Modal open={bulkConfirm} onClose={() => setBulkConfirm(false)} title="Toplu işlem onayı" action={<Button onClick={confirmBulk}>{bulkOperation === 'archive' ? 'Arşivle' : 'Uygula'}</Button>}><p><strong>{selectedMaterials.length} malzeme</strong> için {bulkOperation === 'category' ? 'kategori ataması' : bulkOperation === 'location' ? 'konum ataması' : bulkOperation === 'visibility' ? 'katalog görünürlüğü değişikliği' : 'arşivleme'} yapılacak. Arşivli veya bulunamayan kayıtlar sonuçta ayrı bildirilecek.</p></Modal>
    <Modal open={extendTarget !== null} onClose={() => setExtendTarget(null)} title="Beklenen iade tarihini uzat" action={<Button onClick={extendLoan} disabled={!extendDueAt}>Tarihi kaydet</Button>}><p>Ödünç kaydı #{extendTarget?.id}. Mevcut tarih: {extendTarget?.dueAt ? new Date(extendTarget.dueAt).toLocaleString('tr-TR') : '—'}</p><label>Yeni iade tarihi<input type="datetime-local" value={extendDueAt} onChange={event => setExtendDueAt(event.target.value)} required/></label><ErrorLine error={extendError}/></Modal>
    <Modal open={reverseTarget !== null} onClose={() => setReverseTarget(null)} title="Teslim geri alınsın mı?" action={<Button onClick={reverseLoan} disabled={reverseReason.trim().length < 5}>Teslimi geri al</Button>}><p><strong>#{reverseTarget?.id}</strong> numaralı teslim geri alınacak. Gerekliyse stok için karşı hareket oluşturulacak. Bu işlem yalnız henüz değiştirilmemiş teslimlerde yapılabilir.</p><label>Geri alma gerekçesi<textarea value={reverseReason} onChange={e => setReverseReason(e.target.value)} minLength={5} maxLength={450} required/></label><ErrorLine error={reverseError}/></Modal>
  </Screen>;
}

export function AdminPrinters({ globalRole, permissions }: { globalRole: string; permissions: Permission[] }) {
  type Printer = { id: number; code: string | null; name: string; status: string; description: string | null };
  type Filament = { id: number; name: string; color: string | null; brand: string | null; diameterMm: string; spoolWeightGrams: number | null; nozzleTempMin: number | null; nozzleTempMax: number | null; bedTempMin: number | null; bedTempMax: number | null; technicalNotes: string | null; available: boolean; unavailableReason: string | null };
  const allowed = (permission: Permission) => permissions.includes(permission);
  const printers = useLoad<{ printers: Printer[] }>('/printers/manage/printers', permissions.includes('printers_view') || permissions.includes('printers_manage_schedule'));
  const filaments = useLoad<{ filaments: Filament[] }>('/printers/manage/filaments', permissions.includes('printers_manage_filaments'));
  const appointments = useLoad<{ appointments: { id: number; name: string | null; email: string | null; status: string; startsAt: string | null; durationMinutes: number | null; printerName: string | null }[] }>('/printers/appointments', permissions.includes('appointments_view'));
  const appointmentView = useTableColumns('appointments', appointmentColumns.filter(column => column.key !== 'applicant' || permissions.includes('appointments_view_personal_data')), permissions.includes('appointments_view'), true);
  const canCreatePrinter = allowed('printers_create');
  const canUpdatePrinter = allowed('printers_update');
  const canChangeStatus = allowed('printers_change_status');
  const canManageFilaments = allowed('printers_manage_filaments');
  const canReviewAppointments = allowed('appointments_review');
  const canManageAppointmentStatus = allowed('appointments_manage_status');
  const canDownloadAppointmentFiles = permissions.includes('appointments_view') && permissions.includes('appointments_download_file');
  const canExportAppointments = permissions.includes('appointments_view') && allowed('appointments_export');
  const [panel, setPanel] = useState<'printer' | 'filament' | null>(null); const [editingId, setEditingId] = useState<number | null>(null); const [error, setError] = useState('');
  const [fileTarget, setFileTarget] = useState<number | null>(null);
  const [fileEntries, setFileEntries] = useState<{ id: number; originalName: string; sizeBytes: number; downloadUrl: string }[]>([]);
  const [noteTarget, setNoteTarget] = useState<{ id: number; status: string } | null>(null); const [statusNote, setStatusNote] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [appointmentSearch, setAppointmentSearch] = useState(''); const [appointmentStatus, setAppointmentStatus] = useState('');
  const [originalPrinterCode, setOriginalPrinterCode] = useState(''); const [confirmCodeChange, setConfirmCodeChange] = useState(false); const [savingPrinter, setSavingPrinter] = useState(false);
  const [printer, setPrinter] = useState({ code: '', name: '', status: 'inactive', description: '' });
  const [filament, setFilament] = useState({ name: '', color: '', brand: '', diameterMm: '1.75', spoolWeightGrams: '', nozzleTempMin: '', nozzleTempMax: '', bedTempMin: '', bedTempMax: '', technicalNotes: '', available: true, unavailableReason: '' });
  const startPrinter = (item?: Printer) => { setError(''); setConfirmCodeChange(false); setEditingId(item?.id || null); setOriginalPrinterCode(item?.code || ''); setPrinter({ code: item?.code || '', name: item?.name || '', status: item?.status || 'inactive', description: item?.description || '' }); setPanel('printer'); };
  const startFilament = (item?: Filament) => { setError(''); setEditingId(item?.id || null); setFilament({ name: item?.name || '', color: item?.color || '', brand: item?.brand || '', diameterMm: item?.diameterMm || '1.75', spoolWeightGrams: String(item?.spoolWeightGrams || ''), nozzleTempMin: String(item?.nozzleTempMin || ''), nozzleTempMax: String(item?.nozzleTempMax || ''), bedTempMin: String(item?.bedTempMin || ''), bedTempMax: String(item?.bedTempMax || ''), technicalNotes: item?.technicalNotes || '', available: item?.available ?? true, unavailableReason: item?.unavailableReason || '' }); setPanel('filament'); };
  const optionalNumber = (value: string) => value.trim() ? Number(value) : null;
  const savePrinter = async () => {
    if (savingPrinter) return;
    setSavingPrinter(true); setError('');
    try {
      await api(editingId ? `/printers/manage/printers/${editingId}` : '/printers/manage/printers', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify({ ...printer, description: printer.description || null }) });
      setConfirmCodeChange(false); setPanel(null); printers.reload();
    } catch (err) { setConfirmCodeChange(false); setError((err as Error).message); }
    finally { setSavingPrinter(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      if (panel === 'printer') {
        if (editingId && printer.code !== originalPrinterCode) { setConfirmCodeChange(true); return; }
        await savePrinter();
        return;
      }
      if (panel === 'filament') {
        const body = { name: filament.name, color: filament.color, brand: filament.brand || null, diameterMm: Number(filament.diameterMm), spoolWeightGrams: optionalNumber(filament.spoolWeightGrams), nozzleTempMin: optionalNumber(filament.nozzleTempMin), nozzleTempMax: optionalNumber(filament.nozzleTempMax), bedTempMin: optionalNumber(filament.bedTempMin), bedTempMax: optionalNumber(filament.bedTempMax), technicalNotes: filament.technicalNotes || null, available: filament.available, unavailableReason: filament.available ? null : filament.unavailableReason };
        await api(editingId ? `/printers/manage/filaments/${editingId}` : '/printers/manage/filaments', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(body) });
        filaments.reload();
      }
      setPanel(null);
    } catch (err) { setError((err as Error).message); }
  };
  const changeAppointmentStatus = async (id: number, status: string, note?: string) => {
    setError(''); setStatusMessage('');
    try { const result = await api<{ emailSent?: boolean }>(`/printers/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status, note }) }); setNoteTarget(null); setStatusNote(''); setStatusMessage(result.emailSent === false ? 'Durum güncellendi; bildirim e-postası gönderilemedi.' : result.emailSent === true ? 'Durum güncellendi ve bildirim e-postası gönderildi.' : 'Durum güncellendi.'); appointments.reload(); }
    catch (err) { setError((err as Error).message); }
  };
  const showAppointmentFiles = async (id: number) => {
    if (fileTarget === id) { setFileTarget(null); return; }
    setError('');
    try { const result = await api<{ files: typeof fileEntries }>(`/printers/appointments/${id}/files`); setFileEntries(result.files); setFileTarget(id); }
    catch (err) { setError((err as Error).message); }
  };
  return <Screen title="Yazıcılar ve filamentler" subtitle="Cihaz durumu, filament seçenekleri ve randevular." actions={<>{canCreatePrinter && <Button onClick={() => startPrinter()}>+ Yazıcı</Button>}{canManageFilaments && <Button variant="quiet" onClick={() => startFilament()}>+ Filament</Button>}{canExportAppointments && import.meta.env.VITE_DEMO_MODE !== 'true' && <a className="button button-quiet" href="/api/printers/appointments/export.csv">Randevu CSV indir</a>}</>}>
    <div className="grid">
      {permissions.includes('printers_view') && <Card title="Yazıcılar">{printers.data?.printers.map(item => <div className="list-item resource-row" key={item.id}>
        <div className="resource-copy"><strong>{item.name}</strong><p>{[item.code, item.description].filter(Boolean).join(' · ') || 'Açıklama eklenmedi'}</p></div>
        <div className="resource-actions"><Badge tone={item.status === 'active' ? 'good' : item.status === 'maintenance' ? 'warn' : 'neutral'}>{item.status === 'active' ? 'Aktif' : item.status === 'maintenance' ? 'Bakımda' : 'Pasif'}</Badge>{(canUpdatePrinter || canChangeStatus) && <Button variant="quiet" onClick={() => startPrinter(item)}>Düzenle</Button>}</div>
      </div>)}{!printers.data?.printers.length && <Empty>Yazıcı yok.</Empty>}<ErrorLine error={printers.error}/></Card>}
      {permissions.includes('printers_manage_filaments') && <Card title="Filamentler">{filaments.data?.filaments.map(item => <div className="list-item resource-row" key={item.id}>
        <div className="resource-copy"><strong>{item.name} · {item.color}</strong><p>{[item.brand, `${item.diameterMm} mm`].filter(Boolean).join(' · ')}</p></div>
        <div className="resource-actions"><Badge tone={item.available ? 'good' : 'warn'}>{item.available ? 'Kullanılabilir' : item.unavailableReason || 'Kullanılamıyor'}</Badge>{canManageFilaments && <Button variant="quiet" onClick={() => startFilament(item)}>Düzenle</Button>}</div>
      </div>)}{!filaments.data?.filaments.length && <Empty>Filament yok.</Empty>}<ErrorLine error={filaments.error}/></Card>}
    </div>
    <AdminSchedule globalRole={globalRole} permissions={permissions} printerOptions={printers.data?.printers || []}/>
    {permissions.includes('appointments_view') && <Card title="Randevu başvuruları"><div className="inventory-filters"><label>Arama<input type="search" maxLength={100} value={appointmentSearch} onChange={event => setAppointmentSearch(event.target.value)}/></label><label>Durum<select value={appointmentStatus} onChange={event => setAppointmentStatus(event.target.value)}><option value="">Tümü</option>{Object.entries(appointmentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><SavedFilters table="appointments" current={{ search: appointmentSearch, status: appointmentStatus }} onApply={filters => { setAppointmentSearch(String(filters.search)); setAppointmentStatus(String(filters.status)); }}/>{appointmentView.controls}{statusMessage && <p role="status">{statusMessage}</p>}{error && !noteTarget && <p role="alert">{error}</p>}{appointments.data?.appointments.filter(item => (!appointmentStatus || item.status === appointmentStatus) && (!appointmentSearch.trim() || [item.name, item.email, item.id].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR').includes(appointmentSearch.trim().toLocaleLowerCase('tr-TR')))).map(item => <div className="list-item resource-row" key={item.id}>
      <div className="resource-copy"><strong>Başvuru #{item.id}</strong>{appointmentView.columns.map(column => column === 'applicant' ? <p key={column}>{item.name || 'Başvuru sahibi'}{item.email && <small> · {item.email}</small>}</p> : column === 'starts_at' ? <p key={column}>Başlangıç: {item.startsAt ? new Date(item.startsAt).toLocaleString('tr-TR') : 'Belirtilmedi'}</p> : column === 'duration' ? <small key={column}>Süre: {item.durationMinutes ? `${item.durationMinutes} dakika` : 'Belirtilmedi'}</small> : column === 'printer' ? <small key={column}>Yazıcı: {item.printerName || 'Belirtilmedi'}</small> : <Badge key={column} tone={['approved', 'ready', 'completed'].includes(item.status) ? 'good' : ['rejected', 'failed'].includes(item.status) ? 'bad' : 'neutral'}>{appointmentStatusLabels[item.status] || item.status}</Badge>)}{fileTarget === item.id && <div><strong>Model dosyaları</strong>{fileEntries.length ? fileEntries.map(file => <p key={file.id}>{import.meta.env.VITE_DEMO_MODE === 'true' ? <span>{file.originalName} · örnek modda indirme yok</span> : <a href={file.downloadUrl} download>{file.originalName}</a>} <small>({Math.ceil(file.sizeBytes / 1024)} KB)</small></p>) : <p>İndirilebilir dosya yok.</p>}</div>}</div>
      <div className="resource-actions">{canDownloadAppointmentFiles && <Button variant="quiet" onClick={() => showAppointmentFiles(item.id)}>{fileTarget === item.id ? 'Dosyaları gizle' : 'Dosyalar'}</Button>}{(appointmentTransitions[item.status] || []).filter(status => (reviewStatuses as readonly string[]).includes(status) ? canReviewAppointments : canManageAppointmentStatus).map(status => <Button variant="quiet" key={status} onClick={() => {
        if (['rejected', 'change_requested', 'failed'].includes(status)) { setNoteTarget({ id: item.id, status }); setStatusNote(''); }
        else changeAppointmentStatus(item.id, status);
      }}>{appointmentActionLabels[status] || status}</Button>)}</div>
    </div>)}{!appointments.data?.appointments.length && <Empty>Başvuru yok.</Empty>}<ErrorLine error={appointments.error}/></Card>}
    <Modal open={noteTarget !== null} onClose={() => setNoteTarget(null)} title={noteTarget ? appointmentActionLabels[noteTarget.status] : 'Durum değiştir'} action={<Button disabled={statusNote.trim().length < 3} onClick={() => noteTarget && changeAppointmentStatus(noteTarget.id, noteTarget.status, statusNote)}>Kaydet</Button>}><label>Gerekçe<textarea value={statusNote} onChange={event => setStatusNote(event.target.value)} maxLength={2000} minLength={3} required/></label><ErrorLine error={error}/></Modal>
    <Sheet open={panel !== null} onClose={() => setPanel(null)} title={panel === 'printer' ? editingId ? 'Yazıcıyı düzenle' : 'Yeni yazıcı' : editingId ? 'Filamenti düzenle' : 'Yeni filament'}>
      <form onSubmit={submit}>{panel === 'printer' ? <>
        <label>Yazıcı kodu<input value={printer.code} onChange={e => setPrinter({ ...printer, code: e.target.value.toUpperCase() })} maxLength={20} pattern="[A-Z0-9_-]+" disabled={editingId !== null && !canUpdatePrinter} required/></label>
        <label>Ad<input value={printer.name} onChange={e => setPrinter({ ...printer, name: e.target.value })} maxLength={255} disabled={editingId !== null && !canUpdatePrinter} required/></label>
        <label>Durum<select value={printer.status} disabled={editingId !== null && !canChangeStatus} onChange={e => setPrinter({ ...printer, status: e.target.value })}><option value="active">Aktif</option><option value="maintenance">Bakımda</option><option value="inactive">Pasif</option></select></label>
        <label>Açıklama<textarea value={printer.description} onChange={e => setPrinter({ ...printer, description: e.target.value })} maxLength={1000} disabled={editingId !== null && !canUpdatePrinter}/></label>
      </> : panel === 'filament' ? <>
        <label>Malzeme<input value={filament.name} onChange={e => setFilament({ ...filament, name: e.target.value })} maxLength={40} required/></label>
        <label>Renk<input value={filament.color} onChange={e => setFilament({ ...filament, color: e.target.value })} maxLength={80} required/></label>
        <label>Marka<input value={filament.brand} onChange={e => setFilament({ ...filament, brand: e.target.value })} maxLength={100}/></label>
        <label>Çap (mm)<input type="number" min={1} max={3} step={0.01} value={filament.diameterMm} onChange={e => setFilament({ ...filament, diameterMm: e.target.value })} required/></label>
        <label>Makara ağırlığı (g)<input type="number" min={1} max={10000} value={filament.spoolWeightGrams} onChange={e => setFilament({ ...filament, spoolWeightGrams: e.target.value })}/></label>
        <label>Nozul sıcaklığı alt / üst (°C)<span className="inline-fields"><input type="number" min={100} max={400} value={filament.nozzleTempMin} onChange={e => setFilament({ ...filament, nozzleTempMin: e.target.value })}/><input type="number" min={100} max={400} value={filament.nozzleTempMax} onChange={e => setFilament({ ...filament, nozzleTempMax: e.target.value })}/></span></label>
        <label>Tabla sıcaklığı alt / üst (°C)<span className="inline-fields"><input type="number" min={0} max={200} value={filament.bedTempMin} onChange={e => setFilament({ ...filament, bedTempMin: e.target.value })}/><input type="number" min={0} max={200} value={filament.bedTempMax} onChange={e => setFilament({ ...filament, bedTempMax: e.target.value })}/></span></label>
        <label>Teknik not<textarea value={filament.technicalNotes} onChange={e => setFilament({ ...filament, technicalNotes: e.target.value })} maxLength={2000}/></label>
        <label><input type="checkbox" checked={filament.available} onChange={e => setFilament({ ...filament, available: e.target.checked })}/> Kullanılabilir</label>
        {!filament.available && <label>Kullanılamama nedeni<input value={filament.unavailableReason} onChange={e => setFilament({ ...filament, unavailableReason: e.target.value })} maxLength={500} required/></label>}
      </> : null}<ErrorLine error={error}/><Button type="submit" disabled={savingPrinter}>Kaydet</Button></form>
    </Sheet>
    <Modal open={confirmCodeChange} onClose={() => setConfirmCodeChange(false)} title="Yazıcı kodu değişsin mi?" action={<Button disabled={savingPrinter} onClick={savePrinter}>Kodu değiştir ve kaydet</Button>}><p><strong>{originalPrinterCode}</strong> kodu <strong>{printer.code}</strong> olarak değiştirilecek. Atölyedeki mevcut etiketleri ve kayıtları da yeni kodla güncellemeniz gerekebilir.</p></Modal>
  </Screen>;
}

function AdminSchedule({ globalRole, permissions, printerOptions }: { globalRole: string; permissions: Permission[]; printerOptions: { id: number; name: string }[] }) {
  type Hour = { weekday: number; isOpen: boolean; opensAt: string | null; latestStartAt: string | null };
  type Blackout = { id: number; printerId: number | null; kind: string; isAllDay: boolean; startsAtInput: string; endsAtInput: string; reason: string };
  const canHours = permissions.includes('printers_manage_hours');
  const canSchedule = permissions.includes('printers_manage_schedule');
  const hours = useLoad<{ hours: Hour[] }>('/printers/manage/hours', permissions.includes('printers_manage_hours'));
  const blackouts = useLoad<{ blackouts: Blackout[] }>('/printers/manage/blackouts', permissions.includes('printers_view') || permissions.includes('printers_manage_schedule'));
  const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const [draft, setDraft] = useState<Hour[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [form, setForm] = useState({ printerId: '', kind: 'maintenance', isAllDay: false, startsAt: '', endsAt: '', reason: '' });
  useEffect(() => {
    if (hours.data) setDraft(dayNames.map((_, index) => {
      const row = hours.data?.hours.find(value => value.weekday === index + 1);
      return { weekday: index + 1, isOpen: row?.isOpen ?? false, opensAt: row?.opensAt?.slice(0, 5) ?? '09:00', latestStartAt: row?.latestStartAt?.slice(0, 5) ?? '21:00' };
    }));
  }, [hours.data]);
  const changeHour = (weekday: number, patch: Partial<Hour>) => setDraft(rows => rows.map(row => row.weekday === weekday ? { ...row, ...patch } : row));
  const saveHours = async () => { setError(''); try { await api('/printers/manage/hours', { method: 'PUT', body: JSON.stringify({ hours: draft }) }); hours.reload(); } catch (err) { setError((err as Error).message); } };
  const startBlackout = (row?: Blackout) => { setError(''); setEditing(row?.id ?? null); setForm({ printerId: row?.printerId ? String(row.printerId) : '', kind: row?.kind ?? 'maintenance', isAllDay: row?.isAllDay ?? false, startsAt: row?.startsAtInput ?? '', endsAt: row?.endsAtInput ?? '', reason: row?.reason ?? '' }); setFormOpen(true); };
  const saveBlackout = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      await api(editing ? `/printers/manage/blackouts/${editing}` : '/printers/manage/blackouts', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, printerId: form.printerId ? Number(form.printerId) : null }) });
      setFormOpen(false); blackouts.reload();
    } catch (err) { setError((err as Error).message); }
  };
  const removeBlackout = async () => { if (removeId === null) return; setError(''); try { await api(`/printers/manage/blackouts/${removeId}`, { method: 'DELETE' }); setRemoveId(null); blackouts.reload(); } catch (err) { setError((err as Error).message); } };
  if (!permissions.includes('printers_manage_hours') && !permissions.includes('printers_manage_schedule') && !permissions.includes('printers_view')) return null;
  return <>
    {permissions.includes('printers_manage_hours') && <Card title="Çalışma saatleri"><p>Başlangıç saatleri İstanbul saatine göredir.</p>{draft.map(row => <div className="list-item resource-row" key={row.weekday}>
      <label><input type="checkbox" checked={row.isOpen} disabled={!canHours} onChange={event => changeHour(row.weekday, { isOpen: event.target.checked })}/> {dayNames[row.weekday - 1]}</label>
      <div className="inline-fields"><label>Açılış<input type="time" value={row.opensAt || ''} disabled={!canHours || !row.isOpen} onChange={event => changeHour(row.weekday, { opensAt: event.target.value })}/></label><label>En geç başlangıç<input type="time" value={row.latestStartAt || ''} disabled={!canHours || !row.isOpen} onChange={event => changeHour(row.weekday, { latestStartAt: event.target.value })}/></label></div>
    </div>)}{canHours && <Button onClick={saveHours} disabled={draft.length !== 7}>Saatleri kaydet</Button>}<ErrorLine error={hours.error || error}/></Card>}
    {(permissions.includes('printers_view') || permissions.includes('printers_manage_schedule')) && <Card title="Kapalı zamanlar">{canSchedule && <Button variant="quiet" onClick={() => startBlackout()}>+ Kapalı zaman</Button>}
      {blackouts.data?.blackouts.map(row => <div className="list-item resource-row" key={row.id}><div className="resource-copy"><strong>{row.kind === 'maintenance' ? 'Bakım' : row.kind === 'busy' ? 'Dolu' : 'Kapalı'} · {row.printerId ? printerOptions.find(printer => printer.id === row.printerId)?.name ?? `Yazıcı #${row.printerId}` : 'Tüm atölye'}</strong><p>{row.startsAtInput.replace('T', ' ')} – {row.endsAtInput.replace('T', ' ')} · {row.reason}</p></div>{canSchedule && <div className="resource-actions"><Button variant="quiet" onClick={() => startBlackout(row)}>Düzenle</Button><Button variant="quiet" onClick={() => setRemoveId(row.id)}>Sil</Button></div>}</div>)}
      {!blackouts.data?.blackouts.length && <Empty>Kapalı zaman kaydı yok.</Empty>}<ErrorLine error={blackouts.error || error}/>
    </Card>}
    <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Kapalı zamanı düzenle' : 'Yeni kapalı zaman'}><form onSubmit={saveBlackout}>
      <label>Yazıcı<select value={form.printerId} onChange={event => setForm({ ...form, printerId: event.target.value })}><option value="">Tüm atölye</option>{printerOptions.map(printer => <option value={printer.id} key={printer.id}>{printer.name}</option>)}</select></label>
      <label>Tür<select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value })}><option value="maintenance">Bakım</option><option value="busy">Dolu</option><option value="closed">Kapalı</option></select></label>
      <label><input type="checkbox" checked={form.isAllDay} onChange={event => setForm({ ...form, isAllDay: event.target.checked, startsAt: '', endsAt: '' })}/> Tüm gün</label>
      <label>Başlangıç<input type={form.isAllDay ? 'date' : 'datetime-local'} value={form.startsAt} onChange={event => setForm({ ...form, startsAt: event.target.value })} required/></label>
      <label>Bitiş<input type={form.isAllDay ? 'date' : 'datetime-local'} value={form.endsAt} onChange={event => setForm({ ...form, endsAt: event.target.value })} required/></label>
      <label>Gerekçe<input value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} maxLength={255} required/></label><ErrorLine error={error}/><Button type="submit">Kaydet</Button>
    </form></Sheet>
    <Modal open={removeId !== null} onClose={() => setRemoveId(null)} title="Kapalı zamanı sil" action={<Button onClick={removeBlackout}>Kaydı sil</Button>}><p>Bu kapalı zaman kaydı silinecek. İlgili saatler yeniden müsait görünebilir.</p><ErrorLine error={error}/></Modal>
  </>;
}

export function AdminMembers({ currentUserId, globalRole, permissions }: { currentUserId: number; globalRole: string; permissions: Permission[] }) {
  type Member = { id: number; name: string; email: string | null; globalRole: string; isActive: boolean; roleIds: number[]; memberships: { unitId: number; role: string }[] };
  type Role = { id: number; name: string; description?: string | null; createdAt: string; userCount: number; tabs: Tab[]; permissions: Permission[]; roomIds: number[]; generalAccess: boolean; isProtected?: boolean; isSystem?: boolean; legacySlug?: string | null; legacyPermissionKeys?: string[] | null };
  const canViewMembers = permissions.includes('users_view');
  const userView = useTableColumns('users', userColumns, canViewMembers);
  const [userSort, setUserSort] = useState<'name' | 'email' | 'is_active' | 'created_at'>('name');
  const [userDirection, setUserDirection] = useState<'asc' | 'desc'>('asc');
  const members = useLoad<{ members: Member[] }>(`/org/members?user_sort=${userSort}&user_direction=${userDirection}`, canViewMembers);
  const units = useLoad<{ units: Unit[] }>('/org/units');
  const canAdmin = globalRole === 'super_admin';
  const canAssignRoles = permissions.includes('roles_assign');
  const canCreateRole = permissions.includes('roles_create');
  const canUpdateRole = permissions.includes('roles_update');
  const canDeleteRole = permissions.includes('roles_delete');
  const canCreateUser = permissions.includes('users_create') && canAssignRoles;
  const canUpdateUser = permissions.includes('users_update');
  const canDisable = permissions.includes('users_disable');
  const canResetPassword = permissions.includes('users_reset_password');
  const canManageUnits = permissions.includes('units_manage');
  const canEdit = canAdmin || canManageUnits || canUpdateUser || canAssignRoles;
  const [roleSort, setRoleSort] = useState<'name' | 'users_count' | 'created_at'>('name');
  const [roleDirection, setRoleDirection] = useState<'asc' | 'desc'>('asc');
  const roles = useLoad<{ roles: Role[] }>(`/org/roles?role_sort=${roleSort}&role_direction=${roleDirection}`, permissions.includes('roles_view') || canAssignRoles);
  const [panel, setPanel] = useState<'activation' | 'create' | 'role' | 'member' | 'unit' | null>(null);
  const [role, setRole] = useState('member'); const [unitId, setUnitId] = useState(0); const [activationRoleId, setActivationRoleId] = useState(0);
  const [code, setCode] = useState(''); const [error, setError] = useState('');
  const [selected, setSelected] = useState<Member | null>(null);
  const [statusTarget, setStatusTarget] = useState<Member | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Member | null>(null);
  const [replacementPassword, setReplacementPassword] = useState('');
  const [memberRole, setMemberRole] = useState('member'); const [roleIds, setRoleIds] = useState<number[]>([]);
  const [memberName, setMemberName] = useState(''); const [memberEmail, setMemberEmail] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [roleDeleteTarget, setRoleDeleteTarget] = useState<Role | null>(null);
  const [roleDraft, setRoleDraft] = useState<{ name: string; description: string; tabs: Tab[]; permissions: Permission[]; roomIds: number[]; generalAccess: boolean }>({ name: '', description: '', tabs: [...TABS], permissions: [], roomIds: [], generalAccess: false });
  const canEditSelectedRoles = Boolean(selected && (selected.globalRole !== 'super_admin' || selected.roleIds.some(id => roles.data?.roles.some(role => role.id === id && role.isSystem))));
  const [unitName, setUnitName] = useState(''); const [parentId, setParentId] = useState(0); const [isRoom, setIsRoom] = useState(false);
  const open = (next: typeof panel) => { setError(''); setPanel(next); };
  const startCreate = () => { setMemberName(''); setMemberEmail(''); setReplacementPassword(''); setRoleIds([]); open('create'); };
  const startRole = (item?: Role) => { setEditingRoleId(item?.id || null); setRoleDraft(item ? { name: item.name, description: item.description || '', tabs: item.tabs, permissions: item.permissions, roomIds: item.roomIds, generalAccess: item.generalAccess } : { name: '', description: '', tabs: [...TABS], permissions: [], roomIds: [], generalAccess: false }); open('role'); };
  const editMember = (person: Member) => {
    setSelected(person); setUnitId(person.memberships[0]?.unitId || 0);
    setMemberRole(canAdmin ? person.memberships[0]?.role || 'member' : 'member'); setRoleIds(person.roleIds); setMemberName(person.name); setMemberEmail(person.email || '');
    open('member');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      if (panel === 'role') {
        await api(editingRoleId ? `/org/roles/${editingRoleId}` : '/org/roles', { method: editingRoleId ? 'PUT' : 'POST', body: JSON.stringify(roleDraft) });
        roles.reload(); setPanel(null); return;
      }
      if (panel === 'create') {
        await api('/org/members', { method: 'POST', body: JSON.stringify({ name: memberName, email: memberEmail, password: replacementPassword, roleIds }) });
        setMemberName(''); setMemberEmail(''); setReplacementPassword(''); setRoleIds([]); members.reload(); setPanel(null); return;
      }
      if (panel === 'activation') {
        const data = await api<{ code: string }>('/org/activation-codes', { method: 'POST', body: JSON.stringify({ role, unitId: unitId || null, customRoleId: activationRoleId }) });
        setCode(data.code); return;
      }
      if (panel === 'unit') {
        await api('/org/units', { method: 'POST', body: JSON.stringify({ name: unitName, parentId: parentId || null, isRoom, isGeneral: false }) });
        setUnitName(''); setParentId(0); setIsRoom(false); units.reload();
      }
      if (panel === 'member' && selected) {
        if (unitId && canManageUnits) await api(`/org/members/${selected.id}/units/${unitId}`, { method: 'PUT', body: JSON.stringify({ role: memberRole }) });
        if (canAssignRoles && canEditSelectedRoles) await api(`/org/members/${selected.id}/role`, { method: 'PATCH', body: JSON.stringify({ roleIds }) });
        if (canUpdateUser && (memberName !== selected.name || memberEmail !== selected.email)) {
          const updated = await api<{ loginRequired: boolean }>(`/org/members/${selected.id}/profile`, { method: 'PATCH', body: JSON.stringify({ name: memberName, email: memberEmail }) });
          if (selected.id === currentUserId && updated.loginRequired) { location.assign('/giris'); return; }
        }
        members.reload();
      }
      setPanel(null);
    } catch (err) { setError((err as Error).message); }
  };
  const saveStatus = async () => {
    if (!statusTarget) return;
    try {
      await api(`/org/members/${statusTarget.id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive: !statusTarget.isActive }) });
      setStatusTarget(null); setError(''); members.reload();
    } catch (err) { setError((err as Error).message); }
  };
  const resetMemberPassword = async () => {
    if (!passwordTarget) return;
    try {
      await api(`/org/members/${passwordTarget.id}/password`, { method: 'PATCH', body: JSON.stringify({ newPassword: replacementPassword }) });
      setPasswordTarget(null); setReplacementPassword(''); setError('');
    } catch (err) { setError((err as Error).message); }
  };
  const deleteRole = async () => {
    if (!roleDeleteTarget) return;
    try { await api(`/org/roles/${roleDeleteTarget.id}`, { method: 'DELETE' }); setRoleDeleteTarget(null); setError(''); roles.reload(); }
    catch (err) { setError((err as Error).message); }
  };
  return <Screen title="Üyeler" subtitle="Birimler, roller ve aktivasyon." actions={<>
    {canCreateUser && <Button onClick={() => { setCode(''); setUnitId(0); setActivationRoleId(0); open('activation'); }}>+ Aktivasyon kodu</Button>}
    {canCreateUser && <Button variant="quiet" onClick={startCreate}>+ Kullanıcı</Button>}
    {canCreateRole && <Button variant="quiet" onClick={() => startRole()}>+ Özel rol</Button>}
    {canManageUnits && <Button variant="quiet" onClick={() => open('unit')}>+ Birim / oda</Button>}
  </>}>
    {canViewMembers && <Card title="Üye listesi"><div className="form-row"><label>Sıralama<select value={userSort} onChange={event => setUserSort(event.target.value as typeof userSort)}><option value="name">Ad</option><option value="email">E-posta</option><option value="is_active">Hesap durumu</option><option value="created_at">Kayıt tarihi</option></select></label><label>Yön<select value={userDirection} onChange={event => setUserDirection(event.target.value as typeof userDirection)}><option value="asc">Artan</option><option value="desc">Azalan</option></select></label></div>{userView.controls}{members.data?.members.map(person => <MemberCard key={person.id} name={userView.visible('name') ? person.name : `Üye #${person.id}`} unit={person.memberships.map(m => units.data?.units.find(u => u.id === m.unitId)?.name || `#${m.unitId}`).join(', ') || 'Birim yok'} role={userView.visible('roles') ? person.globalRole : ''} email={userView.visible('email') ? person.email : null} action={<>{userView.visible('status') && <Badge tone={person.isActive ? 'good' : 'neutral'}>{person.isActive ? 'Aktif' : 'Pasif'}</Badge>}{canEdit && <Button variant="quiet" onClick={() => editMember(person)}>Düzenle</Button>}{canDisable && (globalRole === 'super_admin' || person.globalRole !== 'super_admin') && <Button variant="quiet" onClick={() => { setError(''); setStatusTarget(person); }}>{person.isActive ? 'Pasifleştir' : 'Etkinleştir'}</Button>}{canResetPassword && person.id !== currentUserId && (globalRole === 'super_admin' || person.globalRole !== 'super_admin') && <Button variant="quiet" onClick={() => { setError(''); setReplacementPassword(''); setPasswordTarget(person); }}>Parola sıfırla</Button>}</>}/>)}{!members.data?.members.length && <Empty>Üye yok.</Empty>}<ErrorLine error={members.error}/></Card>}
    {permissions.includes('roles_view') && <Card title="Özel roller"><div className="form-row"><label>Sıralama<select value={roleSort} onChange={event => setRoleSort(event.target.value as typeof roleSort)}><option value="name">Ad</option><option value="users_count">Kullanıcı sayısı</option><option value="created_at">Oluşturulma tarihi</option></select></label><label>Yön<select value={roleDirection} onChange={event => setRoleDirection(event.target.value as typeof roleDirection)}><option value="asc">Artan</option><option value="desc">Azalan</option></select></label></div>{roles.data?.roles.map(item => <div className="list-item resource-row" key={item.id}><div className="resource-copy"><strong>{item.name}</strong><p>{item.permissions.length} etkin izin · {item.tabs.length} sekme · {item.userCount} kullanıcı{item.isProtected ? ' · Korunan rol' : ''}</p>{item.description && <p>{item.description}</p>}{item.legacySlug && <small>V1: {item.legacySlug} · {item.legacyPermissionKeys?.length || 0} kaynak izin</small>}</div><div className="resource-actions">{canUpdateRole && !item.isProtected && <Button variant="quiet" onClick={() => startRole(item)}>Düzenle</Button>}{canDeleteRole && !item.isProtected && <Button variant="quiet" onClick={() => { setError(''); setRoleDeleteTarget(item); }}>Sil</Button>}</div></div>)}{roles.data && !roles.data.roles.length && <Empty>Özel rol yok.</Empty>}<ErrorLine error={roles.error}/></Card>}
    <Card title="Birimler ve odalar"><div className="unit-grid">{units.data?.units.map(unit => <div className="unit-tile" key={unit.id}>{unit.name}</div>)}</div>{!units.data?.units.length && <Empty>Birim yok.</Empty>}<ErrorLine error={units.error}/></Card>
    <Sheet open={panel !== null} onClose={() => setPanel(null)} title={panel === 'activation' ? 'Aktivasyon kodu' : panel === 'create' ? 'Yeni kullanıcı' : panel === 'role' ? editingRoleId ? 'Özel rolü düzenle' : 'Yeni özel rol' : panel === 'member' ? `${selected?.name || 'Üye'} · birim ve rol` : 'Yeni birim / oda'}>
      <form onSubmit={submit}>
        {panel === 'role' && <>
          <label>Rol adı<input value={roleDraft.name} onChange={e => setRoleDraft({ ...roleDraft, name: e.target.value })} minLength={2} maxLength={120} required/></label>
          <label>Açıklama<textarea value={roleDraft.description} onChange={e => setRoleDraft({ ...roleDraft, description: e.target.value })} maxLength={2000}/></label>
          <fieldset><legend>Sekmeler</legend>{TABS.map(tab => <label key={tab}><input type="checkbox" checked={roleDraft.tabs.includes(tab)} onChange={e => setRoleDraft(current => ({ ...current, tabs: e.target.checked ? [...current.tabs, tab] : current.tabs.filter(value => value !== tab) }))}/>{tabLabels[tab]}</label>)}</fieldset>
          <fieldset><legend>İzinler</legend>{PERMISSIONS.map(permission => <label key={permission}><input type="checkbox" checked={roleDraft.permissions.includes(permission)} onChange={e => setRoleDraft(current => ({ ...current, permissions: e.target.checked ? [...current.permissions, permission] : current.permissions.filter(value => value !== permission) }))}/>{permissionLabels[permission]}</label>)}</fieldset>
          <fieldset><legend>Odalar</legend>{units.data?.units.filter(unit => unit.isRoom).map(unit => <label key={unit.id}><input type="checkbox" checked={roleDraft.roomIds.includes(unit.id)} onChange={e => setRoleDraft(current => ({ ...current, roomIds: e.target.checked ? [...current.roomIds, unit.id] : current.roomIds.filter(value => value !== unit.id) }))}/>{unit.name}</label>)}</fieldset>
          <label><input type="checkbox" checked={roleDraft.generalAccess} onChange={e => setRoleDraft({ ...roleDraft, generalAccess: e.target.checked })}/> Genel kanala erişim</label>
        </>}
        {panel === 'create' && <>
          <label>Ad<input value={memberName} onChange={e => setMemberName(e.target.value)} minLength={2} maxLength={120} required/></label>
          <label>E-posta<input type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} maxLength={255} required/></label>
          <label>Başlangıç parolası<input type="password" autoComplete="new-password" value={replacementPassword} onChange={e => setReplacementPassword(e.target.value)} minLength={12} maxLength={256} required/></label>
          <p className="muted">Parola en az 12 karakter, büyük/küçük harf ve rakam içermeli. Kullanıcıya güvenli yoldan iletin.</p>
          <fieldset><legend>Özel roller</legend>{roles.data?.roles.filter(item => canAdmin || !item.isSystem).map(item => <label key={item.id}><input type="checkbox" checked={roleIds.includes(item.id)} onChange={e => setRoleIds(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))}/>{item.name}{item.isSystem ? ' · Sistem yöneticisi' : ''}</label>)}</fieldset>
        </>}
        {panel === 'activation' && <>
          <label>Rol<select value={role} onChange={e => setRole(e.target.value)}><option value="member">Üye</option>{canAdmin && <><option value="lead">Sorumlu</option><option value="advisor">Hoca</option></>}</select></label>
          <label>Yetki rolü<select value={activationRoleId} onChange={e => setActivationRoleId(Number(e.target.value))} required><option value={0}>Rol seçin</option>{roles.data?.roles.filter(item => !item.isSystem).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Birim<select value={unitId} onChange={e => setUnitId(Number(e.target.value))}><option value={0}>Birim seçilmedi</option>{units.data?.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
          {code && <p role="status" className="code-result">Tek kullanımlık kod: <strong>{code}</strong><br/>Bu kodu güvenli yoldan iletin; yeniden görüntülenmez.</p>}
        </>}
        {panel === 'unit' && <>
          <label>Birim veya oda adı<input value={unitName} onChange={e => setUnitName(e.target.value)} maxLength={120} required/></label>
          <label>Üst birim<select value={parentId} onChange={e => setParentId(Number(e.target.value))} required={!canAdmin}><option value={0}>Üst birim yok</option>{units.data?.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
          {canAdmin && <label><input type="checkbox" checked={isRoom} onChange={e => setIsRoom(e.target.checked)}/> Bağımsız oda</label>}
        </>}
        {panel === 'member' && <>
          {canUpdateUser && <><label>Ad<input value={memberName} onChange={e => setMemberName(e.target.value)} minLength={2} maxLength={120} required/></label><label>E-posta<input type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} maxLength={255} required/></label></>}
          {canManageUnits && <><label>Birim<select value={unitId} onChange={e => setUnitId(Number(e.target.value))}><option value={0}>Birim seçilmedi</option>{units.data?.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
          <label>Birim rolü<select value={memberRole} onChange={e => setMemberRole(e.target.value)}><option value="member">Üye</option>{canAdmin && <><option value="lead">Sorumlu</option><option value="advisor">Hoca</option></>}</select></label></>}
          {canAssignRoles && selected && canEditSelectedRoles && <fieldset><legend>Özel roller</legend>{roles.data?.roles.filter(item => canAdmin || !item.isSystem).map(item => <label key={item.id}><input type="checkbox" checked={roleIds.includes(item.id)} onChange={e => setRoleIds(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))}/>{item.name}</label>)}{!roles.data?.roles.length && <p>Özel rol yok.</p>}</fieldset>}
        </>}
        <ErrorLine error={error}/><Button type="submit">{panel === 'activation' ? 'Kod oluştur' : 'Kaydet'}</Button>
      </form>
    </Sheet>
    <Modal open={statusTarget !== null} onClose={() => setStatusTarget(null)} title={statusTarget?.isActive ? 'Hesap pasifleştirilsin mi?' : 'Hesap etkinleştirilsin mi?'} action={<Button onClick={saveStatus}>{statusTarget?.isActive ? 'Pasifleştir' : 'Etkinleştir'}</Button>}><p>{statusTarget?.name} hesabının durumu değiştirilecek. Pasifleştirilen hesabın açık oturumları kapatılır.</p><ErrorLine error={error}/></Modal>
    <Modal open={passwordTarget !== null} onClose={() => { setPasswordTarget(null); setReplacementPassword(''); }} title="Kullanıcı parolasını sıfırla" action={<Button onClick={resetMemberPassword}>Parolayı değiştir</Button>}><p>{passwordTarget?.name} için yeni parolayı girin. Açık oturumlar kapatılır.</p><label>Yeni parola<input type="password" autoComplete="new-password" minLength={12} maxLength={256} value={replacementPassword} onChange={e => setReplacementPassword(e.target.value)}/></label><ErrorLine error={error}/></Modal>
    <Modal open={roleDeleteTarget !== null} onClose={() => setRoleDeleteTarget(null)} title="Özel rol silinsin mi?" action={<Button onClick={deleteRole}>Rolü sil</Button>}><p><strong>{roleDeleteTarget?.name}</strong> silinecek. Kullanıcıya atanmış rol önce atamalardan kaldırılmalıdır.</p><ErrorLine error={error}/></Modal>
  </Screen>;
}

export function AdminAnnouncements({ permissions }: { permissions: Permission[] }) {
  type Announcement = {
    id: number; title: string; body: string; audience: 'public' | 'internal' | 'both';
    type: 'info' | 'warning' | 'maintenance' | 'urgent'; placement: 'all' | 'home' | 'printers';
    isPublished: boolean; startsAt: string | null; endsAt: string | null;
    unitId: number | null; pinned: boolean; requiresAcknowledgement: boolean; roleIds: number[];
  };
  const canPublic = permissions.includes('announcements_create');
  const canStaff = permissions.includes('staff_announcements_create');
  const allowed = (item: Announcement, action: 'update' | 'archive') =>
    (item.audience === 'internal' || permissions.includes(`announcements_${action}`)) &&
    (item.audience === 'public' || permissions.includes(`staff_announcements_${action}`));
  const data = useLoad<{ announcements: Announcement[] }>('/announce/manage', permissions.includes('announcements_view') || permissions.includes('staff_announcements_view'));
  const units = useLoad<{ units: Unit[] }>('/org/units');
  const targets = useLoad<{ roles: { id: number; name: string }[] }>('/announce/targets',
    ['staff_announcements_create', 'staff_announcements_update', 'staff_announcements_archive'].some(permission => permissions.includes(permission as Permission)));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [removing, setRemoving] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Announcement['audience']>('public');
  const [type, setType] = useState<Announcement['type']>('info');
  const [placement, setPlacement] = useState<Announcement['placement']>('all');
  const [isPublished, setIsPublished] = useState(true);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [unitId, setUnitId] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false);
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const localTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(' ', 'T') : '';
  const start = (item?: Announcement) => {
    setEditing(item || null); setTitle(item?.title || ''); setBody(item?.body || '');
    setAudience(item?.audience || (canStaff ? 'internal' : 'public'));
    setType(item?.type || 'info'); setPlacement(item?.placement || 'all'); setIsPublished(item?.isPublished ?? true);
    setStartsAt(localTime(item?.startsAt)); setEndsAt(localTime(item?.endsAt));
    setUnitId(item?.unitId || 0); setPinned(item?.pinned || false);
    setRequiresAcknowledgement(item?.requiresAcknowledgement || false); setRoleIds(item?.roleIds || []);
    setError(''); setOpen(true);
  };
  const canChoose = (value: Announcement['audience']) => editing
    ? editing.audience === value || allowed({ ...editing, audience: value }, 'update')
    : value === 'public' ? canPublic : value === 'internal' ? canStaff : canPublic && canStaff;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api(editing ? `/announce/${editing.id}` : '/announce', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({ title, body, audience, type, placement, isPublished, startsAt: startsAt || null, endsAt: endsAt || null,
          unitId: unitId || null, pinned, requiresAcknowledgement: audience !== 'public' && requiresAcknowledgement,
          roleIds: audience === 'public' ? [] : roleIds }),
      });
      setOpen(false); data.reload();
    } catch (cause) { setError((cause as Error).message); }
  };
  const remove = async () => {
    if (!removing) return;
    try { await api(`/announce/${removing.id}`, { method: 'DELETE' }); setRemoving(null); setError(''); data.reload(); }
    catch (cause) { setError((cause as Error).message); }
  };
  return <Screen title="Duyuru merkezi" subtitle="Kamu ve iç duyurular."
    actions={(canPublic || canStaff) && <Button onClick={() => start()}>+ Duyuru</Button>}>
    <Card>{data.data?.announcements.map(item => <div className="list-item resource-row" key={item.id}>
      <div className="resource-copy"><strong>{item.title}</strong><p>{item.body}</p>
        <small>{item.audience === 'public' ? 'Kamu' : item.audience === 'internal' ? 'Yönetim' : 'Her ikisi'} · {item.isPublished ? 'Yayında' : 'Taslak'}</small>
      </div>
      <div className="resource-actions">{allowed(item, 'update') && <Button variant="quiet" onClick={() => start(item)}>Düzenle</Button>}
        {allowed(item, 'archive') && <Button variant="quiet" onClick={() => { setError(''); setRemoving(item); }}>Kaldır</Button>}</div>
    </div>)}{data.data && !data.data.announcements.length && <Empty>Duyuru yok.</Empty>}<ErrorLine error={data.error}/></Card>
    <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Duyuruyu düzenle' : 'Yeni duyuru'}>
      <form onSubmit={submit}>
        <label>Başlık<input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} required/></label>
        <label>Metin<textarea value={body} onChange={event => setBody(event.target.value)} maxLength={1000} required/></label>
        <label>Tür<select value={type} onChange={event => setType(event.target.value as Announcement['type'])}><option value="info">Bilgi</option><option value="warning">Uyarı</option><option value="maintenance">Bakım</option><option value="urgent">Acil</option></select></label>
        <label>Gösterim yeri<select value={placement} onChange={event => setPlacement(event.target.value as Announcement['placement'])}><option value="all">Her yer</option><option value="home">Ana sayfa</option><option value="printers">Yazıcılar</option></select></label>
        <label>Hedef<select value={audience} onChange={event => setAudience(event.target.value as Announcement['audience'])}>
          {canChoose('internal') && <option value="internal">Yönetim</option>}{canChoose('public') && <option value="public">Kamu</option>}{canChoose('both') && <option value="both">Her ikisi</option>}
        </select></label>
        <label>Başlangıç<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)}/></label>
        <label>Bitiş<input type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)}/></label>
        <label>Birim<select value={unitId} onChange={event => setUnitId(Number(event.target.value))}><option value={0}>Tüm birimler</option>{units.data?.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
        {audience !== 'public' && <><label><input type="checkbox" checked={requiresAcknowledgement} onChange={event => setRequiresAcknowledgement(event.target.checked)}/> Okundu onayı iste</label>
          <fieldset><legend>Hedef roller</legend><small>Rol seçilmezse tüm yetkili personele gösterilir.</small>
            {targets.data?.roles.map(role => <label key={role.id}><input type="checkbox" checked={roleIds.includes(role.id)} onChange={event => setRoleIds(current => event.target.checked ? [...current, role.id] : current.filter(id => id !== role.id))}/>{role.name}</label>)}
          </fieldset></>}
        <label><input type="checkbox" checked={pinned} onChange={event => setPinned(event.target.checked)}/> Sabitle</label>
        <label><input type="checkbox" checked={isPublished} onChange={event => setIsPublished(event.target.checked)}/> Yayında</label>
        <ErrorLine error={error}/><Button type="submit">Kaydet</Button>
      </form>
    </Sheet>
    <Modal open={removing !== null} onClose={() => setRemoving(null)} title="Duyuru kaldırılsın mı?" action={<Button onClick={remove}>Kaldır</Button>}>
      <p><strong>{removing?.title}</strong> yayından kaldırılacak.</p><ErrorLine error={error}/>
    </Modal>
  </Screen>;
}

export function AdminFeedback({ permissions }: { permissions: Permission[] }) {
  type Feedback = { id: number; kind: string; message: string; status: string; adminNote: string | null; createdAt: string; handledAt: string | null; handledBy: number | null; handlerName: string | null; imageUrl?: string | null; imageOriginalName?: string | null };
  const feedbackView = useTableColumns('feedback', feedbackColumns, permissions.includes('feedback_view'));
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const reports = useLoad<{ feedbacks: Feedback[]; total: number; pageSize: number }>(`/feedback?page=${page}${status ? `&status=${status}` : ''}`, permissions.includes('feedback_view'));
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [nextStatus, setNextStatus] = useState('new');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    try { await api(`/feedback/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, adminNote: note.trim() || null }) }); setSelected(null); setError(''); reports.reload(); }
    catch (cause) { setError((cause as Error).message); }
  };
  const statusText: Record<string, string> = { new: 'Yeni', reviewing: 'İnceleniyor', resolved: 'Çözüldü', archived: 'Arşivlendi' };
  const kindText: Record<string, string> = { suggestion: 'Öneri', complaint: 'Şikâyet', bug: 'Hata' };
  return <Screen title="Geri bildirimler" subtitle="Öneri, şikâyet ve hata bildirimleri."><Card title="Talepler">
    <label>Durum<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Tümü</option><option value="open">Açık</option><option value="new">Yeni</option><option value="reviewing">İnceleniyor</option><option value="resolved">Çözüldü</option><option value="archived">Arşivlendi</option></select></label><SavedFilters table="feedback" current={{ status }} onApply={filters => { setStatus(String(filters.status)); setPage(1); }}/>{feedbackView.controls}
    {reports.data?.feedbacks.map(item => <div className="list-item resource-row" key={item.id}><div className="resource-copy"><strong>#{item.id}{feedbackView.visible('type') ? ` · ${kindText[item.kind] || item.kind}` : ''}</strong>{feedbackView.visible('message') && <p>{item.message}</p>}{item.imageUrl && <p><a href={item.imageUrl} target="_blank" rel="noopener noreferrer">Ekli görseli aç{item.imageOriginalName ? ` · ${item.imageOriginalName}` : ''}</a></p>}{feedbackView.visible('created_at') && <small>{new Date(item.createdAt).toLocaleString('tr-TR')}</small>}{feedbackView.visible('handler') && item.handledBy && <small>İşlem yapan: {item.handlerName || `#${item.handledBy}`}</small>}{item.adminNote && <small>Yönetici notu: {item.adminNote}</small>}</div><div className="resource-actions">{feedbackView.visible('status') && <Badge tone={item.status === 'resolved' ? 'good' : item.status === 'archived' ? 'neutral' : 'warn'}>{statusText[item.status] || item.status}</Badge>}{permissions.includes('feedback_update') && <Button variant="quiet" onClick={() => { setSelected(item); setNextStatus(item.status); setNote(item.adminNote || ''); setError(''); }}>Düzenle</Button>}</div></div>)}
    {reports.data && !reports.data.feedbacks.length && <Empty>Bu durumda geri bildirim yok.</Empty>}
    {reports.data && reports.data.total > reports.data.pageSize && <div className="resource-actions"><Button variant="quiet" disabled={page <= 1} onClick={() => setPage(page - 1)}>Önceki</Button><span>{page} / {Math.ceil(reports.data.total / reports.data.pageSize)}</span><Button variant="quiet" disabled={page * reports.data.pageSize >= reports.data.total} onClick={() => setPage(page + 1)}>Sonraki</Button></div>}
    <ErrorLine error={reports.error}/>
  </Card><Sheet open={selected !== null} onClose={() => setSelected(null)} title="Geri bildirimi düzenle"><form onSubmit={save}><label>Durum<select value={nextStatus} onChange={event => setNextStatus(event.target.value)}><option value="new">Yeni</option><option value="reviewing">İnceleniyor</option><option value="resolved">Çözüldü</option><option value="archived">Arşivlendi</option></select></label><label>Yönetici notu<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={3000}/></label><ErrorLine error={error}/><Button type="submit">Kaydet</Button></form></Sheet></Screen>;
}

export function AdminWorkshop({ permissions }: { permissions: Permission[] }) {
  type Day = { weekday: number; isOpen: boolean; opensAt: string | null; latestStartAt: string | null };
  const data = useLoad<{ contact: { phone: string; whatsapp: string; email: string; contactHours: string }; hours: Day[] }>('/workshop', permissions.includes('workshop_settings_update'));
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [contactHours, setContactHours] = useState('');
  const [hours, setHours] = useState<Day[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!data.data) return;
    setPhone(data.data.contact.phone); setWhatsapp(data.data.contact.whatsapp);
    setEmail(data.data.contact.email); setContactHours(data.data.contact.contactHours);
    setHours(data.data.hours);
  }, [data.data]);
  const markDirty = () => { setSaved(false); setError(''); };
  const changeDay = (weekday: number, patch: Partial<Day>) => { markDirty(); setHours(current => current.map(day => day.weekday === weekday ? { ...day, ...patch } : day)); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api('/workshop', { method: 'PUT', body: JSON.stringify({ phone, whatsapp, email, contactHours, hours }) });
      setError(''); setSaved(true); data.reload();
    } catch (cause) { setSaved(false); setError((cause as Error).message); }
  };
  const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  return <Screen title="Atölye ve iletişim" subtitle="İletişim bilgileri ve çalışma saatleri.">
    <Card><form onSubmit={save}>
      <label>Telefon<input type="tel" value={phone} onChange={event => { markDirty(); setPhone(event.target.value); }} maxLength={30}/></label>
      <label>WhatsApp<input type="tel" value={whatsapp} onChange={event => { markDirty(); setWhatsapp(event.target.value); }} maxLength={30}/></label>
      <label>E-posta<input type="email" value={email} onChange={event => { markDirty(); setEmail(event.target.value); }} maxLength={255}/></label>
      <label>İletişim saatleri<input value={contactHours} onChange={event => { markDirty(); setContactHours(event.target.value); }} maxLength={120}/></label>
      <fieldset><legend>Çalışma saatleri</legend>{hours.map(day => <div className="list-item resource-row" key={day.weekday}>
        <label><input type="checkbox" checked={day.isOpen} onChange={event => changeDay(day.weekday, { isOpen: event.target.checked, opensAt: event.target.checked ? day.opensAt || '09:00' : null, latestStartAt: event.target.checked ? day.latestStartAt || '17:00' : null })}/>{dayNames[day.weekday - 1]}</label>
        {day.isOpen && <div className="resource-actions"><label>Açılış<input type="time" value={day.opensAt || ''} onChange={event => changeDay(day.weekday, { opensAt: event.target.value })} required/></label>
          <label>Son başlangıç<input type="time" value={day.latestStartAt || ''} onChange={event => changeDay(day.weekday, { latestStartAt: event.target.value })} required/></label></div>}
      </div>)}</fieldset>
      <ErrorLine error={error || data.error}/>{saved && <p role="status">Ayarlar kaydedildi.</p>}
      <Button type="submit">Kaydet</Button>
    </form></Card>
  </Screen>;
}

export function AdminPrivacy({ permissions }: { permissions: Permission[] }) {
  type Settings = { controllerName: string; controllerAddress: string; contactEmail: string; appointmentRetentionMonths: number; fileRetentionDays: number; noticeVersion: string; isDraft: boolean };
  const data = useLoad<Settings>('/activity/privacy/settings', permissions.includes('privacy_settings_update'));
  const [settings, setSettings] = useState<Settings>({ controllerName: 'Sparkoff Proje Atölyesi', controllerAddress: '', contactEmail: 'atolye@sparkoff.tr', appointmentRetentionMonths: 12, fileRetentionDays: 30, noticeVersion: '2026-10-16', isDraft: true });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (data.data) setSettings(data.data); }, [data.data]);
  const change = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try { await api('/activity/privacy/settings', { method: 'PUT', body: JSON.stringify(settings) }); setError(''); setSaved(true); data.reload(); }
    catch (cause) { setSaved(false); setError((cause as Error).message); }
  };
  return <Screen title="KVKK ve saklama" subtitle="Veri sorumlusu ve saklama süreleri."><Card><form onSubmit={save}>
    <label>Veri sorumlusu<input value={settings.controllerName} onChange={event => change('controllerName', event.target.value)} maxLength={255} required/></label>
    <label>Adres<textarea value={settings.controllerAddress} onChange={event => change('controllerAddress', event.target.value)} maxLength={1000} required/></label>
    <label>İletişim e-postası<input type="email" value={settings.contactEmail} onChange={event => change('contactEmail', event.target.value)} maxLength={255} required/></label>
    <label>Randevu kayıt saklama süresi (ay)<input type="number" min={1} max={120} value={settings.appointmentRetentionMonths} onChange={event => change('appointmentRetentionMonths', Number(event.target.value))} required/></label>
    <label>Model dosyası saklama süresi (gün)<input type="number" min={1} max={365} value={settings.fileRetentionDays} onChange={event => change('fileRetentionDays', Number(event.target.value))} required/></label>
    <label>Aydınlatma sürümü<input value={settings.noticeVersion} onChange={event => change('noticeVersion', event.target.value)} maxLength={30} required/></label>
    <label><input type="checkbox" checked={settings.isDraft} onChange={event => change('isDraft', event.target.checked)}/> Taslak olarak işaretle</label>
    <ErrorLine error={error || data.error}/>{saved && <p role="status">KVKK ayarları kaydedildi.</p>}
    <Button type="submit">Kaydet</Button>
  </form></Card></Screen>;
}

export function AdminBookingSettings({ permissions }: { permissions: Permission[] }) {
  type Settings = { slotMinutes: 15 | 30 | 60; maximumDurationHours: number; verificationHoldMinutes: number; maximumFileSizeMb: number; allowedExtensions: string[] };
  const data = useLoad<Settings>('/printers/manage/booking-settings', permissions.includes('system_settings_update'));
  const [settings, setSettings] = useState<Settings>({ slotMinutes: 30, maximumDurationHours: 24, verificationHoldMinutes: 30, maximumFileSizeMb: 100, allowedExtensions: ['gcode', '3mf', 'stl', 'step', 'stp', 'obj'] });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (data.data) setSettings(data.data); }, [data.data]);
  const change = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try { await api('/printers/manage/booking-settings', { method: 'PUT', body: JSON.stringify(settings) }); setError(''); setSaved(true); data.reload(); }
    catch (cause) { setSaved(false); setError((cause as Error).message); }
  };
  return <Screen title="Randevu kuralları" subtitle="Süre, doğrulama ve dosya kuralları."><Card><form onSubmit={save}>
    <label>Randevu aralığı (dakika)<select value={settings.slotMinutes} onChange={event => change('slotMinutes', Number(event.target.value) as Settings['slotMinutes'])}><option value={15}>15</option><option value={30}>30</option><option value={60}>60</option></select></label>
    <label>En uzun baskı süresi (saat)<input type="number" min={1} max={168} value={settings.maximumDurationHours} onChange={event => change('maximumDurationHours', Number(event.target.value))} required/></label>
    <label>Doğrulama bekleme süresi (dakika)<input type="number" min={10} max={1440} value={settings.verificationHoldMinutes} onChange={event => change('verificationHoldMinutes', Number(event.target.value))} required/></label>
    <label>En büyük model dosyası (MB)<input type="number" min={1} max={500} value={settings.maximumFileSizeMb} onChange={event => change('maximumFileSizeMb', Number(event.target.value))} required/></label>
    <fieldset><legend>İzin verilen model türleri</legend>{['gcode', '3mf', 'stl', 'step', 'stp', 'obj'].map(extension => <label key={extension}>
      <input type="checkbox" checked={settings.allowedExtensions.includes(extension)} onChange={event => change('allowedExtensions', event.target.checked ? [...settings.allowedExtensions, extension] : settings.allowedExtensions.filter(value => value !== extension))}/>.{extension}
    </label>)}</fieldset>
    <ErrorLine error={error || data.error}/>{saved && <p role="status">Kurallar kaydedildi.</p>}
    <Button type="submit">Kaydet</Button>
  </form></Card></Screen>;
}
