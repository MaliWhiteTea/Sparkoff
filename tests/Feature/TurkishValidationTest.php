<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class TurkishValidationTest extends TestCase
{
    public function test_common_validation_errors_are_rendered_in_turkish_instead_of_as_translation_keys(): void
    {
        $validator = Validator::make([
            'name' => '',
            'email' => 'gecersiz',
            'password' => 'kisa',
        ], [
            'name' => ['required'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:12'],
        ]);

        $messages = $validator->errors()->all();

        $this->assertContains('ad alanı zorunludur.', $messages);
        $this->assertContains('e-posta adresi geçerli bir e-posta adresi olmalıdır.', $messages);
        $this->assertContains('parola en az 12 karakter olmalıdır.', $messages);
        $this->assertSame([], array_values(array_filter($messages, fn (string $message) => str_starts_with($message, 'validation.'))));
    }
}
