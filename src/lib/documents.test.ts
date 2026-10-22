import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeDocument, documentProblem } from "./documents";

const url = (mime: string, bytes: number[] | Buffer) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
const PDF = Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n");
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70];

test("documents: real PDF, PNG and JPG files are accepted", () => {
  assert.equal(documentProblem(url("application/pdf", PDF), 0), null);
  assert.equal(documentProblem(url("image/png", PNG), 0), null);
  assert.equal(documentProblem(url("image/jpeg", JPG), 0), null);
});

test("documents: a file only named like a PDF, other types and oversize files are refused", () => {
  const msg = "Faqat PDF, JPG yoki PNG, 2 MB gacha";
  assert.equal(documentProblem(url("application/pdf", Buffer.from("just some text, renamed")), 0), msg);
  assert.equal(documentProblem(url("text/plain", Buffer.from("%PDF-1.7")), 0), msg);
  assert.equal(documentProblem("not a data url", 0), msg);
  const big = Buffer.concat([PDF, Buffer.alloc(2 * 1024 * 1024 + 1 - PDF.length)]);
  assert.equal(documentProblem(url("application/pdf", big), 0), msg);
  const justFits = Buffer.concat([PDF, Buffer.alloc(2 * 1024 * 1024 - PDF.length)]);
  assert.equal(documentProblem(url("application/pdf", justFits), 0), null);
});

test("documents: at most 30 per student", () => {
  assert.equal(documentProblem(url("application/pdf", PDF), 29), null);
  assert.equal(documentProblem(url("application/pdf", PDF), 30), "Ko'pi bilan 30 ta hujjat");
});

test("documents: the type comes from the file itself", () => {
  const d = decodeDocument(url("application/octet-stream", PNG));
  assert.deepEqual([d.mime, d.ext, d.bytes.length], ["image/png", "png", PNG.length]);
  assert.equal(decodeDocument(url("application/pdf", PDF)).ext, "pdf");
  assert.equal(decodeDocument(url("image/jpeg", JPG)).mime, "image/jpeg");
});
