# JARVIS — SAS Question Converter

## Identitas Proyek
Nama: Jarvis
Fungsi: Konversi naskah soal SAS (Sumatif Akhir Semester) SMK dari Word ke template `soal_word.docx`.
Lokasi kerja: `C:\mycursor\jarvis`

## Tujuan Utama
Konversi seluruh file soal di folder sumber ke template import CBT, satu file output per mata pelajaran per kelas.

- Folder sumber (SATU-SATUNYA yang boleh dipakai):
  `C:\Users\eco\Downloads\Compressed\SAS\SMK\SOAL ASAS CBT GANJIL T.P 2026-2027-20261125T001259Z-1-001\SOAL ASAS CBT GANJIL T.P 2026-2027`
- Template target: `C:\Users\eco\Downloads\Compressed\SAS\SMK\soal_word.docx`
- Pola nama output: `SOAL_SAS_<MAPEL>_KELAS_<KELAS>_converted.docx`

## Status Saat Ini
- Kelas 10: SELESAI (12 mapel, terverifikasi)
- Kelas 11: SELESAI (9 mapel, terverifikasi)
- Kelas 12: SELESAI (7 mapel, terverifikasi)
- Semua output ada di `C:\Users\eco\Downloads\Compressed\SAS\SMK`

## Aturan Konversi (WAJIB)
1. Jangan ubah file sumber.
2. Pertahankan bacaan/kutipan bersama — salin ke setiap soal yang mereferensikannya.
3. Pakai kunci sumber bila ada. Bila kunci kosong/tidak ada, analisis dan tentukan jawaban.
4. Lewati file kisi-kisi/kunci yang bukan naskah soal.
5. Kerjakan satu file per proses, otomatis, tanpa tanya balik.
6. Verifikasi tiap output sebelum klaim selesai.

## Format Template (KRITIS)
- Tabel 0: 1351 baris x 3 kolom.
- Tiap slot soal = 9 baris: NOMOR, SUBMATERI, GRADE, TANYA, OPSI x5.
- Baris dasar slot N = `1 + (N-1) * 9`.
- Kolom 2 (Jawaban): `1` untuk opsi benar, `0` untuk salah. Tepat satu `1` per soal.
- GRADE = `2` untuk 50 soal, `2.5` untuk 40 soal.
- Kosongkan slot setelah soal terakhir.

## Helper Standar
```python
def set_cell(cell, text):
    p = cell.paragraphs[0]
    p.text = str(text)
    for extra in list(cell.paragraphs[1:]):
        extra._element.getparent().remove(extra._element)
```

## Pola Kerja
1. Inventarisasi file sumber per kelas.
2. Inspeksi struktur tiap file (paragraf, tabel, kunci).
3. Dispatch subagent paralel per mapel ke background.
4. Verifikasi independen tiap output (jumlah soal, satu kunci benar, slot kosong).
5. Catat masalah sumber (gambar hilang, kunci kosong, opsi kurang).

## Gaya Komunikasi
Jawab ringkas. Substansi teknis tepat. Buang basa-basi.
```