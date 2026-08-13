'use strict';

/**
 * Captures one editor mock-up per theme for the README.
 *
 *   node ./scripts/screenshots.js
 *
 * These are not photographs of VS Code — they are a reconstruction of its
 * chrome, painted with the theme's own colour keys and with the syntax resolved
 * through scripts/scopes.js, the same matcher `yarn fixtures` uses. That is the
 * point: a screenshot taken by hand goes stale the moment a palette moves, and
 * nobody notices. These regenerate, so a README image that disagrees with the
 * theme is a diff rather than a surprise.
 *
 * Every theme renders the same file, so the captures are comparable.
 */

const fs = require('fs');
const path = require('path');
const { readSource } = require('./yaml');
const { resolve: resolveScope } = require('./scopes');
const { requireChromium, shoot } = require('./chromium');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

const WIDTH = 1200;
const HEIGHT = 700;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Scope stacks a real TypeScript-React grammar emits. Resolved per theme, so
 * each capture is painted by the theme's own rules rather than by a guess.
 */
const SCOPES = {
    cmt: ['source.tsx', 'comment.line.double-slash.tsx'],
    kw: ['source.tsx', 'keyword.control.import.tsx'],
    kwf: ['source.tsx', 'keyword.control.flow.tsx'],
    storage: ['source.tsx', 'storage.type.tsx'],
    str: ['source.tsx', 'string.quoted.double.tsx'],
    fn: ['source.tsx', 'meta.definition.function.tsx', 'entity.name.function.tsx'],
    call: ['source.tsx', 'meta.function-call.tsx', 'entity.name.function.tsx'],
    typ: ['source.tsx', 'entity.name.type.tsx'],
    num: ['source.tsx', 'constant.numeric.decimal.tsx'],
    tag: ['source.tsx', 'meta.tag.tsx', 'entity.name.tag.tsx'],
    attr: ['source.tsx', 'meta.tag.tsx', 'entity.other.attribute-name.tsx'],
    v: ['source.tsx', 'variable.other.readwrite.tsx'],
    prop: ['source.tsx', 'variable.other.property.tsx'],
    op: ['source.tsx', 'keyword.operator.arithmetic.tsx'],
    p: ['source.tsx', 'punctuation.separator.comma.tsx'],
};

// prettier-ignore
const CODE = [
  [['// Hohmann transfer — solve for the insertion burn', 'cmt']],
  [['import', 'kw'], [' { '], ['useMemo', 'v'], [', '], ['useState', 'v'], [' } '], ['from', 'kw'], [' '], ['"react"', 'str'], [';', 'p']],
  [],
  [['type', 'storage'], [' '], ['Burn', 'typ'], [' = { '], ['dv', 'prop'], [': '], ['number', 'typ'], ['; '], ['at', 'prop'], [': '], ['string', 'typ'], [' };']],
  [],
  [['const', 'storage'], [' '], ['MU', 'v'], [' = '], ['398600.4418', 'num'], [';', 'p'], ['  '], ['// km³/s²', 'cmt']],
  [],
  [['export', 'kw'], [' '], ['function', 'storage'], [' '], ['TransferWindow', 'fn'], ['('], ['{ from, to }', 'v'], [': '], ['Props', 'typ'], [') {']],
  [['  '], ['const', 'storage'], [' ['], ['burn', 'v'], [', '], ['setBurn', 'v'], ['] = '], ['useState', 'call'], ['<'], ['Burn', 'typ'], [' | '], ['null', 'v'], ['>('], ['null', 'v'], [');']],
  [],
  [['  '], ['const', 'storage'], [' '], ['dv', 'v'], [' = '], ['useMemo', 'call'], ['(() '], ['=>', 'op'], [' {']],
  [['    '], ['const', 'storage'], [' '], ['a', 'v'], [' = ('], ['from', 'v'], [' '], ['+', 'op'], [' '], ['to', 'v'], [') '], ['/', 'op'], [' '], ['2', 'num'], [';', 'p']],
  [['    '], ['return', 'kwf'], [' '], ['Math', 'v'], ['.'], ['sqrt', 'call'], ['('], ['MU', 'v'], [' '], ['/', 'op'], [' '], ['a', 'v'], [') '], ['*', 'op'], [' '], ['1000', 'num'], [';', 'p']],
  [['  }, ['], ['from', 'v'], [', '], ['to', 'v'], [']);']],
  [],
  [['  '], ['return', 'kwf'], [' (']],
  [['    <'], ['Panel', 'tag'], [' '], ['title', 'attr'], ['='], ['"Transfer window"', 'str'], [' '], ['onSelect', 'attr'], ['={'], ['setBurn', 'v'], ['}>']],
  [['      <'], ['Readout', 'tag'], [' '], ['label', 'attr'], ['='], ['"Δv"', 'str'], [' '], ['value', 'attr'], ['={'], ['dv', 'v'], ['} '], ['unit', 'attr'], ['='], ['"km/s"', 'str'], [' />']],
  [['    </'], ['Panel', 'tag'], ['>']],
  [['  );']],
  [['}']],
];

