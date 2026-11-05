<?php

namespace App\Http\Controllers\Admin;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Enums\StockMovementType;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
use App\Services\InventoryStockService;
use App\Support\InventoryCsvContract;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;

class InventoryImportController extends Controller
{
    private const SESSION_KEY = 'inventory_import';

    private const MAX_DATA_ROWS = 2000;

    private const PREVIEW_ROWS = 100;

    private const FIELDS = [
        'name' => 'Malzeme adı (zorunlu)', 'sku' => 'Stok kodu', 'brand' => 'Marka', 'model' => 'Model',
        'category' => 'Kategori',
        'location_code' => 'Konum kodu', 'location' => 'Konum', 'type' => 'Tür', 'unit' => 'Birim',
        'quantity' => 'Miktar', 'minimum_stock' => 'Kritik stok', 'status' => 'Durum',
        'visibility' => 'Katalog görünürlüğü', 'description' => 'Açıklama',
    ];

    public function index(Request $request): Response
    {
        $state = $this->state($request);
        $csv = $state ? $this->readFile($state['path']) : ['headers' => [], 'rows' => []];
        $headers = $csv['headers'];
        $rows = $csv['rows'];
        $mapping = $state ? ($state['mapping'] ?? $this->suggestMapping($headers)) : [];
        $columnQuality = collect($headers)->map(function (string $header) use ($rows, $mapping) {
            $empty = collect($rows)->filter(fn (array $row) => trim((string) ($row['data'][$header] ?? '')) === '')->count();

            return [
                'header' => $header,
                'field' => $mapping[$header] ?? '',
                'emptyCount' => $empty,
                'filledCount' => count($rows) - $empty,
            ];
        })->values()->all();
        $analysis = $state && isset($state['mapping']) ? $this->analyze($rows, $state['mapping']) : null;
        if ($analysis) {
            unset($analysis['validRows']);
            $analysis['errorSummary'] = collect($analysis['errorRows'])
                ->flatMap(fn (array $row) => $row['errors'])
                ->countBy()
                ->sortDesc()
                ->map(fn (int $count, string $message) => ['message' => $message, 'count' => $count])
                ->values()->all();
        }

        return Inertia::render('Admin/Inventory/Import', [
            'upload' => $state ? [
                'name' => $state['name'], 'headers' => $headers,
                'rowCount' => count($rows),
                'sample' => array_map(fn ($row) => $row['data'], array_slice($rows, 0, 5)), 'mapping' => $mapping,
                'columnQuality' => $columnQuality,
                'unmappedHeaders' => array_keys(array_filter($mapping, fn ($field) => $field === '')),
            ] : null,
            'fields' => self::FIELDS,
            'analysis' => $analysis,
            'canViewInventory' => $request->user()->hasPermissionTo('inventory.view'),
        ]);
    }

    public function upload(Request $request): RedirectResponse
    {
        $data = $request->validate(['file' => ['required', 'file', 'extensions:csv,txt,xlsx', 'mimetypes:text/csv,text/plain,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/octet-stream', 'max:2048']]);
        $extension = strtolower($data['file']->getClientOriginalExtension());
        if ($extension !== 'xlsx' && ! mb_check_encoding((string) file_get_contents($data['file']->getRealPath()), 'UTF-8')) {
            throw ValidationException::withMessages(['file' => 'CSV dosyası UTF-8 kodlamasında olmalıdır. Dosyayı UTF-8 olarak kaydedip yeniden yükleyin.']);
        }
        $this->clearState($request);
        $path = $data['file']->storeAs('inventory-imports', Str::uuid().'.'.$extension, 'local');
        try {
            $csv = $this->readFile($path);
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($path);
            if ($exception instanceof ValidationException) {
                throw $exception;
            }
            throw ValidationException::withMessages(['file' => 'XLSX dosyası okunamadı. Geçerli bir çalışma kitabı yükleyin.']);
        }
        if ($csv['rows'] === []) {
            Storage::disk('local')->delete($path);
            throw ValidationException::withMessages(['file' => 'Dosyada başlık ve en az bir veri satırı bulunmalıdır.']);
        }
        $request->session()->put(self::SESSION_KEY, [
            'path' => $path, 'name' => $data['file']->getClientOriginalName(), 'user_id' => $request->user()->id,
        ]);

        return back()->with('success', 'Dosya okundu. Sütunları eşleyip ön izleme oluşturun.');
    }

