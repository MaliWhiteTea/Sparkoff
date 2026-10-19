<?php

namespace Tests\Unit;

use App\Listeners\PreventDestructiveDatabaseCommands;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Contracts\Config\Repository;
use Illuminate\Contracts\Foundation\Application;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

class PreventDestructiveDatabaseCommandsTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    #[DataProvider('destructiveCommands')]
    public function test_it_blocks_destructive_commands_outside_testing(string $command): void
    {
        $app = Mockery::mock(Application::class);
        $config = Mockery::mock(Repository::class);
        $app->shouldReceive('environment')->with('testing')->once()->andReturnFalse();
        $app->shouldReceive('make')->with('config')->once()->andReturn($config);
        $config->shouldReceive('get')->with('app.allow_destructive_database_commands', false)->once()->andReturnFalse();

        $listener = new PreventDestructiveDatabaseCommands($app);

        $this->expectException(RuntimeException::class);
        $listener->handle($this->event($command));
    }

    public function test_it_allows_destructive_commands_in_testing(): void
    {
        $app = Mockery::mock(Application::class);
        $app->shouldReceive('environment')->with('testing')->once()->andReturnTrue();

        (new PreventDestructiveDatabaseCommands($app))->handle($this->event('migrate:fresh'));

        $this->addToAssertionCount(1);
    }

    public function test_it_ignores_safe_commands(): void
    {
        $app = Mockery::mock(Application::class);

        (new PreventDestructiveDatabaseCommands($app))->handle($this->event('migrate'));

        $this->addToAssertionCount(1);
    }

    public static function destructiveCommands(): array
    {
        return [
            ['db:wipe'],
            ['migrate:fresh'],
            ['migrate:refresh'],
            ['migrate:reset'],
            ['migrate:rollback'],
        ];
    }

    private function event(string $command): CommandStarting
    {
        return new CommandStarting($command, new ArrayInput([]), new BufferedOutput);
    }
}
