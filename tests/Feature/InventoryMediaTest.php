<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Models\InventoryItem;
use App\Models\InventoryMedia;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class InventoryMediaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Storage::fake('public');
    }

    public function test_authorized_user_can_upload_an_accessible_cover_image(): void
    {
        $user = $this->userWithPermission('inventory.manage_media');
        $item = $this->item();

        $this->actingAs($user)->post(route('admin.inventory.media.store', $item), [
            'type' => 'image', 'file' => $this->png('arduino.png'),
            'title' => 'Üstten görünüm', 'alt_text' => 'Mavi Arduino Uno kartının üstten görünümü',
        ])->assertSessionHas('success');

        $medium = $item->media()->firstOrFail();
        $this->assertSame('image', $medium->type);
        $this->assertTrue($medium->is_cover);
        Storage::disk('public')->assertExists($medium->file_path);
        $this->assertDatabaseHas('activity_logs', ['subject_type' => InventoryMedia::class, 'subject_id' => $medium->id, 'action' => 'created']);
    }

    public function test_upload_requires_permission_and_rejects_unsafe_or_oversized_files(): void
    {
        $viewer = $this->userWithPermission('inventory.view');
        $manager = $this->userWithPermission('inventory.manage_media');
        $item = $this->item();

        $this->actingAs($viewer)->post(route('admin.inventory.media.store', $item), [
            'type' => 'image', 'file' => $this->png('test.png'), 'alt_text' => 'Test',
        ])->assertForbidden();
        $this->actingAs($manager)->post(route('admin.inventory.media.store', $item), [
            'type' => 'image', 'file' => UploadedFile::fake()->create('zararli.svg', 10, 'image/svg+xml'), 'alt_text' => 'Test',
        ])->assertSessionHasErrors('file');
        $this->actingAs($manager)->post(route('admin.inventory.media.store', $item), [
            'type' => 'image', 'file' => $this->png('buyuk.png')->size(9000), 'alt_text' => 'Test',
        ])->assertSessionHasErrors('file');
        $this->assertDatabaseCount('inventory_media', 0);
    }

    public function test_image_requires_alt_text_and_external_links_require_https(): void
    {
        $user = $this->userWithPermission('inventory.manage_media');
        $item = $this->item();

        $this->actingAs($user)->post(route('admin.inventory.media.store', $item), [
            'type' => 'image', 'file' => $this->png('test.png'),
        ])->assertSessionHasErrors('alt_text');
        $this->actingAs($user)->post(route('admin.inventory.media.store', $item), [
            'type' => 'link', 'external_url' => 'http://example.com/kaynak', 'title' => 'Kaynak',
        ])->assertSessionHasErrors('external_url');
        $this->actingAs($user)->post(route('admin.inventory.media.store', $item), [
            'type' => 'link', 'external_url' => 'https://example.com/kaynak', 'title' => 'Kaynak',
        ])->assertSessionHas('success');

        $this->assertDatabaseHas('inventory_media', ['inventory_item_id' => $item->id, 'type' => 'link', 'external_url' => 'https://example.com/kaynak']);
    }

    public function test_cover_can_be_changed_and_deleting_it_promotes_the_next_image(): void
    {
        $user = $this->userWithPermission('inventory.manage_media');
        $item = $this->item();
        $first = $item->media()->create(['type' => 'image', 'file_path' => 'inventory-media/1/first.jpg', 'alt_text' => 'İlk', 'sort_order' => 1, 'is_cover' => true]);
        $second = $item->media()->create(['type' => 'image', 'file_path' => 'inventory-media/1/second.jpg', 'alt_text' => 'İkinci', 'sort_order' => 2]);
        Storage::disk('public')->put($first->file_path, 'first');

        $this->actingAs($user)->patch(route('admin.inventory.media.update', [$item, $second]), [
            'title' => null, 'alt_text' => 'İkinci görsel', 'sort_order' => 1, 'is_cover' => true,
        ])->assertSessionHas('success');
        $this->assertFalse($first->fresh()->is_cover);
        $this->assertTrue($second->fresh()->is_cover);
        $this->assertSame(2, $first->fresh()->sort_order);
        $this->assertSame(1, $second->fresh()->sort_order);

        $this->actingAs($user)->delete(route('admin.inventory.media.destroy', [$item, $second]))->assertSessionHas('success');
        $this->assertTrue($first->fresh()->is_cover);

        $this->actingAs($user)->delete(route('admin.inventory.media.destroy', [$item, $first]))->assertSessionHas('success');
        Storage::disk('public')->assertMissing($first->file_path);
    }

    public function test_external_link_can_be_safely_edited(): void
    {
        $user = $this->userWithPermission('inventory.manage_media');
        $item = $this->item();
        $medium = $item->media()->create(['type' => 'link', 'external_url' => 'https://example.com/eski', 'sort_order' => 1]);

        $this->actingAs($user)->patch(route('admin.inventory.media.update', [$item, $medium]), [
            'title' => 'Yeni belge', 'alt_text' => null, 'external_url' => 'https://example.com/yeni',
            'sort_order' => 1, 'is_cover' => false,
        ])->assertSessionHas('success');
        $this->assertSame('https://example.com/yeni', $medium->fresh()->external_url);

        $this->actingAs($user)->patch(route('admin.inventory.media.update', [$item, $medium]), [
            'title' => 'Güvensiz', 'alt_text' => null, 'external_url' => 'http://example.com',
            'sort_order' => 1, 'is_cover' => false,
        ])->assertSessionHasErrors('external_url');
    }

    public function test_medium_cannot_be_changed_through_another_item_or_when_item_is_archived(): void
    {
        $user = $this->userWithPermission('inventory.manage_media');
        $item = $this->item();
        $other = $this->item();
        $medium = $item->media()->create(['type' => 'link', 'external_url' => 'https://example.com']);

        $this->actingAs($user)->delete(route('admin.inventory.media.destroy', [$other, $medium]))->assertNotFound();
        $item->update(['is_active' => false, 'archived_at' => now()]);
        $this->actingAs($user)->delete(route('admin.inventory.media.destroy', [$item, $medium]))->assertSessionHasErrors('media');
        $this->assertDatabaseHas('inventory_media', ['id' => $medium->id]);
    }

    private function userWithPermission(string $permission): User
    {
        $role = Role::query()->create(['name' => 'Medya '.uniqid(), 'slug' => 'medya-'.uniqid()]);
        $role->permissions()->attach(Permission::query()->where('key', $permission)->value('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }

    private function item(): InventoryItem
    {
        return InventoryItem::query()->create([
            'name' => 'Arduino Uno', 'slug' => 'arduino-'.uniqid(), 'item_type' => InventoryItemType::Loanable,
            'unit' => 'adet', 'quantity' => 5, 'public_visibility' => InventoryVisibility::Status, 'is_active' => true,
        ]);
    }

    private function png(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        ));
    }
}
