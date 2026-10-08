<?php
// /server/bootstrap.php
declare(strict_types=1);
date_default_timezone_set('America/Toronto');

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Pagination\Paginator;
use Illuminate\Events\Dispatcher;
use Illuminate\Container\Container;

require_once __DIR__ . '/../vendor/autoload.php';

// --------------------------------------------------
// 1. Load environment variables
// --------------------------------------------------
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// --------------------------------------------------
// 2. Setup Eloquent ORM
// --------------------------------------------------
$capsule = new Capsule();

$capsule->addConnection([
    'driver'    => $_ENV['DB_DRIVER'] ?? 'mysql',
    'host'      => $_ENV['DB_HOST'] ?? '127.0.0.1',
    'port'      => $_ENV['DB_PORT'] ?? '3306',
    'database'  => $_ENV['DB_NAME'] ?? 'catscript_db',
    'username'  => $_ENV['DB_USER'] ?? 'root',
    'password'  => $_ENV['DB_PASSWORD'] ?? '',
    'charset'   => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix'    => '',
]);

$capsule->setEventDispatcher(new Dispatcher(new Container()));
$capsule->setAsGlobal();
$capsule->bootEloquent();

// --------------------------------------------------
// 3. Enable Pagination globally
// --------------------------------------------------
Paginator::currentPageResolver(function ($pageName = 'page') {
    return isset($_GET[$pageName]) ? (int) $_GET[$pageName] : 1;
});

// Without this, nextPageUrl()/previousPageUrl() default to '/' on every page
// (Illuminate's default resolver, since this app has no request-aware container).
Paginator::currentPathResolver(function () {
    return strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
});

Paginator::defaultView('pagination::default');
Paginator::defaultSimpleView('pagination::simple-default');

// --------------------------------------------------
// 4. Define constants or app-level helpers
// --------------------------------------------------
if (!defined('ADMIN_RESET_PASSWORD')) {
    define('ADMIN_RESET_PASSWORD', $_ENV['ADMIN_RESET_PASSWORD'] ?? 'supersecret');
}
