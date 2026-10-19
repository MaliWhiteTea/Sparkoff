<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAnyPermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        abort_unless(
            $user && ($user->role === 'admin' || collect($permissions)->contains(fn ($permission) => $user->hasPermissionTo($permission))),
            403,
        );

        return $next($request);
    }
}
