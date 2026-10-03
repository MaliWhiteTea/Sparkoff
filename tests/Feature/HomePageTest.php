<?php

namespace Tests\Feature;

use App\Enums\PrinterStatus;
use App\Models\Printer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class HomePageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_home_page_uses_current_printer_settings_from_the_database(): void
    {
        Printer::query()->where('code', 'P-01')->update([
            'name' => 'Creality K1 MAX',
            'description' => 'Rezervasyona açık.',
        ]);
        Printer::query()->where('code', 'P-02')->update([
            'name' => 'Creality CR-6 MAX',
            'status' => PrinterStatus::Maintenance->value,
            'description' => 'Onarım istiyor.',
        ]);

        $this->get(route('home'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->where('printers.0.name', 'Creality K1 MAX')
            ->where('printers.0.status', PrinterStatus::Active->value)
            ->where('printers.1.name', 'Creality CR-6 MAX')
            ->where('printers.1.status', PrinterStatus::Maintenance->value)
            ->where('workshop.hours', '09.00–21.00')
            ->where('workshop.daysLabel', 'Her gün'));
    }

    public function test_home_page_handles_the_absence_of_an_active_printer(): void
    {
        Printer::query()->update(['status' => PrinterStatus::Maintenance->value]);

        $this->get(route('home'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->where('workshop.isOpen', false));
    }
}
