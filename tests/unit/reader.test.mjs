import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSettings, readerCss } from '../../src/lib/reader/preferences.ts';
import { correspondingSection, parseProgress, progressKey } from '../../src/lib/reader/progress.ts';

test('ignore les réglages corrompus et borne la typographie', () => {
  assert.deepEqual(parseSettings(null), { font: 'site', size: 20, margin: 32, justify: false, palette: 'auto' });
  assert.deepEqual(parseSettings({ font: 'url(evil)', size: 999, margin: -2, palette: '__proto__', justify: true }),
    { font: 'site', size: 32, margin: 8, palette: 'auto', justify: true });
});
test('le signet appartient au livre et se transpose par section entre traductions', () => {
  const p = { edition: 'a.epub', cfi: 'epubcfi(/6/4!/4/2)', sectionIndex: 5, sectionCount: 13, sectionLabel: 'Livre cinquième', sectionFraction: .4, updated: 1 };
  assert.equal(progressKey('book-a'), 'literae-book-progress-v1:book-a');
  assert.notEqual(progressKey('book-a'), progressKey('book-b'));
  assert.deepEqual(parseProgress(p), p);
  assert.equal(correspondingSection(p, [{ index: 0, label: 'Préface' }, { index: 1, label: 'LIVRE CINQUIÈME' }]), 1);
  assert.equal(correspondingSection({ ...p, sectionLabel: '' }, Array.from({ length: 25 }, (_, index) => ({ index, label: '' }))), 10);
  assert.equal(parseProgress({ ...p, sectionIndex: 13 }), null);
});
test('le thème automatique suit le site et les polices supplémentaires sont conditionnelles', () => {
  const auto = parseSettings(null);
  assert.match(readerCss(auto, false, 'https://literae.ch'), /background: #f1eadc/);
  assert.match(readerCss(auto, true, 'https://literae.ch'), /background: #171513/);
  assert.doesNotMatch(readerCss(auto, false, 'https://literae.ch'), /reader-fonts/);
  const lora = readerCss({ ...auto, font: 'lora', palette: 'oled' }, false, 'https://literae.ch');
  assert.match(lora, /reader-fonts\/lora-latin-400-normal.woff2/);
  assert.doesNotMatch(lora, /reader-fonts\/(literata|libre-baskerville)/);
  assert.match(lora, /background: #000000 !important; color: #e7e1d7/);
});
