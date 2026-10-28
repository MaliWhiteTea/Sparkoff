<?php

namespace Tests\Feature;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;
use Tests\TestCase;

class SafeDraftDataBoundaryTest extends TestCase
{
    public function test_safe_draft_policy_excludes_sensitive_field_names(): void
    {
        $policy = file_get_contents(resource_path('js/config/safeDraftFields.ts'));

        foreach ([
            'password', 'email', 'phone', 'whatsapp', 'address',
            'controllerName', 'controllerAddress', 'contactEmail',
            'recipient_name', 'recipient_email', 'applicant', 'publicId',
            'file', 'fileName', 'originalName', 'modelFile', 'url', 'altText',
        ] as $field) {
            $this->assertStringNotContainsString("'{$field}'", $policy, $field);
        }
    }

    public function test_only_approved_operational_pages_can_use_browser_drafts(): void
    {
        $expected = [
            'Admin/Announcements/Index.tsx',
            'Admin/Inventory/Index.tsx',
            'Admin/Settings/BookingRules.tsx',
            'Admin/Settings/Filaments.tsx',
            'Admin/Settings/Printers.tsx',
            'Admin/Settings/Privacy.tsx',
            'Admin/Settings/Workshop.tsx',
        ];
        $actual = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(resource_path('js/pages/Admin')));

        foreach ($iterator as $file) {
            if (! $file instanceof SplFileInfo || ! $file->isFile() || $file->getExtension() !== 'tsx') {
                continue;
            }

            $source = file_get_contents($file->getPathname());
            if (str_contains($source, "from '@/hooks/useSafeDraft'") || str_contains($source, 'from "@/hooks/useSafeDraft"')) {
                $actual[] = str_replace(resource_path('js/pages').DIRECTORY_SEPARATOR, '', $file->getPathname());
            }
        }

        sort($actual);
        $this->assertSame($expected, $actual);
    }

    public function test_personal_delivery_appointment_password_and_file_forms_do_not_use_drafts(): void
    {
        foreach ([
            'js/pages/Admin/Login.tsx',
            'js/pages/Admin/Access/Index.tsx',
            'js/pages/Admin/Appointments/Index.tsx',
            'js/pages/Admin/Appointments/Show.tsx',
            'js/pages/Admin/InventoryTransactions/Index.tsx',
            'js/pages/Admin/Inventory/Import.tsx',
            'js/pages/Admin/Settings/Personal.tsx',
        ] as $path) {
            $source = file_get_contents(resource_path($path));

            $this->assertStringNotContainsString('useSafeDraft', $source, $path);
        }
    }

    public function test_inventory_media_file_state_is_outside_the_draft_hook(): void
    {
        $inventory = file_get_contents(resource_path('js/pages/Admin/Inventory/Index.tsx'));
        preg_match('/function MediaManager.*?function MediaEditor/s', $inventory, $mediaManager);

        $this->assertNotEmpty($mediaManager);
        $this->assertStringContainsString('useState<File | null>', $mediaManager[0]);
        $this->assertStringNotContainsString('useSafeDraft', $mediaManager[0]);
    }

    public function test_contact_and_privacy_identity_fields_are_not_passed_to_draft_storage(): void
    {
        $workshop = file_get_contents(resource_path('js/pages/Admin/Settings/Workshop.tsx'));
        $privacy = file_get_contents(resource_path('js/config/safeDraftFields.ts'));

        $this->assertStringContainsString('source: { hours }', $workshop);
        $this->assertStringContainsString('safeDraftFields.workshopHours', $workshop);
        $this->assertStringContainsString("privacyRetention: ['appointmentRetentionMonths', 'fileRetentionDays', 'noticeVersion', 'isDraft']", $privacy);
    }
}