    public function preview(Request $request): RedirectResponse
    {
        $state = $this->requiredState($request);
        $mapping = $request->validate([
            'mapping' => ['required', 'array'],
            'mapping.*' => ['nullable', 'string', Rule::in(array_keys(self::FIELDS))],
        ])['mapping'];
        $headers = $this->readFile($state['path'])['headers'];
        if (array_diff(array_keys($mapping), $headers) !== []) {
            throw ValidationException::withMessages(['mapping' => 'Dosyada bulunmayan bir sütun gönderildi.']);
        }
        $selected = array_values(array_filter($mapping));
        if (! in_array('name', $selected, true)) {
            throw ValidationException::withMessages(['mapping' => 'Malzeme adı alanını bir dosya sütunuyla eşleyin.']);
        }
        if (count($selected) !== count(array_unique($selected))) {
            throw ValidationException::withMessages(['mapping' => 'Bir alan birden fazla sütunla eşlenemez.']);
        }
        $state['mapping'] = $mapping;
        $request->session()->put(self::SESSION_KEY, $state);

        return back()->with('success', 'Ön izleme hazırlandı.');
    }

    public function confirm(Request $request, InventoryStockService $stock): RedirectResponse
    {
        $state = $this->requiredState($request);
        abort_unless(isset($state['mapping']), 422);
        $analysis = $this->analyze($this->readFile($state['path'])['rows'], $state['mapping']);
        if ($analysis['validCount'] === 0) {
            throw ValidationException::withMessages(['import' => 'İçe aktarılabilecek geçerli satır bulunamadı.']);
        }

        DB::transaction(function () use ($analysis, $request, $stock) {
            foreach ($analysis['validRows'] as $row) {
                $categoryId = $this->categoryId($row['category']);
                $locationId = $this->locationId($row['location'], $row['location_code']);
                $quantity = $row['quantity'];
                $item = InventoryItem::query()->create([
                    'category_id' => $categoryId, 'location_id' => $locationId, 'name' => $row['name'],
                    'slug' => $this->uniqueSlug($row['name']), 'sku' => $row['sku'],
                    'brand' => $row['brand'], 'model' => $row['model'], 'item_type' => $row['type'],
                    'unit' => $row['unit'], 'quantity' => 0, 'minimum_stock' => $row['minimum_stock'],
                    'public_visibility' => $row['visibility'], 'description' => $row['description'],
                    'is_active' => $row['status'] === 'active',
                    'archived_at' => $row['status'] === 'archived' ? now() : null,
                ]);
                if ($quantity > 0) {
                    $stock->adjust($item, $quantity, StockMovementType::Initial, $request->user(), 'Dosyadan içe aktarma');
                }
            }
            ActivityLog::query()->create([
                'user_id' => $request->user()->id, 'action' => 'inventory_imported',
                'subject_type' => InventoryItem::class, 'subject_id' => null,
                'changed_fields' => ['created_count' => $analysis['validCount'], 'source_file' => $this->state($request)['name']],
                'created_at' => now(),
            ]);
        });
        $count = $analysis['validCount'];
        $this->clearState($request);

        return redirect()->route('admin.inventory.import.index')->with('success', "{$count} malzeme envantere aktarıldı.");
    }

    public function cancel(Request $request): RedirectResponse
    {
        $this->clearState($request);

        return back()->with('success', 'İçe aktarma taslağı silindi.');
    }

