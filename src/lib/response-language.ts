export function responseLanguageInstruction(language: string) {
  if (language === 'id-ID') return 'BAHASA RESPONS WAJIB: Bahasa Indonesia. Selalu jawab dalam Bahasa Indonesia yang natural, termasuk saat pesan pengguna sangat pendek seperti “hai”, kecuali pengguna secara eksplisit meminta bahasa lain.'
  return 'RESPONSE LANGUAGE REQUIRED: English (US). Always answer in natural English unless the user explicitly requests another language.'
}
