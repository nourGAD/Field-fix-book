/* Example configs. All names, IPs and certificate values are made up — replace them with your site's real data. */
var EXAMPLES = (function () {
  function radios() {
    var r = [];
    [['S1', 2, 'A'], ['S2', 2, 'B'], ['S3', 2, 'C'], ['S4', 4, 'D'], ['S5', 4, 'E'], ['S6', 4, 'F']].forEach(function (x) {
      r.push({ type: 'RRU', sector: x[0], fru: 'RRU-' + x[0], branches: x[1], riPort: x[2] });
    });
    [['S7', 'AIR-1', 'N'], ['S8', 'AIR-2', 'P'], ['S9', 'AIR-3', 'Q']].forEach(function (x) {
      r.push({ type: 'AIR', sector: x[0], fru: x[1], branches: '', riPort: x[2] });
    });
    return r;
  }
  return {
    'Full-style': {
      style: 'full', nodeName: 'SITE01-NL', subNetwork: 'NR', rootMo: 'ONRM_RootMo', networkMeId: 'SITE01-NL', fileTag: '',
      user: { name: 'rbs', password: 'rbs' },
      tn: { port: 'TN_IDL_C_1', fru: 'BB-1', mode: '1G_FULL', autoNeg: true },
      oam: { router: 'OAM', vlanPort: 'OAM', vlan: 3407, ip: '10.20.1.133', prefix: 27, gw: '10.20.1.129' },
      traffic: [
        { router: 'Traffic_LTE', vlanPort: 'S1', vlan: 3406, ip: '10.30.1.133', prefix: 27, gw: '10.30.1.129' },
        { router: 'NR_CP', vlanPort: 'NR_CP', vlan: 3943, ip: '10.20.9.4', prefix: 27, gw: '10.20.9.1' },
        { router: 'NR_UP', vlanPort: 'NR_UP', vlan: 3942, ip: '10.30.9.4', prefix: 27, gw: '10.30.9.1' }
      ],
      f1: { enabled: true, cucp: '169.254.42.42', du: '169.254.42.43' },
      snmp: { id: 'ENMFM', community: 'public', target: '192.0.2.40' },
      ntp: ['192.0.2.18', '192.0.2.19'],
      dns: '192.0.2.53',
      security: { certm: true, caFingerprint: '00:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff:00:11:22:33',
        caName: 'CN=NE_OAM_CA,O=EXAMPLE', enrollUri: 'http://192.0.2.13:8091/pkira-cmp/NE_OAM_CA/synch',
        ldap: true, legalNotice: 'IF YOU ARE NOT AN AUTHORIZED USER, PLEASE EXIT IMMEDIATELY', loginFailureDelay: 5, cliSshPort: 2023 },
      radios: radios()
    },
    'Basic-style': {
      style: 'basic', nodeName: 'SITE02-NL', subNetwork: 'NR', rootMo: 'ONRM_RootMo', networkMeId: 'SITE02-NL', fileTag: '',
      user: { name: 'rbs', password: 'rbs' },
      tn: { port: 'TN_IDL_C', fru: 'BB-1', mode: '1G_FULL', autoNeg: true },
      oam: { router: 'vr_OAM', vlanPort: 'OAM', vlan: 3251, ip: '10.20.2.196', prefix: 27, gw: '10.20.2.193' },
      traffic: [
        { router: 'Traffic_LTE', vlanPort: 'S1', vlan: 3250, ip: '10.30.2.196', prefix: 27, gw: '10.30.2.193' },
        { router: 'NR_CP', vlanPort: 'NR_CP', vlan: 3945, ip: '10.20.9.36', prefix: 27, gw: '10.20.9.33' },
        { router: 'NR_UP', vlanPort: 'NR_UP', vlan: 3944, ip: '10.30.9.36', prefix: 27, gw: '10.30.9.33' }
      ],
      f1: { enabled: true, cucp: '169.254.42.42', du: '169.254.42.43' },
      snmp: { id: 'ENMFM', community: 'public', target: '192.0.2.40' },
      ntp: ['192.0.2.18', '192.0.2.19'],
      dns: '',
      security: { certm: false, ldap: false, legalNotice: '', loginFailureDelay: 5, cliSshPort: 2023 },
      radios: radios()
    }
  };
})();
if (typeof module !== 'undefined') module.exports = EXAMPLES;