    private function analyze(array $rows, array $mapping): array
    {
        $valid = [];
        $preview = [];
        $seen = [];
        $existingSkus = InventoryItem::query()->whereNotNull('sku')->pluck('sku')->mapWithKeys(fn ($sku) => [InventoryCsvContract::normalize($sku) => true]);
        $existingNames = InventoryItem::query()->pluck('name')->mapWithKeys(fn ($name) => [InventoryCsvContract::normalize($name) => true]);
        $locations = InventoryLocation::query()->get(['id', 'name', 'code']);
        $locationsByCode = $locations->keyBy(fn (InventoryLocation $location) => InventoryCsvContract::normalize($location->code));
        $locationsByName = $locations->keyBy(fn (InventoryLocation $location) => InventoryCsvContract::normalize($location->name));
        foreach ($rows as $sourceRow) {
            $source = $sourceRow['data'];
            $raw = [];
            foreach ($mapping as $header => $field) {
                if ($field) {
                    $raw[$field] = trim((string) ($source[$header] ?? ''));
                }
            }
            $row = $this->normalizeRow($raw);
            $errors = [];
            if ($row['name'] === '') {
                $errors[] = 'Malzeme adı boş.';
            }
            foreach (['brand' => ['Marka', 120], 'model' => ['Model', 160]] as $field => [$label, $maximum]) {
                if (mb_strlen((string) ($raw[$field] ?? '')) > $maximum) {
                    $errors[] = "{$label} en fazla {$maximum} karakter olabilir.";
                }
            }
            foreach (['quantity' => 'Miktar', 'minimum_stock' => 'Kritik stok'] as $field => $label) {
                if (($raw[$field] ?? '') !== '' && ! $this->validQuantity($raw[$field])) {
                    $errors[] = "{$label} 0 ile 9.999.999.999 arasında ve en fazla üç ondalık basamaklı olmalıdır.";
                }
            }
            if (($raw['type'] ?? '') !== '' && InventoryCsvContract::parseType($raw['type']) === null) {
                $errors[] = 'Tür değeri tanınmıyor.';
            }
            if (($raw['visibility'] ?? '') !== '' && InventoryCsvContract::parseVisibility($raw['visibility']) === null) {
                $errors[] = 'Katalog görünürlüğü değeri tanınmıyor.';
            }
            if (($raw['status'] ?? '') !== '' && InventoryCsvContract::parseStatus($raw['status']) === null) {
                $errors[] = 'Durum değeri tanınmıyor.';
            }
            if ($locationError = $this->locationError($row['location'], $row['location_code'], $locationsByName, $locationsByCode)) {
                $errors[] = $locationError;
            }
            $duplicateKey = $row['sku']
                ? 'sku:'.InventoryCsvContract::normalize($row['sku'])
                : 'name:'.InventoryCsvContract::normalize($row['name']);
            $exists = $row['sku']
                ? $existingSkus->has(InventoryCsvContract::normalize($row['sku']))
                : $existingNames->has(InventoryCsvContract::normalize($row['name']));
            if (isset($seen[$duplicateKey]) || $exists) {
                $errors[] = 'Envanterde veya dosyada tekrar eden malzeme.';
            }
            $seen[$duplicateKey] = true;
            if ($errors === []) {
                $valid[] = $row;
            }
            $preview[] = ['line' => $sourceRow['line'], ...$row, 'errors' => $errors];
        }

        $errorRows = array_values(array_filter($preview, fn ($row) => $row['errors'] !== []));

        return [
            'totalCount' => count($preview),
            'validCount' => count($valid),
            'errorCount' => count($errorRows),
            'rows' => array_slice($preview, 0, self::PREVIEW_ROWS),
            'errorRows' => $errorRows,
            'validRows' => $valid,
        ];
    }

    private function normalizeRow(array $row): array
    {
        $typeInput = trim($row['type'] ?? '');
        $visibilityInput = trim($row['visibility'] ?? '');
        $statusInput = trim($row['status'] ?? '');
        $type = $typeInput === '' ? InventoryItemType::Consumable->value : InventoryCsvContract::parseType($typeInput);
        $visibility = $visibilityInput === '' ? InventoryVisibility::Status->value : InventoryCsvContract::parseVisibility($visibilityInput);
        $status = $statusInput === '' ? 'active' : InventoryCsvContract::parseStatus($statusInput);

        return [
            'name' => trim($row['name'] ?? ''), 'sku' => ($row['sku'] ?? '') !== '' ? trim($row['sku']) : null,
            'brand' => ($row['brand'] ?? '') !== '' ? trim($row['brand']) : null,
            'model' => ($row['model'] ?? '') !== '' ? trim($row['model']) : null,
            'category' => trim($row['category'] ?? ''), 'location' => trim($row['location'] ?? ''), 'location_code' => trim($row['location_code'] ?? ''),
            'type' => $type ?? $typeInput, 'unit' => trim($row['unit'] ?? '') ?: 'adet',
            'quantity' => $this->quantityValue($row['quantity'] ?? '', '0'),
            'minimum_stock' => ($row['minimum_stock'] ?? '') !== '' ? $this->quantityValue($row['minimum_stock']) : null,
            'status' => $status ?? $statusInput, 'visibility' => $visibility ?? $visibilityInput,
            'description' => ($row['description'] ?? '') !== '' ? trim($row['description']) : null,
        ];
    }

    private function validQuantity(string $value): bool
    {
        $normalized = str_replace(',', '.', trim($value));
        if (preg_match('/^(\d+)(?:\.(\d{1,3}))?$/', $normalized, $matches) !== 1) {
            return false;
        }

        $whole = ltrim($matches[1], '0') ?: '0';
        if (strlen($whole) < 10) {
            return true;
        }
        if (strlen($whole) > 10 || strcmp($whole, '9999999999') > 0) {
            return false;
        }

        return ! isset($matches[2]) || trim($matches[2], '0') === '';
    }

    private function quantityValue(string $value, string $default = '0'): string
    {
        $value = trim($value);

        return $value === '' ? $default : str_replace(',', '.', $value);
    }

