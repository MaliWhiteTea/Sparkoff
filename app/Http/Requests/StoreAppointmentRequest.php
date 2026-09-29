<?php

namespace App\Http\Requests;

use App\Models\Setting;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use ZipArchive;

class StoreAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $maximumDuration = (int) Setting::valueOf('booking.maximum_duration_hours', 24) * 60;
        $slotMinutes = (int) Setting::valueOf('booking.slot_minutes', 30);
        $maximumFileSize = (int) Setting::valueOf('uploads.maximum_file_size_mb', 100) * 1024;
        $allowedExtensions = Setting::valueOf('uploads.allowed_extensions', ['gcode', '3mf', 'stl', 'step', 'stp']);

        return [
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'start_time' => ['required', 'date_format:H:i'],
            'duration_minutes' => ['required', 'integer', "min:{$slotMinutes}", "max:{$maximumDuration}"],
            'file' => [
                'required',
                'file',
                "max:{$maximumFileSize}",
                function (string $attribute, mixed $value, Closure $fail) use ($allowedExtensions) {
                    $extension = strtolower($value->getClientOriginalExtension());
                    if (! in_array($extension, $allowedExtensions, true)) {
                        $fail('İzin verilen dosya türleri: '.implode(', ', array_map('strtoupper', $allowedExtensions)).'.');

                        return;
                    }

                    if (! $this->hasValidFileStructure($value, $extension)) {
                        $fail('Dosyanın içeriği seçilen 3D baskı formatıyla uyuşmuyor veya dosya bozuk.');
                    }
                },
            ],
            'filament_source' => ['required', 'in:workshop,own'],
            'material' => ['required', 'string', 'max:40'],
            'color' => ['required', 'string', 'max:80'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'phone' => ['required', 'string', 'max:30', 'regex:/^[0-9+()\s-]{10,30}$/'],
            'note' => ['nullable', 'string', 'max:2000'],
            'rules_accepted' => ['accepted'],
            'privacy_notice_seen' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'required' => ':attribute alanı zorunludur.',
            'date_format' => ':attribute biçimi geçersizdir.',
            'after_or_equal' => 'Geçmiş bir tarih için randevu oluşturamazsınız.',
            'email' => 'Geçerli bir e-posta adresi girin.',
            'phone.regex' => 'Geçerli bir telefon numarası girin.',
            'rules_accepted.accepted' => 'Randevu kurallarını onaylamalısınız.',
            'privacy_notice_seen.accepted' => 'Aydınlatma metnine eriştiğinizi belirtmelisiniz.',
        ];
    }

    public function attributes(): array
    {
        return [
            'date' => 'Randevu tarihi',
            'start_time' => 'Başlangıç saati',
            'duration_minutes' => 'Baskı süresi',
            'file' => 'Baskı dosyası',
            'material' => 'Malzeme',
            'color' => 'Renk',
            'first_name' => 'Ad',
            'last_name' => 'Soyad',
            'email' => 'E-posta',
            'phone' => 'Telefon',
        ];
    }

    private function hasValidFileStructure(UploadedFile $file, string $extension): bool
    {
        $path = $file->getRealPath();
        if (! $path || $file->getSize() === 0) {
            return false;
        }

        $prefix = file_get_contents($path, false, null, 0, 4096);
        if ($prefix === false || str_contains(strtolower($prefix), '<?php')) {
            return false;
        }

        return match ($extension) {
            'gcode' => ! str_contains($prefix, "\0")
                && preg_match('/(^|\R)\s*(?:[GMT]\d+|;)/i', $prefix) === 1,
            'step', 'stp' => str_contains(strtoupper($prefix), 'ISO-10303-21;')
                && str_contains(strtoupper($prefix), 'HEADER;'),
            'stl' => $this->isValidStl($path, $prefix, (int) $file->getSize()),
            '3mf' => $this->isValidThreeMf($path),
            default => false,
        };
    }

    private function isValidStl(string $path, string $prefix, int $size): bool
    {
        if (preg_match('/^\s*solid\b/i', $prefix) === 1
            && stripos($prefix, 'facet') !== false) {
            return true;
        }

        if ($size < 84) {
            return false;
        }

        $header = file_get_contents($path, false, null, 80, 4);
        $triangleCount = $header === false ? null : unpack('Vcount', $header)['count'];

        return is_int($triangleCount) && 84 + ($triangleCount * 50) === $size;
    }

    private function isValidThreeMf(string $path): bool
    {
        if (! class_exists(ZipArchive::class)) {
            return false;
        }

        $archive = new ZipArchive;
        if ($archive->open($path) !== true) {
            return false;
        }

        $hasContentTypes = $archive->locateName('[Content_Types].xml') !== false;
        $hasModel = false;

        for ($index = 0; $index < $archive->numFiles; $index++) {
            $name = $archive->getNameIndex($index);
            if (is_string($name) && preg_match('#^3D/.+\.model$#i', $name) === 1) {
                $hasModel = true;
                break;
            }
        }

        $archive->close();

        return $hasContentTypes && $hasModel;
    }
}
