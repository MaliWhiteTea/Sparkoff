<?php

namespace App\Http\Controllers\Admin;

use App\Enums\InventoryTransactionStatus;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Services\InventoryTransactionService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use LogicException;

class InventoryTransactionController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate(['status' => ['nullable', Rule::in(['active', 'overdue', 'completed', 'damaged', 'lost'])]]);
        $status = $filters['status'] ?? 'active';
        $canSeeName = $this->can($request, 'loans.view_personal_data');
        $canSeeEmail = $this->can($request, 'loans.view_email');
        $transactions = InventoryTransaction::query()->with(['item:id,name,unit', 'issuer:id,name'])
            ->when($status === 'active', fn ($query) => $query->where('status', InventoryTransactionStatus::Active))
            ->when($status === 'overdue', fn ($query) => $query->where('status', InventoryTransactionStatus::Active)->whereNotNull('due_at')->where('due_at', '<', now()))
            ->when(! in_array($status, ['active', 'overdue'], true), fn ($query) => $query->where('status', $status))
            ->latest('issued_at')->paginate(20)->withQueryString()
            ->through(fn (InventoryTransaction $transaction) => [
                'id' => $transaction->id, 'item' => $transaction->item->name, 'unit' => $transaction->item->unit,
                'itemType' => $transaction->item_type->value, 'status' => $transaction->status->value,
                'recipientName' => $transaction->anonymized_at ? 'Anonimleştirildi' : ($canSeeName ? $transaction->recipient_name : 'Gizli kullanıcı'),
                'recipientEmail' => ! $transaction->anonymized_at && $canSeeEmail ? $transaction->recipient_email : null,
                'quantity' => $transaction->quantity, 'quantityReturned' => $transaction->quantity_returned,
                'remaining' => number_format($transaction->remainingQuantity(), 3, '.', ''),
                'issuedAt' => $transaction->issued_at->format('d.m.Y H:i'), 'dueAt' => $transaction->due_at?->format('d.m.Y H:i'),
                'isOverdue' => $transaction->status === InventoryTransactionStatus::Active && $transaction->due_at?->isPast(),
                'completedAt' => $transaction->completed_at?->format('d.m.Y H:i'),
                'notes' => $canSeeName ? $transaction->notes : null, 'closureNote' => $canSeeName ? $transaction->closure_note : null,
                'issuer' => $transaction->issuer?->name ?? 'Sistem',
            ]);

        return Inertia::render('Admin/InventoryTransactions/Index', [
            'transactions' => $transactions, 'filter' => $status,
            'items' => InventoryItem::query()->whereNull('archived_at')->where('is_active', true)->orderBy('name')->get()->map(fn ($item) => [
                'id' => $item->id, 'name' => $item->name, 'type' => $item->item_type->value, 'quantity' => $item->quantity, 'unit' => $item->unit,
            ]),
            'counts' => [
                'active' => InventoryTransaction::query()->where('status', InventoryTransactionStatus::Active)->count(),
                'overdue' => InventoryTransaction::query()->where('status', InventoryTransactionStatus::Active)->whereNotNull('due_at')->where('due_at', '<', now())->count(),
            ],
        ]);
    }

    public function store(Request $request, InventoryTransactionService $service): RedirectResponse
    {
        $request->merge([
            'recipient_name' => trim((string) $request->input('recipient_name')),
            'recipient_email' => $request->filled('recipient_email') ? Str::lower(trim((string) $request->input('recipient_email'))) : null,
        ]);
        $data = $request->validate([
            'inventory_item_id' => ['required', 'integer', 'exists:inventory_items,id'], 'recipient_name' => ['required', 'string', 'max:150'],
            'recipient_email' => ['nullable', 'email:rfc', 'max:255'], 'quantity' => ['required', 'numeric', 'min:0.001', 'max:9999999999'],
            'due_at' => ['nullable', 'date_format:Y-m-d\TH:i', 'after:now'], 'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $item = InventoryItem::query()->findOrFail($data['inventory_item_id']);
        if ($item->item_type->value === 'loanable' && empty($data['due_at'])) {
            throw ValidationException::withMessages(['due_at' => 'Ödünç malzeme için beklenen iade tarihi zorunludur.']);
        }
        try {
            $service->issue($item, $request->user(), $data['recipient_name'], $data['recipient_email'] ?? null, (float) $data['quantity'], isset($data['due_at']) ? CarbonImmutable::createFromFormat('Y-m-d\TH:i', $data['due_at'], config('app.timezone')) : null, $data['notes'] ?? null);
        } catch (LogicException $exception) {
            throw ValidationException::withMessages(['quantity' => $exception->getMessage()]);
        }

        return back()->with('success', 'Malzeme teslimi kaydedildi.');
    }

    public function receiveReturn(Request $request, InventoryTransaction $transaction, InventoryTransactionService $service): RedirectResponse
    {
        $data = $request->validate(['quantity' => ['required', 'numeric', 'min:0.001'], 'note' => ['nullable', 'string', 'max:1000']]);
        try {
            $service->receiveReturn($transaction, $request->user(), (float) $data['quantity'], $data['note'] ?? null);
        } catch (LogicException $exception) {
            throw ValidationException::withMessages(['quantity' => $exception->getMessage()]);
        }

        return back()->with('success', 'İade kaydedildi.');
    }

    public function close(Request $request, InventoryTransaction $transaction, InventoryTransactionService $service): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['damaged', 'lost'])], 'note' => ['required', 'string', 'min:3', 'max:1000']]);
        abort_unless($this->can($request, $data['status'] === 'damaged' ? 'loans.report_damage' : 'loans.report_lost'), 403);
        try {
            $service->closeAs($transaction, $request->user(), InventoryTransactionStatus::from($data['status']), $data['note']);
        } catch (LogicException $exception) {
            throw ValidationException::withMessages(['status' => $exception->getMessage()]);
        }

        return back()->with('success', 'Teslim kaydı kapatıldı.');
    }

    private function can(Request $request, string $permission): bool
    {
        return $request->user()->role === 'admin' || $request->user()->hasPermissionTo($permission);
    }
}
