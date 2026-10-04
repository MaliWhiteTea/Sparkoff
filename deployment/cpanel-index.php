<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// public_html and sparkoff_app are sibling directories on cPanel.
if (file_exists($maintenance = __DIR__.'/../sparkoff_app/storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../sparkoff_app/vendor/autoload.php';

/** @var Application $app */
$app = require_once __DIR__.'/../sparkoff_app/bootstrap/app.php';

$app->handleRequest(Request::capture());
