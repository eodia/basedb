---
title: PDF documents
description: A row as an invoice, quote or printable sheet, with its linked rows and totals.
---

A row becomes a **PDF**: an invoice with its lines and its total, a quote, a delivery note, a
sheet. In a row’s details, the **PDF document** button opens it in a new tab, from which the
browser prints or saves it.

## The sheet, with nothing to set up

Without a template, a row prints as a **sheet**: its name as the title, then every field you
can read, in your language.

## Templates

Whoever builds the table — the Manage level — writes them, from a row’s details:
**PDF document › Document templates…**. A template is a page (A4 or Letter, portrait or
landscape), a language for the values, a footer and a sequence of blocks:

| Block | What it shows |
|---|---|
| **Text** | rich text — headings, bold, lists, links — that cites the row’s columns with the **Column** menu: “Invoice `{{numero}}` of `{{date}}`” |
| **Row fields** | the chosen fields, or all of them: label on the left, value on the right |
| **Table of linked rows** | the rows that point to this one — an invoice’s lines — or the ones a multiple relation points to, with the chosen columns and their **totals** |
| **Page break** | the rest on a new page |

The editor shows, alongside, the PDF the template makes of the open row, changes included.

Values are written **in the template’s language**: an amount with its currency (“1,234.50 €”),
a date written out in full (“September 30, 2026”), yes and no, a choice’s label, a person’s
name. The text is set in embedded fonts that cover basedb’s twenty languages, ideographic
characters included.

## Everyone with their own permissions

A document is read **with the permissions of whoever prints it**: a field hidden from them does
not appear there, a linked row they cannot see is not in the table — nor in the total. Two
people can therefore get two different documents from the same row: each has their own.

## By the API

```bash
# A row’s PDF with a template, or a “sheet”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` lists the table’s templates.

## Limits

- No image (logo) or chosen color in a document, no header distinct from the footer.
- One document per row: no multi-row PDF yet, nor generation by an automation.
