<?php

namespace Tests\Feature;

use App\Enums\FeedbackStatus;
use App\Enums\FeedbackType;
use App\Models\FeedbackReport;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FeedbackTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_public_user_can_submit_an_anonymous_feedback_report(): void
    {
        $this->post(route('feedback.store'), [
            'type' => FeedbackType::Bug->value,
            'message' => 'Mobil görünümde takvim düğmesi ekrandan taşıyor.',
            'website' => '',
        ])->assertSessionHas('success');

        $this->assertDatabaseHas('feedback_reports', [
            'type' => FeedbackType::Bug->value,
            'status' => FeedbackStatus::New->value,
        ]);
        $this->assertFalse(Schema::hasColumn('feedback_reports', 'name'));
        $this->assertFalse(Schema::hasColumn('feedback_reports', 'email'));
        $this->assertFalse(Schema::hasColumn('feedback_reports', 'ip_address'));
    }

    public function test_honeypot_rejects_automated_submission(): void
    {
        $this->post(route('feedback.store'), [
            'type' => FeedbackType::Suggestion->value,
            'message' => 'Bu yeterince uzun bir otomatik mesajdır.',
            'website' => 'https://spam.example',
        ])->assertSessionHasErrors('website');

        $this->assertDatabaseCount('feedback_reports', 0);
    }

    public function test_authorized_staff_can_review_feedback(): void
    {
        $role = Role::query()->create(['name' => 'Talep Sorumlusu', 'slug' => 'talep-sorumlusu']);
        $role->permissions()->attach(Permission::query()->whereIn('key', ['feedback.view', 'feedback.update'])->pluck('id'));
        $staff = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $staff->roles()->attach($role);
        $report = FeedbackReport::query()->create([
            'type' => FeedbackType::Complaint,
            'message' => 'Atölye stok bilgisi güncel görünmüyor.',
            'status' => FeedbackStatus::New,
        ]);

        $this->actingAs($staff)->get(route('admin.feedback.index'))->assertOk();
        $this->actingAs($staff)->patch(route('admin.feedback.update', $report), [
            'status' => FeedbackStatus::Reviewing->value,
            'admin_note' => 'Stok sayımıyla karşılaştırılacak.',
        ])->assertSessionHas('success');

        $this->assertDatabaseHas('feedback_reports', [
            'id' => $report->id,
            'status' => FeedbackStatus::Reviewing->value,
            'handled_by' => $staff->id,
        ]);
    }

    public function test_unauthorized_staff_cannot_view_feedback(): void
    {
        $staff = User::factory()->create(['role' => 'operator', 'is_active' => true]);

        $this->actingAs($staff)->get(route('admin.feedback.index'))->assertForbidden();
    }
}