    private function readCsv(string $path): array
    {
        $handle = fopen(Storage::disk('local')->path($path), 'rb');
        if (! $handle) {
            return ['headers' => [], 'rows' => []];
        }
        $contents = file_get_contents(Storage::disk('local')->path($path));
        $bomOffset = str_starts_with((string) $contents, "\xEF\xBB\xBF") ? 3 : 0;
        fseek($handle, $bomOffset);
        $first = fgets($handle);
        if ($first === false) {
            fclose($handle);

            return ['headers' => [], 'rows' => []];
        }
        $delimiter = count(str_getcsv($first, ';', '"', '')) >= count(str_getcsv($first, ',', '"', '')) ? ';' : ',';
        fseek($handle, $bomOffset);
        $headerStart = ftell($handle);
        $headers = fgetcsv($handle, 0, $delimiter, '"', '');
        $headerEnd = ftell($handle);
        $headers = array_map(fn ($value) => trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $value)), $headers ?: []);
        $normalizedHeaders = array_map(InventoryCsvContract::normalize(...), $headers);
        if ($headers === [] || in_array('', $headers, true) || count(array_unique($normalizedHeaders)) !== count($headers)) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => 'CSV sütun başlıkları boş veya tekrarlı olamaz.']);
        }
        $rows = [];
        $physicalLine = 1 + substr_count(substr((string) $contents, $headerStart, $headerEnd - $headerStart), "\n");
        while (($values = fgetcsv($handle, 0, $delimiter, '"', '')) !== false) {
            $recordEnd = ftell($handle);
            $recordStartLine = $physicalLine;
            $recordStart = $headerEnd;
            $physicalLine += substr_count(substr((string) $contents, $recordStart, $recordEnd - $recordStart), "\n");
            $headerEnd = $recordEnd;
            if (count(array_filter($values, fn ($value) => trim((string) $value) !== '')) === 0) {
                continue;
            }
            if (count($rows) >= self::MAX_DATA_ROWS) {
                fclose($handle);
                $firstUnprocessed = number_format(self::MAX_DATA_ROWS + 1, 0, ',', '.');
                $limit = number_format(self::MAX_DATA_ROWS, 0, ',', '.');
                throw ValidationException::withMessages([
                    'file' => "CSV dosyası en fazla {$limit} veri satırı içerebilir. {$firstUnprocessed}. veri satırı işlenmedi.",
                ]);
            }
            if (count($values) !== count($headers)) {
                fclose($handle);
                throw ValidationException::withMessages(['file' => "CSV {$recordStartLine}. satırındaki sütun sayısı başlıklarla eşleşmiyor."]);
            }
            $rows[] = ['line' => $recordStartLine, 'data' => array_combine($headers, $values)];
        }
        fclose($handle);

        return ['headers' => $headers, 'rows' => $rows];
    }

    private function readFile(string $path): array
    {
        return str_ends_with($path, '.xlsx') ? $this->readXlsx($path) : $this->readCsv($path);
    }

    private function readXlsx(string $path): array
    {
        $reader = new XlsxReader;
        $headers = [];
        $rows = [];
        $reader->open(Storage::disk('local')->path($path));
        try {
            foreach ($reader->getSheetIterator() as $sheet) {
                $line = 0;
                foreach ($sheet->getRowIterator() as $record) {
                    $line++;
                    $values = array_map(function ($cell) {
                        $value = $cell->getValue();

                        if ($value instanceof \DateTimeInterface) {
                            return $value->format('Y-m-d H:i:s');
                        }
                        if ($value instanceof \DateInterval) {
                            return $value->format('%d %H:%I:%S');
                        }

                        return (string) ($value ?? '');
                    }, $record->getCells());
                    if ($line === 1) {
                        $headers = array_map('trim', $values);
                        $normalized = array_map(InventoryCsvContract::normalize(...), $headers);
                        if ($headers === [] || count($headers) > 100 || in_array('', $headers, true) || count(array_unique($normalized)) !== count($headers)) {
                            throw ValidationException::withMessages(['file' => 'XLSX sütun başlıkları boş, tekrarlı veya 100 sütundan fazla olamaz.']);
                        }

                        continue;
                    }
                    if (count(array_filter($values, fn (string $value) => trim($value) !== '')) === 0) {
                        continue;
                    }
                    if (count($rows) >= self::MAX_DATA_ROWS) {
                        throw ValidationException::withMessages(['file' => 'XLSX dosyası en fazla 2.000 veri satırı içerebilir.']);
                    }
                    $values = array_slice(array_pad($values, count($headers), ''), 0, max(count($headers), count($values)));
                    if (count($values) > count($headers) && count(array_filter(array_slice($values, count($headers)), fn (string $value) => trim($value) !== '')) > 0) {
                        throw ValidationException::withMessages(['file' => "XLSX {$line}. satırında başlık dışında veri bulunuyor."]);
                    }
                    $rows[] = ['line' => $line, 'data' => array_combine($headers, array_slice($values, 0, count($headers)))];
                }

                break;
            }
        } finally {
            $reader->close();
        }

        return ['headers' => $headers, 'rows' => $rows];
    }

    private function suggestMapping(array $headers): array
    {
        $aliases = collect(InventoryCsvContract::COLUMNS)->mapWithKeys(fn ($label, $field) => [InventoryCsvContract::normalize($label) => $field])->all();
        $aliases = [...$aliases,
            'malzeme adı' => 'name', 'urun' => 'name', 'ürün' => 'name', 'kod' => 'sku',
            'brand' => 'brand', 'üretici' => 'brand', 'uretici' => 'brand',
            'model no' => 'model', 'model numarası' => 'model', 'model numarasi' => 'model',
            'ürün modeli' => 'model', 'urun modeli' => 'model',
            'yer' => 'location', 'tur' => 'type', 'adet' => 'quantity', 'minimum stok' => 'minimum_stock',
            'görünürlük' => 'visibility', 'aciklama' => 'description',
        ];

        return collect($headers)->mapWithKeys(fn ($header) => [$header => $aliases[InventoryCsvContract::normalize($header)] ?? ''])->all();
    }

    private function categoryId(string $name): ?int
    {
        if ($name === '') {
            return null;
        }

        return InventoryCategory::query()->firstOrCreate(['name' => $name], ['slug' => $this->uniqueDefinitionSlug($name, InventoryCategory::class), 'is_active' => true])->id;
    }

    private function locationId(string $name, string $code): ?int
    {
        if ($name === '' && $code === '') {
            return null;
        }

        if ($code !== '' && $location = InventoryLocation::query()->where('code', Str::upper($code))->first()) {
            return $location->id;
        }

        if ($name !== '' && $location = InventoryLocation::query()->where('name', $name)->first()) {
            return $location->id;
        }

        return InventoryLocation::query()->create([
            'name' => $name ?: $code,
            'code' => $code !== '' ? Str::upper($code) : $this->uniqueLocationCode($name),
            'is_public' => true,
            'is_active' => true,
        ])->id;
    }

    private function locationError(string $name, string $code, $locationsByName, $locationsByCode): ?string
    {
        if ($name === '' || $code === '') {
            return null;
        }

        $byName = $locationsByName->get(InventoryCsvContract::normalize($name));
        $byCode = $locationsByCode->get(InventoryCsvContract::normalize($code));
        if ($byName && $byCode && $byName->id !== $byCode->id) {
            return 'Konum adı ile konum kodu farklı kayıtlarla eşleşiyor.';
        }
        if ($byCode && InventoryCsvContract::normalize($byCode->name) !== InventoryCsvContract::normalize($name)) {
            return 'Konum kodu mevcut farklı bir konum adına ait.';
        }
        if ($byName && InventoryCsvContract::normalize($byName->code) !== InventoryCsvContract::normalize($code)) {
            return 'Konum adı mevcut farklı bir konum koduna ait.';
        }

        return null;
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'malzeme';
        $slug = $base;
        for ($i = 2; InventoryItem::query()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    private function uniqueDefinitionSlug(string $name, string $model): string
    {
        $base = Str::slug($name) ?: 'kategori';
        $slug = $base;
        for ($i = 2; $model::query()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    private function uniqueLocationCode(string $name): string
    {
        $base = Str::upper(Str::slug($name, '-')) ?: 'KONUM';
        $code = Str::limit($base, 45, '');
        for ($i = 2; InventoryLocation::query()->where('code', $code)->exists(); $i++) {
            $code = Str::limit($base, 40, '')."-{$i}";
        }

        return $code;
    }

    private function state(Request $request): ?array
    {
        $state = $request->session()->get(self::SESSION_KEY);

        return $state && ($state['user_id'] ?? null) === $request->user()->id && Storage::disk('local')->exists($state['path']) ? $state : null;
    }

    private function requiredState(Request $request): array
    {
        return $this->state($request) ?? throw ValidationException::withMessages(['file' => 'İçe aktarma dosyası bulunamadı; tekrar yükleyin.']);
    }

    private function clearState(Request $request): void
    {
        if ($state = $this->state($request)) {
            Storage::disk('local')->delete($state['path']);
        }
        $request->session()->forget(self::SESSION_KEY);
    }
}
