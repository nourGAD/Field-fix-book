// node test/run.js — checks the generator and the file checker. Exits 1 on any failure.
const C = require('../src/core.js'), EX = require('../src/examples.js');
let fail = 0; const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fail++; };
const clone = o => JSON.parse(JSON.stringify(o));

for (const [name, cfg] of Object.entries(EX)) {
  ok(C.validateConfig(cfg).errors.length === 0, name + ': example config has no errors');
  const sb = C.generateSiteBasic(cfg), eq = C.generateSiteEquipment(cfg);
  ok(C.lintXml(sb).errors.length === 0, name + ': generated Site Basic passes the checker');
  ok(C.lintXml(eq).errors.length === 0, name + ': generated Site Equipment passes the checker');
  ok(/<loopback \/>/.test(sb) && !/<loopback>/.test(sb), name + ': loopback written as an empty tag');
  ok(sb.split('\r\n').length > 100 && sb.endsWith(']]>]]>\r\n'), name + ': CRLF line endings and NETCONF framing');
  const r = C.importFiles([sb, eq], EX[Object.keys(EX).find(k => k !== name)]);
  ok(C.generateSiteBasic(r.cfg) === sb && C.generateSiteEquipment(r.cfg) === eq, name + ': import -> regenerate gives identical files');
}

const base = EX['Full-style'];
const bad = {
  'duplicate VLAN on the port': c => c.traffic[1].vlan = c.traffic[0].vlan,
  'space in node name': c => c.nodeName = 'SITE 01',
  'gateway outside subnet': c => c.traffic[0].gw = '10.20.1.129',
  'network address as host IP': c => c.traffic[0].ip = '10.30.1.128',
  'RI port that does not exist': c => c.radios[0].riPort = 'I',
  'RI port used twice': c => c.radios[1].riPort = c.radios[0].riPort,
  'same IP twice': c => c.traffic[1].ip = c.traffic[0].ip,
  'VLAN out of range': c => c.traffic[0].vlan = 5000,
  'bad CA fingerprint': c => c.security.caFingerprint = 'xx',
  'router name used twice': c => c.traffic[1].router = c.oam.router
};
for (const [what, mutate] of Object.entries(bad)) { const c = clone(base); mutate(c); ok(C.validateConfig(c).errors.length > 0, 'blocks: ' + what); }

// checker catches the real-world load errors
const sb = C.generateSiteBasic(EX['Basic-style']);
const noLoop = sb.replace(/\s*<loopback \/>/g, '');
ok(C.lintXml(noLoop).errors.some(e => /neither encapsulation nor loopback/.test(e.msg)), 'checker: missing loopback');
const loopTrue = sb.replace('<loopback />', '<loopback>true</loopback>');
ok(C.lintXml(loopTrue).errors.some(e => /EcimEmpty/.test(e.msg)), 'checker: <loopback>true</loopback>');
const dupVlan = sb.replace('<vlanId>3944</vlanId>', '<vlanId>3250</vlanId>');
ok(C.lintXml(dupVlan).errors.some(e => /already used/.test(e.msg)), 'checker: duplicate VLAN');
ok(C.lintXml(sb, 'Site Basic.xml').errors.some(e => /spaces/.test(e.msg)), 'checker: space in file name');


// file names + RBS Summary
const fn = C.fileNames(Object.assign(clone(base), { nodeName: 'SITE01-NL', fileTag: '2026_10_28' }));
ok(Object.values(fn).every(n => /^[A-Za-z0-9_]+\.xml$/.test(n)), 'file names use only letters, digits and _ (' + fn.basic + ')');
const sum = C.generateSummary(fn, base.upgradePackage);
const ls = C.lintXml(sum, fn.summary);
ok(ls.errors.length === 0 && ls.info.paths.siteBasicFilePath === fn.basic && ls.info.paths.siteEquipmentFilePath === fn.equip && ls.info.paths.upgradePackageFilePath === base.upgradePackage, 'summary points to the generated files and the upgrade package');
ok(/<Format revision="F" \/>/.test(sum) && /xmlns:summary="http:\/\/www\.ericsson\.se\/RbsSummaryFileSchema"/.test(sum), 'summary keeps root, namespace and Format revision F');
let threw = false; try { C.generateSummary(fn, ''); } catch (e) { threw = true; }
ok(threw && !C.summaryStatus(Object.assign(clone(base), { upgradePackage: '' })).ok, 'no summary without an upgrade package');
ok(C.lintXml(sum.replace(/siteEquipmentFilePath="[^"]*"/, 'siteEquipmentFilePath=""')).errors.length > 0, 'checker: empty path in summary');
ok(C.lintXml(sum.replace(/upgradePackageFilePath="[^"]*"/, 'upgradePackageFilePath="<upgrade-package>"')).errors.length > 0, 'checker: placeholder left in summary');
ok(C.importFiles([sum], clone(EX['Basic-style'])).cfg.upgradePackage === base.upgradePackage, 'import reads the upgrade package from a summary');
ok(C.validateConfig(Object.assign(clone(base), { fileTag: '2026-10-28' })).errors.length > 0, 'blocks: "-" in file name tag');

console.log(fail ? fail + ' test(s) failed' : 'All tests passed'); process.exit(fail ? 1 : 0);