const FILES = [
    { name: 'src', dir: true },
    {
        name: 'transfer.tsx',
        indent: 1,
        active: true,
        git: 'M',
        decoration: 'gitDecoration.modifiedResourceForeground',
    },
    { name: 'orbit.ts', indent: 1 },
    {
        name: 'telemetry.ts',
        indent: 1,
        git: 'U',
        decoration: 'gitDecoration.untrackedResourceForeground',
    },
    { name: 'burn.test.ts', indent: 1, git: '!', decoration: 'editorError.foreground' },
    { name: 'package.json' },
    { name: 'README.md' },
];

/** Builds a full-bleed page containing only the window, at exactly WIDTH×HEIGHT. */
function page(theme) {
    const C = theme.colors;
    const cache = new Map();

    const paint = (key) => {
        if (!cache.has(key)) {
            const s = resolveScope(SCOPES[key], theme.tokenColors) || {};
            cache.set(key, {
                color: s.foreground || C['editor.foreground'],
                style: s.fontStyle || '',
            });
        }
        return cache.get(key);
    };

    const code = CODE.map((line, i) => {
        const cursor = i === 11;
        const body = line
            .map(([text, key]) => {
                if (!key) return esc(text);
                const { color, style } = paint(key);
                const italic = style.includes('italic') ? ';font-style:italic' : '';
                return `<span style="color:${color}${italic}">${esc(text)}</span>`;
            })
            .join('');
        return (
            `<div class="ln${cursor ? ' cur' : ''}">` +
            `<span class="gut">${i + 1}</span>` +
            `<span class="src">${body}${cursor ? '<i class="caret"></i>' : ''}</span>` +
            `</div>`
        );
    }).join('');

    const files = FILES.map((f) => {
        const bg = f.active ? `background:${C['list.activeSelectionBackground']};` : '';
        const fg = f.active
            ? C['list.activeSelectionForeground']
            : f.decoration
              ? C[f.decoration]
              : C['sideBar.foreground'];
        const indent = 14 + (f.indent || 0) * 14;
        return (
            `<div class="row" style="${bg}padding-left:${indent}px;color:${fg};${f.dir ? 'font-weight:600;' : ''}">` +
            `<span>${f.dir ? '▾ ' : ''}${f.name}</span>` +
            `${f.git ? `<span style="color:${C[f.decoration]}">${f.git}</span>` : ''}` +
            `</div>`
        );
    }).join('');

    const border = C['editorGroup.border'] || C['contrastBorder'] || C['panel.border'];

    return `<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
    font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px; line-height: 1.75;
    background: ${C['editor.background']};
    display: flex; flex-direction: column;
  }
  .titlebar {
    display: flex; align-items: center; padding: 9px 14px; flex: none; font-size: 12px;
    background: ${C['titleBar.activeBackground']}; color: ${C['titleBar.activeForeground']};
  }
  .dots { display: flex; gap: 7px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .wtitle { margin: 0 auto; opacity: .85; }
  .body { display: flex; flex: 1; min-height: 0; }
  .activity {
    width: 48px; flex: none; padding: 12px 0; display: flex; flex-direction: column;
    align-items: center; gap: 18px; font-size: 16px;
    background: ${C['activityBar.background']};
    color: ${C['activityBar.inactiveForeground']};
    border-right: 1px solid ${C['activityBar.border'] || border};
  }
  .on { color: ${C['activityBar.foreground']}; position: relative; }
  .on::before {
    content: ""; position: absolute; left: -14px; top: -3px; bottom: -3px; width: 2px;
    background: ${C['activityBar.activeBorder']};
  }
  .badge {
    background: ${C['activityBarBadge.background']}; color: ${C['activityBarBadge.foreground']};
    font-size: 9px; border-radius: 999px; padding: 1px 5px; line-height: 1.5;
  }
  .side {
    width: 210px; flex: none;
    background: ${C['sideBar.background']}; color: ${C['sideBar.foreground']};
    border-right: 1px solid ${C['sideBar.border'] || border};
  }
  .sidehead {
    font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; padding: 10px 14px;
    color: ${C['sideBarSectionHeader.foreground']};
    background: ${C['sideBarSectionHeader.background']};
  }
  .row { display: flex; justify-content: space-between; padding: 3px 14px; }
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: ${C['editor.background']}; }
  .tabs { display: flex; flex: none; background: ${C['editorGroupHeader.tabsBackground']}; }
  .tab {
    padding: 9px 16px; font-size: 12px;
    background: ${C['tab.inactiveBackground']}; color: ${C['tab.inactiveForeground']};
    border-right: 1px solid ${C['tab.border'] || border};
  }
  .tab.sel {
    background: ${C['tab.activeBackground']}; color: ${C['tab.activeForeground']};
    box-shadow: inset 0 2px 0 ${C['tab.activeBorderTop'] || C['tab.activeBorder']};
  }
  .code { flex: 1; padding: 12px 0; overflow: hidden; }
  .ln { display: flex; white-space: pre; padding: 0 12px; }
  .ln.cur { background: ${C['editor.lineHighlightBackground']}; }
  .gut {
    width: 26px; flex: none; text-align: right; margin-right: 20px; user-select: none;
    color: ${C['editorLineNumber.foreground']};
  }
  .ln.cur .gut { color: ${C['editorLineNumber.activeForeground']}; }
  .src { color: ${C['editor.foreground']}; }
  .caret {
    display: inline-block; width: 2px; height: 1.1em; vertical-align: text-bottom;
    background: ${C['editorCursor.foreground']}; margin-left: 1px;
  }
  .panel {
    flex: none; padding: 9px 16px 12px;
    background: ${C['panel.background']};
    border-top: 1px solid ${C['panel.border'] || border};
  }
  .ptabs { display: flex; gap: 18px; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 8px; }
  .pon { color: ${C['panelTitle.activeForeground']}; border-bottom: 1px solid ${C['panelTitle.activeBorder']}; padding-bottom: 3px; }
  .poff { color: ${C['panelTitle.inactiveForeground']}; }
  .term { color: ${C['terminal.foreground']}; white-space: pre; font-size: 12.5px; }
  .status {
    flex: none; display: flex; gap: 16px; padding: 5px 14px; font-size: 11.5px;
    background: ${C['statusBar.background']}; color: ${C['statusBar.foreground']};
  }
  .right { margin-left: auto; display: flex; gap: 16px; }
</style>
<div class="titlebar">
  <span class="dots">
    <span class="dot" style="background:${C['editorCursor.foreground']}"></span>
    <span class="dot" style="background:${C['editorWarning.foreground']}"></span>
    <span class="dot" style="background:${C['gitDecoration.untrackedResourceForeground']}"></span>
  </span>
  <span class="wtitle">transfer.tsx — satellite</span>
</div>
<div class="body">
  <div class="activity">
    <span class="on">❐</span><span>⌕</span><span>⑂</span>
    <span class="badge">3</span><span>▷</span><span>⬡</span>
  </div>
  <div class="side">
    <div class="sidehead">Explorer</div>
    ${files}
  </div>
  <div class="main">
    <div class="tabs">
      <div class="tab sel">transfer.tsx</div>
      <div class="tab">orbit.ts</div>
      <div class="tab">README.md</div>
    </div>
    <div class="code">${code}</div>
    <div class="panel">
      <div class="ptabs">
        <span class="pon">Terminal</span><span class="poff">Problems</span><span class="poff">Output</span>
      </div>
      <div class="term"><span style="color:${C['terminal.ansiGreen']}">➜</span>  yarn verify --strict</div>
      <div class="term">   <span style="color:${C['terminal.ansiGreen']}">all checks passed</span></div>
    </div>
  </div>
</div>
<div class="status">
  <span>⑂ main*</span><span>◇ 0  ⚠ 2</span>
  <span class="right"><span>TypeScript JSX</span><span>UTF-8</span><span>Ln 12, Col 34</span></span>
</div>
`;
}

function capture() {
    const chromium = requireChromium();
    const themes = readSource('themes.yml');
    const scratch = path.join(ASSETS, '.shot.html');
    const written = [];

    for (const entry of themes) {
        const built = path.join(ROOT, entry.output);
        if (!fs.existsSync(built)) {
            throw new Error(`${entry.output} is missing — run \`yarn build\` first`);
        }
        const theme = JSON.parse(fs.readFileSync(built, 'utf8'));
        fs.writeFileSync(scratch, page(theme));

        const out = path.join(ASSETS, `screenshot-${entry.id}.png`);
        written.push({
            ...shoot(chromium, scratch, out, WIDTH, HEIGHT),
            label: entry.label,
        });
    }

    fs.unlinkSync(scratch);
    return written;
}

module.exports = { capture };

if (require.main === module) {
    try {
        for (const r of capture()) {
            process.stdout.write(
                `  ok     ${path.relative(ROOT, r.out).padEnd(38)} ${r.width}×${r.height}  ${(r.bytes / 1024).toFixed(1)} KB\n`,
            );
        }
    } catch (err) {
        process.stderr.write(`\nScreenshots failed: ${err.message}\n`);
        process.exit(1);
    }
}
