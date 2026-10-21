<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PersonalSettingsController extends Controller
{
    public function edit(Request $request): Response
    {
        return Inertia::render('Admin/Settings/Personal', [
            'preferences' => $request->user()->interfacePreferences(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $preferences = $request->validate([
            'theme' => ['required', Rule::in(['light', 'dark', 'system'])],
            'scale' => ['required', Rule::in(['small', 'normal', 'large'])],
            'density' => ['required', Rule::in(['comfortable', 'normal', 'compact'])],
            'sidebar' => ['required', Rule::in(['wide', 'narrow'])],
        ]);

        $request->user()->update(['interface_preferences' => $preferences]);

        return back()->with('success', 'Kişisel görünüm ayarlarınız kaydedildi.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->user()->update(['interface_preferences' => null, 'table_preferences' => null]);

        return back()->with('success', 'Kişisel görünüm ayarlarınız varsayılanlara döndürüldü.');
    }

    public function updateTable(Request $request): RedirectResponse
    {
        $table = $request->validate(['table' => ['required', Rule::in(array_keys($this->tableColumns()))]])['table'];
        $allowed = $this->allowedColumns($request, $table);
        $data = $request->validate([
            'columns' => ['required', 'array', 'min:1', 'max:12'],
            'columns.*' => ['required', 'string', 'distinct', Rule::in($allowed)],
        ]);

        $preferences = $request->user()->table_preferences ?? [];
        $preferences[$table] = array_values($data['columns']);
        $request->user()->update(['table_preferences' => $preferences]);

        return back()->with('success', 'Tablo sütunları hesabınıza kaydedildi.');
    }

    private function allowedColumns(Request $request, string $table): array
    {
        $columns = $this->tableColumns()[$table];

        return array_keys(array_filter($columns, function (?string $permission) use ($request) {
            return $permission === null || $request->user()->role === 'admin' || $request->user()->hasPermissionTo($permission);
        }));
    }

    /** @return array<string, array<string, string|null>> */
    private function tableColumns(): array
    {
        return [
            'appointments' => [
                'applicant' => 'appointments.view_personal_data',
                'starts_at' => null,
                'duration' => null,
                'printer' => null,
                'status' => null,
            ],
            'inventory' => ['name' => null, 'category' => null, 'location' => null, 'quantity' => null, 'visibility' => null],
            'loans' => ['item' => null, 'recipient' => 'loans.view_personal_data', 'quantity' => null, 'issued_at' => null, 'due_at' => null, 'status' => null],
            'feedback' => ['type' => null, 'message' => null, 'status' => null, 'created_at' => null, 'handler' => null],
            'users' => ['name' => null, 'email' => null, 'roles' => null, 'status' => null],
        ];
    }
}
