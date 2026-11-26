import os
import sys
from docx import Document
from docx.oxml.ns import qn

def iter_body_elements(doc):
    """Yield ('p', paragraph) or ('tbl', table) in document order."""
    body = doc.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield ('p', child)
        elif child.tag == qn('w:tbl'):
            yield ('tbl', child)

def get_paragraph_text(p_elem):
    from docx.oxml.text.paragraph import CT_P
    para = Document().paragraphs[0]._element.__class__(p_elem)  # dummy to use .text
    # Simpler: use docx.text.paragraph parsing via Document.
    # Instead, reconstruct paragraph via docx library:
    # Create temporary Document with this element
    tmp_doc = Document()
    tmp_doc._body._element.append(p_elem)
    text = tmp_doc.paragraphs[0].text.strip()
    # remove added element to avoid side effects
    tmp_doc._body._element.remove(p_elem)
    return text

def extract_table_data(tbl_elem):
    # Use docx library to parse table element
    tmp_doc = Document()
    tmp_doc._body._element.append(tbl_elem)
    table = tmp_doc.tables[0]
    data = []
    for row in table.rows:
        data.append([cell.text.strip() for cell in row.cells])
    tmp_doc._body._element.remove(tbl_elem)
    return data

def main():
    src_path = r"C:\Users\eco\Downloads\Compressed\SAS\SMK\SOAL ASAS CBT GANJIL T.P 2026-2027-20261125T001259Z-1-001\SOAL ASAS CBT GANJIL T.P 2026-2027\SOAL KELAS 10\PROJEK IPAS\SOAL SAS PROJEK IPAS  KELAS 10.rtf.docx"
    tmpl_path = r"C:\Users\eco\Downloads\Compressed\SAS\SMK\soal_word.docx"
    out_path = r"C:\Users\eco\Downloads\Compressed\SAS\SMK\SOAL_SAS_PROJEK_IPAS_KELAS_10_converted.docx"

    src_doc = Document(src_path)
    tmpl_doc = Document(tmpl_path)

    elements = list(iter_body_elements(src_doc))
    # Pair prompts with option tables
    questions = []
    i = 0
    while i < len(elements):
        typ, elem = elements[i]
        if typ == 'p':
            prompt = get_paragraph_text(elem)
            # look ahead for option table
            if i + 1 < len(elements) and elements[i+1][0] == 'tbl':
                tbl_data = extract_table_data(elements[i+1][1])
                # flatten cells to options list (order a,b,c,d,e)
                # assume first row has a,c,e and second row b,d (if 2 rows)
                opts = []
                if len(tbl_data) == 2:
                    # row0: a c e, row1: b d (ignore empty)
                    opts.append(tbl_data[0][0])  # a
                    opts.append(tbl_data[1][0])  # b
                    opts.append(tbl_data[0][1])  # c
                    opts.append(tbl_data[1][1])  # d
                    opts.append(tbl_data[0][2])  # e
                else:
                    # fallback: flatten row-major
                    opts = [cell for row in tbl_data for cell in row if cell]
                questions.append({'prompt': prompt, 'options': opts})
                i += 2
                continue
        i += 1
    # Build output document
    for q in questions:
        tmpl_doc.add_paragraph(q['prompt'])
        table = tmpl_doc.add_table(rows=1, cols=5)
        hdr_cells = table.rows[0].cells
        for idx, opt in enumerate(q['options'][:5]):
            hdr_cells[idx].text = opt
        tmpl_doc.add_paragraph('')
    # Add metadata (grade and submateri) at end
    tmpl_doc.add_paragraph(f"GRADE = {100/len(questions):.2f}")
    tmpl_doc.add_paragraph('SUBMATERI = "Projek IPAS"')
    tmpl_doc.save(out_path)

if __name__ == '__main__':
    main()
