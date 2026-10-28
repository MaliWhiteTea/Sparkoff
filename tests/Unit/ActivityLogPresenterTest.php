<?php

namespace Tests\Unit;

use App\Models\Announcement;
use App\Services\ActivityLogPresenter;
use Tests\TestCase;

class ActivityLogPresenterTest extends TestCase
{
    public function test_known_audit_codes_are_presented_in_turkish(): void
    {
        $presenter = app(ActivityLogPresenter::class);

        $this->assertSame('Okudu', $presenter->action('read'));
        $this->assertSame('Duyuru', $presenter->subject(Announcement::class));
        $this->assertSame([
            'İzinler',
            'Hedef roller',
            'Yönetim duyurusu',
            'Tablo tercihleri',
        ], $presenter->fields([
            'permissions',
            'target_roles',
            'staff_announcement',
            'table_preferences',
        ]));
    }

    public function test_unknown_codes_have_turkish_context_and_sensitive_fields_are_hidden(): void
    {
        $presenter = app(ActivityLogPresenter::class);

        $this->assertSame('İşlem (custom action)', $presenter->action('custom_action'));
        $this->assertSame('Kayıt türü (CustomWidget)', $presenter->subject('App\\Models\\CustomWidget'));
        $this->assertSame([
            'Alan (custom field)',
            'Alan (another field): ayrıntı',
        ], $presenter->fields([
            'custom_field',
            'password',
            'verification_token_hash',
            'another_field' => 'ayrıntı',
            'tracking_token_hash' => 'gizli',
        ]));
    }
}
