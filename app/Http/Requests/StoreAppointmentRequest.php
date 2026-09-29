<?php

namespace App\Http\Requests;

use App\Models\Setting;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class StoreAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $maximumDuration = (int) Setting::valueOf('booking.maximum_duration_hours', 24) * 60;
        $maximumFileSize = (int) Setting::valueOf('uploads.maximum_file_size_mb', 100) * 1024;
        $allowedExtensions = Setting::valueOf('uploads.allowed_extensions', ['gcode', '3mf', 'stl', 'step', 'stp']);

        return [
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'start_time' => ['required', 'date_format:H:i'],
            'duration_minutes' => ['required', 'integer', 'min:30', "max:{$maximumDuration}"],
            'file' => [
                'required',
                'file',
                "max:{$maximumFileSize}",
                function (string $attribute, mixed $value, Closure $fail) use ($allowedExtensions) {
                    $extension = strtolower($value->getClientOriginalExtension());
                    if (! in_array($extension, $allowedExtensions, true)) {
                        $fail('Yalnızca G-code, 3MF, STL, STEP veya STP dosyası yükleyebilirsiniz.');
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
}
