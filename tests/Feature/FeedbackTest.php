<?php

namespace Tests\Feature;

use App\Enums\FeedbackStatus;
use App\Enums\FeedbackType;
use App\Models\FeedbackReport;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
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

    public function test_public_user_can_attach_a_private_image_to_feedback(): void
    {
        Storage::fake('local');

        $this->post(route('feedback.store'), [
            'type' => FeedbackType::Suggestion->value,
            'message' => 'Takvim görünümündeki sorunu gösteren ekran görüntüsü ektedir.',
            'image' => UploadedFile::fake()->createWithContent(
                'ekran-goruntusu.png',
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
            ),
            'website' => '',
        ])->assertSessionHas('success');

        $report = FeedbackReport::query()->sole();

        $this->assertSame('ekran-goruntusu.png', $report->image_original_name);
        $this->assertSame('image/png', $report->image_mime_type);
        Storage::disk('local')->assertExists($report->image_path);
    }

    public function test_feedback_rejects_unsupported_attachments(): void
    {
        Storage::fake('local');

        $this->from(route('feedback.create'))->post(route('feedback.store'), [
            'type' => FeedbackType::Bug->value,
            'message' => 'Desteklenmeyen bir dosya yüklemeyi deniyorum.',
            'image' => UploadedFile::fake()->create('zararli.svg', 20, 'image/svg+xml'),
            'website' => '',
        ])->assertRedirect(route('feedback.create'))
            ->assertSessionHasErrors('image');

        $this->assertDatabaseCount('feedback_reports', 0);
    }

    public function test_php_upload_failure_has_a_readable_turkish_message(): void
    {
        $failedUpload = new UploadedFile(
            __FILE__,
            'buyuk-ekran-goruntusu.png',
            'image/png',
            UPLOAD_ERR_INI_SIZE,
            true,
        );

        $this->from(route('feedback.create'))->post(route('feedback.store'), [
            'type' => FeedbackType::Bug->value,
            'message' => 'PHP yükleme sınırı hatası kullanıcıya anlaşılır gösterilmelidir.',
            'image' => $failedUpload,
            'website' => '',
        ])->assertRedirect(route('feedback.create'))
            ->assertSessionHasErrors([
                'image' => 'Görsel yüklenemedi. Dosyanın 5 MB sınırını aşmadığını kontrol edin.',
            ]);

        $this->assertDatabaseCount('feedback_reports', 0);
    }

    public function test_only_authorized_staff_can_view_feedback_images(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('feedback/1/kanıt.jpg', 'private-image');
        $report = FeedbackReport::query()->create([
            'type' => FeedbackType::Bug,
            'message' => 'Görsel erişim yetkisi denetlenmelidir.',
            'image_path' => 'feedback/1/kanıt.jpg',
            'image_original_name' => 'kanıt.jpg',
            'image_mime_type' => 'image/jpeg',
            'image_size' => 13,
            'status' => FeedbackStatus::New,
        ]);
        $role = Role::query()->create(['name' => 'Talep Görüntüleyici', 'slug' => 'talep-goruntuleyici-gorsel']);
        $role->permissions()->attach(Permission::query()->where('key', 'feedback.view')->value('id'));
        $authorized = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $authorized->roles()->attach($role);
        $unauthorized = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $unauthorized->roles()->attach(Role::query()->create([
            'name' => 'Yetkisiz Talep Rolü',
            'slug' => 'yetkisiz-talep-rolu-gorsel',
        ]));

        $this->actingAs($authorized)->get(route('admin.feedback.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('reports.data.0.imageUrl', route('admin.feedback.image', $report))
                ->where('reports.data.0.imageName', 'kanıt.jpg'));
        $this->actingAs($authorized)->get(route('admin.feedback.image', $report))
            ->assertOk()
            ->assertHeader('content-type', 'image/jpeg')
            ->assertHeader('x-content-type-options', 'nosniff');
        $this->actingAs($unauthorized)->get(route('admin.feedback.image', $report))->assertForbidden();
    }

    public function test_short_feedback_uses_a_readable_turkish_validation_message(): void
    {
        $this->from(route('feedback.create'))->post(route('feedback.store'), [
            'type' => FeedbackType::Complaint->value,
            'message' => 'test',
            'website' => '',
        ])->assertRedirect(route('feedback.create'))
            ->assertSessionHasErrors([
                'message' => 'Açıklama en az 10 karakter olmalıdır.',
            ]);

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
        $staff->roles()->attach(Role::query()->create([
            'name' => 'Yetkisiz Panel Rolü',
            'slug' => 'yetkisiz-panel-rolu',
        ]));

        $this->actingAs($staff)->get(route('admin.feedback.index'))->assertForbidden();
    }

    public function test_feedback_only_staff_is_sent_to_permission_filtered_dashboard_after_login(): void
    {
        $role = Role::query()->create(['name' => 'Talep Görüntüleyici', 'slug' => 'talep-goruntuleyici']);
        $role->permissions()->attach(Permission::query()->where('key', 'feedback.view')->value('id'));
        $staff = User::factory()->create([
            'email' => 'talep@example.com',
            'password' => 'guvenli-test-parolasi',
            'role' => 'operator',
            'is_active' => true,
        ]);
        $staff->roles()->attach($role);

        $this->post(route('admin.login.store'), [
            'email' => $staff->email,
            'password' => 'guvenli-test-parolasi',
        ])->assertRedirect(route('admin.dashboard'));
    }
}
