<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\UndoAction;
use App\Services\AdminUndoService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use LogicException;

class UndoController extends Controller
{
    public function __invoke(Request $request, UndoAction $undoAction, AdminUndoService $service): RedirectResponse
    {
        abort_unless($undoAction->user_id === $request->user()->id, 404);

        try {
            $service->execute($undoAction, $request->user());
        } catch (LogicException $exception) {
            return back()->with('warning', $exception->getMessage());
        }

        return back()->with('success', 'Değişiklik güvenli şekilde geri alındı.');
    }
}
