<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOnlineBookingEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (config('features.online_booking')) {
            return $next($request);
        }

        if ($request->isMethod('GET') && $request->routeIs('booking.create')) {
            return redirect()->route('printers.public');
        }

        abort(404);
    }
}
