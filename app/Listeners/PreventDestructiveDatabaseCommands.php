<?php

namespace App\Listeners;

use Illuminate\Console\Events\CommandStarting;
use Illuminate\Contracts\Foundation\Application;
use RuntimeException;

class PreventDestructiveDatabaseCommands
{
    private const BLOCKED_COMMANDS = [
        'db:wipe',
        'migrate:fresh',
        'migrate:refresh',
        'migrate:reset',
        'migrate:rollback',
    ];

    public function __construct(private readonly Application $app) {}

    public function handle(CommandStarting $event): void
    {
        if (! in_array($event->command, self::BLOCKED_COMMANDS, true)) {
            return;
        }

        if ($this->app->environment('testing')) {
            return;
        }

        if ((bool) $this->app->make('config')->get('app.allow_destructive_database_commands', false)) {
            return;
        }

        throw new RuntimeException(
            "{$event->command} komutu engellendi: Bu işlem kullanıcılar dahil mevcut verileri silebilir. "
            .'Bilinçli olarak çalıştırmanız gerekiyorsa geçici olarak ALLOW_DESTRUCTIVE_DATABASE_COMMANDS=true ayarlayın.'
        );
    }
}
