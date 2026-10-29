<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminQuickSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuickSearchController extends Controller
{
    public function __invoke(Request $request, AdminQuickSearchService $search): JsonResponse
    {
        $request->merge([
            'q' => trim(preg_replace('/[%_]+/u', ' ', (string) $request->input('q')) ?? ''),
        ]);
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:100', 'regex:/[\pL\pN]/u'],
        ]);

        return response()->json([
            'query' => $validated['q'],
            'results' => $search->search($request->user(), $validated['q']),
        ]);
    }
}
