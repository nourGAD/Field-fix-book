/* RBS Site Script Generator core — pure functions, no DOM.
   generateSiteBasic(cfg) / generateSiteEquipment(cfg) / validateConfig(cfg) / lintXml(text) */
var Core = (function () {
  'use strict';
  var NC = 'urn:ietf:params:xml:ns:netconf:base:1.0';
  var NS = {
    top: 'urn:com:ericsson:ecim:ComTop', lm: 'urn:com:ericsson:ecim:RcsLM', secm: 'urn:com:ericsson:ecim:RcsSecM',
    certm: 'urn:com:ericsson:ecim:RcsCertM', ldap: 'urn:com:ericsson:ecim:RcsLdapAuthentication', user: 'urn:com:ericsson:ecim:RcsUser',
    sysm: 'urn:com:ericsson:ecim:RcsSysM', snmp: 'urn:com:ericsson:ecim:RcsSnmp', timem: 'urn:com:ericsson:ecim:RcsTimeM',
    router: 'urn:com:ericsson:ecim:RtnL3Router', if4: 'urn:com:ericsson:ecim:RtnL3InterfaceIPv4', eth: 'urn:com:ericsson:ecim:RtnL2EthernetPort',
    vlan: 'urn:com:ericsson:ecim:RtnL2VlanPort', route: 'urn:com:ericsson:ecim:RtnRoutesStaticRouteIPv4', dns: 'urn:com:ericsson:ecim:RtnDnsClient',
    rsntp: 'urn:com:ericsson:ecim:RsyncNtp', eq: 'urn:com:ericsson:ecim:ReqEquipment', fru: 'urn:com:ericsson:ecim:ReqFieldReplaceableUnit',
    tnport: 'urn:com:ericsson:ecim:ReqTnPort', ant: 'urn:com:ericsson:ecim:ReqAntennaSystem', rfport: 'urn:com:ericsson:ecim:ReqRfPort',
    riport: 'urn:com:ericsson:ecim:ReqRiPort', sync: 'urn:com:ericsson:ecim:ReqSyncPort', trx: 'urn:com:ericsson:ecim:ReqTransceiver',
    aas: 'urn:com:ericsson:ecim:ReqAasData', rilink: 'urn:com:ericsson:ecim:ReqRiLink', sup: 'urn:com:ericsson:ecim:RmeSupport',
    mpc: 'urn:com:ericsson:ecim:RmeMpClusterHandling', sef: 'urn:com:ericsson:ecim:RmeSectorEquipmentFunction'
  };
  var BB_RI_PORTS = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T'];
  var ID_RE = /^[A-Za-z0-9_-]+$/;

  /* ---------- tiny XML tree builder ---------- */
  function E(name, ns) { var kids = []; for (var i = 2; i < arguments.length; i++) push(kids, arguments[i]); return { n: name, ns: ns, k: kids }; }
  function push(arr, x) { if (x == null || x === false) return; if (Array.isArray(x)) x.forEach(function (y) { push(arr, y); }); else arr.push(x); }
  function L(name, v) { return { n: name, v: String(v) }; }
  function X(name) { return { n: name, empty: true }; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function render(node, d, out) {
    var ind = new Array(d + 1).join('  ');
    if (node.empty) { out.push(ind + '<' + node.n + ' />'); return; }
    if (node.v !== undefined) { out.push(ind + '<' + node.n + '>' + esc(node.v) + '</' + node.n + '>'); return; }
    out.push(ind + '<' + node.n + (node.ns ? ' xmlns="' + node.ns + '"' : '') + '>');
    node.k.forEach(function (c) { render(c, d + 1, out); });
    out.push(ind + '</' + node.n + '>');
  }
  var HELLO = ['<?xml version="1.0" encoding="UTF-8"?>', '<hello xmlns="' + NC + '">', '  <capabilities>',
    '    <capability>urn:ietf:params:netconf:base:1.0</capability>', '  </capabilities>', '</hello>', ']]>]]>'];
  var CLOSE = ['<rpc message-id="Closing" xmlns="' + NC + '">', '  <close-session></close-session>', '</rpc>', ']]>]]>'];
  function editConfig(id, me) {
    var out = HELLO.slice();
    out.push('<rpc message-id="' + id + '" xmlns="' + NC + '">', '  <edit-config>', '    <target>', '      <running />', '    </target>',
      '    <config xmlns:xc="' + NC + '">');
    render(me, 3, out);
    out.push('    </config>', '  </edit-config>', '</rpc>', ']]>]]>');
    return out.concat(CLOSE);
  }
  function finish(lines) { return lines.join('\r\n') + '\r\n'; }
  function ME() { var a = [L('managedElementId', 1)]; for (var i = 0; i < arguments.length; i++) push(a, arguments[i]); return E('ManagedElement', NS.top, a); }

  /* ---------- SiteBasic ---------- */
  function generateSiteBasic(c) {
    var full = c.style === 'full';
    var lines = [];
    var tnRef = 'ManagedElement=1,Equipment=1,FieldReplaceableUnit=' + c.tn.fru + ',TnPort=' + c.tn.port;
    var ethRef = 'ManagedElement=1,Transport=1,EthernetPort=' + c.tn.port;
    var f1 = c.f1 && c.f1.enabled;

    // rpc 1
    lines = lines.concat(editConfig(1, ME(
      L('dnPrefix', 'SubNetwork=' + c.rootMo + ',SubNetwork=' + c.subNetwork + ',MeContext=' + c.nodeName),
      E('SystemFunctions', null, L('systemFunctionsId', 1), E('Lm', NS.lm, L('lmId', 1), L('fingerprint', c.nodeName))))));
    // rpc 2
    lines = lines.concat(HELLO, ['<rpc message-id="2" xmlns="' + NC + '">', '  <action xmlns="urn:com:ericsson:ecim:1.0">', '    <data>',
      '      <ManagedElement>', '        <managedElementId>1</managedElementId>', '        <SystemFunctions>', '          <systemFunctionsId>1</systemFunctionsId>',
      '          <Lm>', '            <lmId>1</lmId>', '            <IntegrationUnlock>', '              <integrationUnlockId>1</integrationUnlockId>',
      '              <activate />', '            </IntegrationUnlock>', '          </Lm>', '        </SystemFunctions>', '      </ManagedElement>',
      '    </data>', '  </action>', '</rpc>', ']]>]]>'], CLOSE);

    // rpc 3 helpers
    var routerAttrs = full ? [L('hopLimit', 64), L('pathMtuExpiresIPv6', 86400), L('ttl', 64)] : [];
    function routerDecl(id) { return E('Router', NS.router, L('routerId', id), routerAttrs); }
    var ifAttrsPre = full ? [L('arpTimeout', 300), L('bfdStaticRoutes', 'DISABLED')] : [];
    var ifAttrsPost = full ? [L('mtu', 1500), L('pcpArp', 6)] : [];
    function vlanPort(name, vlan) {
      return E('VlanPort', NS.vlan, L('vlanPortId', name), L('encapsulation', ethRef), full ? L('isTagged', 'true') : null, L('vlanId', vlan));
    }
    function addr(ip, prefix) {
      return E('AddressIPv4', null, L('addressIPv4Id', 1), L('address', ip + '/' + prefix),
        full ? [L('configurationMode', 'MANUAL'), L('dhcpClientIdentifierType', 'AUTOMATIC')] : null);
    }
    function ifEncap(router, vp, withAddr) {
      return E('Router', NS.router, L('routerId', router), E('InterfaceIPv4', NS.if4, L('interfaceIPv4Id', 1), ifAttrsPre,
        L('encapsulation', 'ManagedElement=1,Transport=1,VlanPort=' + vp), ifAttrsPost, withAddr || null));
    }
    function ifAddr(router, ip, prefix) {
      return E('Router', NS.router, L('routerId', router), E('InterfaceIPv4', NS.if4, L('interfaceIPv4Id', 1), addr(ip, prefix)));
    }
    function route(router, gw) {
      return E('Router', NS.router, L('routerId', router), E('RouteTableIPv4Static', NS.route, L('routeTableIPv4StaticId', 1),
        E('Dst', null, L('dstId', 1), L('dst', '0.0.0.0/0'), E('NextHop', null, L('nextHopId', 1), L('address', gw),
          full ? [L('adminDistance', 1), L('bfdMonitoring', 'true')] : null))));
    }
    function f1Loopbacks() {
      return E('Router', NS.router, L('routerId', 'Node_Internal_F1'),
        ['NRCUCP', 'NRDU'].map(function (id) { return E('InterfaceIPv4', NS.if4, L('interfaceIPv4Id', id), ifAttrsPre, X('loopback'), ifAttrsPost); }));
    }
    function f1Addrs() {
      return E('Router', NS.router, L('routerId', 'Node_Internal_F1'),
        [['NRCUCP', c.f1.cucp], ['NRDU', c.f1.du]].map(function (p) {
          return E('InterfaceIPv4', NS.if4, L('interfaceIPv4Id', p[0]), addr(p[1], 32));
        }));
    }
    var s = c.security || {};
    var secm = E('SecM', NS.secm, L('secMId', 1),
      full && s.certm ? E('CertM', NS.certm, L('certMId', 1),
        E('EnrollmentAuthority', null, L('enrollmentAuthorityId', 1), L('enrollmentCaFingerprint', s.caFingerprint), L('enrollmentAuthorityName', s.caName)),
        E('EnrollmentServerGroup', null, L('enrollmentServerGroupId', 1),
          E('EnrollmentServer', null, L('enrollmentServerId', 1), L('uri', s.enrollUri), L('protocol', 'CMP')))) : null,
      E('UserManagement', null, L('userManagementId', 1),
        full && s.legalNotice ? L('legalNotice', s.legalNotice) : null,
        full ? L('loginFailureDelay', s.loginFailureDelay || 5) : null,
        full && s.ldap ? E('LdapAuthenticationMethod', NS.ldap, L('ldapAuthenticationMethodId', 1), L('administrativeState', 'UNLOCKED')) : null,
        E('UserIdentity', NS.user, L('userIdentityId', 1), E('MaintenanceUser', null, L('maintenanceUserId', 1), L('userName', c.user.name),
          E('password', null, X('cleartext'), L('password', c.user.password))))));
    var sysFn1 = E('SystemFunctions', null, L('systemFunctionsId', 1), secm,
      full ? E('SysM', NS.sysm, L('sysMId', 1), E('CliSsh', null, L('cliSshId', 1), L('administrativeState', 'UNLOCKED'), L('port', s.cliSshPort || 2023))) : null);

    var o = c.oam;
    var oamTransport = E('Transport', null, L('transportId', 1),
      E('EthernetPort', NS.eth, L('ethernetPortId', c.tn.port), L('administrativeState', 'UNLOCKED'), L('admOperatingMode', c.tn.mode),
        L('autoNegEnable', c.tn.autoNeg ? 'true' : 'false'), L('encapsulation', tnRef)),
      vlanPort(o.vlanPort, o.vlan),
      ifEncap(o.router, o.vlanPort, addr(o.ip, o.prefix)));

    var sn = c.snmp;
    var sysm2 = E('SystemFunctions', null, L('systemFunctionsId', 1), E('SysM', NS.sysm, L('sysMId', 1),
      E('OamAccessPoint', null, L('oamAccessPointId', 1), L('accessPoint', 'ManagedElement=1,Transport=1,Router=' + o.router + ',InterfaceIPv4=1,AddressIPv4=1')),
      full ? E('OamTrafficClass', null, L('oamTrafficClassId', 1), L('dscp', 0)) : null,
      E('Snmp', NS.snmp, L('snmpId', 1),
        full ? [L('administrativeState', 'UNLOCKED'), L('enableSourceCheckForV1V2C', 'false'), L('port', 161), L('portDtls', 10161)] : null,
        E('agentAddress', null, L('host', '0.0.0.0'), L('port', 161)),
        E('SnmpTargetV2C', null, L('snmpTargetV2CId', sn.id || 'ENMFM'), L('community', sn.community), L('address', sn.target), L('port', 162),
          full ? [L('informTimeout', 300), L('transportMethod', 'TRAP'), L('isMibWritable', 'true'), L('administrativeState', 'UNLOCKED')] : null)),
      E('TimeM', NS.timem, L('timeMId', 1), E('Ntp', null, L('ntpId', 1), c.ntp.map(function (ip, i) {
        return E('NtpServer', null, L('ntpServerId', i + 1), L('serverAddress', ip), L('administrativeState', 'UNLOCKED'));
      })))));

    var T = c.traffic;
    var tr = [L('transportId', 1)];
    if (full) {
      tr.push(E('Ntp', NS.rsntp, L('ntpId', 1)));
      if (f1) tr.push(routerDecl('Node_Internal_F1'));
      T.forEach(function (t) { tr.push(routerDecl(t.router)); });
      if (c.dns) tr.push(E('Router', NS.router, L('routerId', o.router), E('DnsClient', NS.dns, L('dnsClientId', 1),
        L('configurationMode', 'MANUAL'), L('dscp', 40), L('serverAddress', c.dns))));
      if (f1) tr.push(f1Loopbacks());
      T.forEach(function (t) { tr.push(vlanPort(t.vlanPort, t.vlan), ifEncap(t.router, t.vlanPort)); });
    } else {
      T.forEach(function (t) { tr.push(routerDecl(t.router)); });
      if (f1) tr.push(routerDecl('Node_Internal_F1'));
      T.forEach(function (t) { tr.push(vlanPort(t.vlanPort, t.vlan), ifEncap(t.router, t.vlanPort)); });
      if (f1) tr.push(f1Loopbacks());
    }
    if (full) { if (f1) tr.push(f1Addrs()); T.forEach(function (t) { tr.push(ifAddr(t.router, t.ip, t.prefix)); }); }
    else { T.forEach(function (t) { tr.push(ifAddr(t.router, t.ip, t.prefix)); }); if (f1) tr.push(f1Addrs()); }
    tr.push(route(o.router, o.gw));
    T.forEach(function (t) { tr.push(route(t.router, t.gw)); });

    lines = lines.concat(editConfig(3, ME(sysFn1,
      E('Transport', null, L('transportId', 1), routerDecl(o.router)),
      E('Equipment', NS.eq, L('equipmentId', 1), E('FieldReplaceableUnit', NS.fru, L('fieldReplaceableUnitId', c.tn.fru),
        E('TnPort', NS.tnport, L('tnPortId', c.tn.port)))),
      oamTransport, sysm2, E('Transport', null, tr))));
    // rpc 4
    lines = lines.concat(editConfig(4, ME(L('networkManagedElementId', c.networkMeId || c.nodeName))));
    return finish(lines);
  }

  /* ---------- SiteEquipment ---------- */
  var RF = ['A', 'B', 'C', 'D'];
  function generateSiteEquipment(c) {
    var rrus = c.radios.filter(function (r) { return r.type === 'RRU'; });
    var airs = c.radios.filter(function (r) { return r.type === 'AIR'; });
    var eqRef = 'ManagedElement=1,Equipment=1,';
    var eq = [L('equipmentId', 1)];
    rrus.forEach(function (r) {
      var n = +r.branches;
      eq.push(E('AntennaUnitGroup', NS.ant, L('antennaUnitGroupId', r.sector), E('AntennaUnit', null, L('antennaUnitId', 1),
        E('AntennaSubunit', null, L('antennaSubunitId', 1), RF.slice(0, n).map(function (_, i) { return E('AuPort', null, L('auPortId', i + 1)); })))));
      for (var i = 0; i < n; i++) {
        eq.push(E('FieldReplaceableUnit', NS.fru, L('fieldReplaceableUnitId', r.fru), E('RfPort', NS.rfport, L('rfPortId', RF[i]))));
        eq.push(E('AntennaUnitGroup', NS.ant, L('antennaUnitGroupId', r.sector), E('RfBranch', null, L('rfBranchId', i + 1),
          L('auPortRef', eqRef + 'AntennaUnitGroup=' + r.sector + ',AntennaUnit=1,AntennaSubunit=1,AuPort=' + (i + 1)),
          L('rfPortRef', eqRef + 'FieldReplaceableUnit=' + r.fru + ',RfPort=' + RF[i]))));
      }
    });
    eq.push(E('FieldReplaceableUnit', NS.fru, L('fieldReplaceableUnitId', c.tn.fru),
      BB_RI_PORTS.map(function (p) { return E('RiPort', NS.riport, L('riPortId', p)); }), E('SyncPort', NS.sync, L('syncPortId', 1))));
    rrus.forEach(function (r) {
      eq.push(E('FieldReplaceableUnit', NS.fru, L('fieldReplaceableUnitId', r.fru),
        RF.slice(+r.branches).map(function (p) { return E('RfPort', NS.rfport, L('rfPortId', p)); }),
        E('RiPort', NS.riport, L('riPortId', 'DATA_1')), E('RiPort', NS.riport, L('riPortId', 'DATA_2'))));
    });
    airs.forEach(function (r) {
      eq.push(E('FieldReplaceableUnit', NS.fru, L('fieldReplaceableUnitId', r.fru),
        E('RiPort', NS.riport, L('riPortId', 'DATA_1')), E('RiPort', NS.riport, L('riPortId', 'DATA_2')),
        E('Transceiver', NS.trx, L('transceiverId', 1), E('AasData', NS.aas, L('aasDataId', 1)))));
    });
    rrus.concat(airs).forEach(function (r, i) {
      eq.push(E('RiLink', NS.rilink, L('riLinkId', i + 1), L('riPortRef1', eqRef + 'FieldReplaceableUnit=' + c.tn.fru + ',RiPort=' + r.riPort),
        L('riPortRef2', eqRef + 'FieldReplaceableUnit=' + r.fru + ',RiPort=DATA_1')));
    });
    var sup = [L('nodeSupportId', 1), E('MpClusterHandling', NS.mpc, L('mpClusterHandlingId', 1), L('primaryCoreRef', eqRef + 'FieldReplaceableUnit=' + c.tn.fru))];
    rrus.forEach(function (r) {
      var refs = []; for (var i = 1; i <= +r.branches; i++) refs.push(L('rfBranchRef', eqRef + 'AntennaUnitGroup=' + r.sector + ',RfBranch=' + i));
      sup.push(E('SectorEquipmentFunction', NS.sef, L('sectorEquipmentFunctionId', r.sector), refs));
    });
    airs.forEach(function (r) {
      sup.push(E('SectorEquipmentFunction', NS.sef, L('sectorEquipmentFunctionId', r.sector), L('rfBranchRef', eqRef + 'FieldReplaceableUnit=' + r.fru + ',Transceiver=1')));
    });
    return finish(editConfig(1, ME(L('logicalName', c.nodeName), E('Equipment', NS.eq, eq), E('NodeSupport', NS.sup, sup))));
  }

  /* ---------- IP helpers ---------- */
  function ip2n(s) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s || '').trim());
    if (!m) return null;
    var p = m.slice(1).map(Number); if (p.some(function (x) { return x > 255; })) return null;
    return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
  }
  function mask(prefix) { return prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0; }
  function net(n, prefix) { return (n & mask(prefix)) >>> 0; }
  function n2ip(n) { return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); }

  /* ---------- config validation ---------- */
  function validateConfig(c) {
    var errors = [], warnings = [];
    function err(where, msg) { errors.push({ where: where, msg: msg }); }
    function warn(where, msg) { warnings.push({ where: where, msg: msg }); }
    function id(where, v, what) {
      if (v == null || String(v).trim() === '') { err(where, what + ' is empty'); return false; }
      if (!ID_RE.test(v)) { err(where, what + ' "' + v + '" has spaces or invalid characters (use only A-Z a-z 0-9 _ -)'); return false; }
      return true;
    }
    function ipField(where, v, what) { if (ip2n(v) == null) { err(where, what + ' "' + (v || '') + '" is not a valid IPv4 address'); return false; } return true; }

    id('Node', c.nodeName, 'Node name');
    id('Node', c.subNetwork, 'SubNetwork');
    id('Node', c.rootMo, 'Root SubNetwork');
    if (c.networkMeId && !/^[A-Za-z0-9_.-]+$/.test(c.networkMeId)) err('Node', 'Network ME ID "' + c.networkMeId + '" has spaces or invalid characters');
    if (!c.user || !c.user.name || !c.user.password) err('Node', 'Maintenance user name and password are required');
    else if (/\s/.test(c.user.name)) err('Node', 'Maintenance user name has spaces');
    id('Transport port', c.tn.port, 'TN port');
    id('Transport port', c.tn.fru, 'Baseband FRU');
    if (['1G_FULL', '10G_FULL', '25G_FULL', '100M_FULL'].indexOf(c.tn.mode) < 0) err('Transport port', 'Operating mode "' + c.tn.mode + '" is not supported');

    var ifaces = [{ label: 'OAM', d: c.oam }].concat(c.traffic.map(function (t, i) { return { label: 'Traffic #' + (i + 1) + ' (' + (t.router || '?') + ')', d: t }; }));
    if (!c.traffic.length) err('Traffic', 'Add at least one traffic network');
    var routers = {}, vps = {}, vlans = {}, ips = {}, nets = [];
    ifaces.forEach(function (f) {
      var d = f.d, w = f.label;
      if (id(w, d.router, 'Router name')) {
        if (d.router === 'Node_Internal_F1') err(w, 'Router name Node_Internal_F1 is reserved for the internal F1 link');
        if (routers[d.router]) err(w, 'Router "' + d.router + '" is used twice (' + routers[d.router] + ')'); else routers[d.router] = w;
      }
      if (id(w, d.vlanPort, 'VlanPort name')) { if (vps[d.vlanPort]) err(w, 'VlanPort "' + d.vlanPort + '" is used twice (' + vps[d.vlanPort] + ')'); else vps[d.vlanPort] = w; }
      var v = Number(d.vlan);
      if (!/^\d+$/.test(String(d.vlan)) || v < 1 || v > 4094) err(w, 'VLAN "' + d.vlan + '" must be a number 1–4094');
      else if (vlans[v]) err(w, 'VLAN ' + v + ' is already used by ' + vlans[v] + ' on the same port — the node will reject it at commit (sa_ais_err_bad_operation)');
      else vlans[v] = w;
      var p = Number(d.prefix), okP = /^\d+$/.test(String(d.prefix)) && p >= 8 && p <= 30;
      if (!okP) err(w, 'Prefix /' + d.prefix + ' must be between /8 and /30');
      var okIp = ipField(w, d.ip, 'IP'), okGw = ipField(w, d.gw, 'Gateway');
      if (okIp && okP) {
        var n = ip2n(d.ip), nw = net(n, p), bc = (nw | (~mask(p) >>> 0)) >>> 0;
        if (n === nw) err(w, d.ip + '/' + p + ' is the network address, not a host IP');
        if (n === bc) err(w, d.ip + '/' + p + ' is the broadcast address, not a host IP');
        if (ips[d.ip]) err(w, 'IP ' + d.ip + ' is already used by ' + ips[d.ip]); else ips[d.ip] = w;
        nets.forEach(function (o) {
          var mp = Math.min(o.p, p);
          if (net(o.n, mp) === net(n, mp)) warn(w, 'Subnet ' + n2ip(nw) + '/' + p + ' overlaps ' + o.w + ' — check the IP plan');
        });
        nets.push({ n: n, p: p, w: w });
        if (okGw) {
          var g = ip2n(d.gw);
          if (net(g, p) !== nw) err(w, 'Gateway ' + d.gw + ' is outside ' + n2ip(nw) + '/' + p + ' — the default route will not work');
          else if (g === n) err(w, 'Gateway equals the interface IP');
          else if (g === nw || g === bc) err(w, 'Gateway ' + d.gw + ' is the network/broadcast address');
        }
      }
    });
    if (c.f1 && c.f1.enabled) {
      ipField('Internal F1', c.f1.cucp, 'NRCUCP IP'); ipField('Internal F1', c.f1.du, 'NRDU IP');
      if (c.f1.cucp === c.f1.du) err('Internal F1', 'NRCUCP and NRDU need different IPs');
      [c.f1.cucp, c.f1.du].forEach(function (x) { if (ips[x]) err('Internal F1', 'IP ' + x + ' is already used by ' + ips[x]); });
    }
    ipField('SNMP', c.snmp.target, 'ENM FM (SNMP target)');
    if (!c.snmp.community || /\s/.test(c.snmp.community)) err('SNMP', 'Community is empty or has spaces');
    if (!c.ntp.length) err('NTP', 'Add at least one NTP server');
    var seenNtp = {};
    c.ntp.forEach(function (x, i) { if (ipField('NTP', x, 'NTP server ' + (i + 1)) && seenNtp[x]) err('NTP', 'NTP server ' + x + ' is listed twice'); seenNtp[x] = 1; });
    if (c.style === 'full') {
      if (c.dns) ipField('DNS', c.dns, 'DNS server');
      var s = c.security || {};
      if (s.certm) {
        if (!/^([0-9a-fA-F]{2}:){19}[0-9a-fA-F]{2}$/.test(s.caFingerprint || '')) err('Security', 'CA fingerprint must be 20 hex pairs separated by ":" (SHA-1)');
        if (!/^CN=/.test(s.caName || '')) err('Security', 'Enrollment authority name should start with CN=');
        if (!/^https?:\/\/\S+$/.test(s.enrollUri || '')) err('Security', 'Enrollment server URI must start with http:// or https:// and have no spaces');
      }
      var port = Number(s.cliSshPort || 2023); if (!(port > 0 && port < 65536)) err('Security', 'CLI SSH port is invalid');
    }
    // equipment
    if (!c.radios.length) err('Radios', 'Add at least one radio');
    var secs = {}, frus = {}, ris = {};
    frus[c.tn.fru] = 'baseband';
    c.radios.forEach(function (r, i) {
      var w = 'Radio #' + (i + 1);
      if (r.type !== 'RRU' && r.type !== 'AIR') err(w, 'Type must be RRU or AIR');
      if (id(w, r.sector, 'Sector ID')) { if (secs[r.sector]) err(w, 'Sector ID "' + r.sector + '" is used twice'); secs[r.sector] = 1; }
      if (id(w, r.fru, 'Radio unit name')) { if (frus[r.fru]) err(w, 'Unit name "' + r.fru + '" is used twice'); frus[r.fru] = 1; }
      if (BB_RI_PORTS.indexOf(r.riPort) < 0) err(w, 'Baseband RI port "' + r.riPort + '" does not exist (A–H, J–N, P–T)');
      else if (ris[r.riPort]) err(w, 'Baseband RI port ' + r.riPort + ' is already used by ' + ris[r.riPort]); else ris[r.riPort] = w;
      if (r.type === 'RRU' && [2, 4].indexOf(+r.branches) < 0) err(w, 'RRU branches must be 2 or 4');
    });
    return { errors: errors, warnings: warnings };
  }

  /* ---------- XML lint (works on generated or uploaded files) ---------- */
  function parseXml(text) {
    // minimal parser for NETCONF site files: elements + text, ignores PI/comments/attributes except xmlns
    var root = { n: '#root', k: [], t: '' }, stack = [root], re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>|([^<]+)/g, m, line = 1, lastIdx = 0;
    while ((m = re.exec(text))) {
      line += (text.slice(lastIdx, m.index).match(/\n/g) || []).length; lastIdx = m.index;
      var top = stack[stack.length - 1];
      if (m[6] !== undefined) { top.t += m[6]; continue; }
      if (m[1] !== undefined) { top.t += m[1]; continue; }
      if (!m[3]) continue;
      if (m[2]) {
        if (top.n !== m[3]) throw new Error('Line ' + line + ': closing </' + m[3] + '> does not match <' + top.n + '>');
        stack.pop(); continue;
      }
      var el = { n: m[3], k: [], t: '', line: line, p: top };
      top.k.push(el);
      if (!m[5]) stack.push(el);
    }
    if (stack.length > 1) throw new Error('Element <' + stack[stack.length - 1].n + '> is never closed');
    return root;
  }
  function decode(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }

  function buildMoMap(text) {
    var errors = [], mos = {}, order = [], offset = 0;
    text.split(']]>]]>').forEach(function (seg) {
      var startLine = (text.slice(0, offset).match(/\n/g) || []).length;
      offset += seg.length + 6;
      if (!seg.trim()) return;
      var tree;
      try { tree = parseXml(seg); } catch (e) { errors.push({ line: startLine, msg: 'XML is broken: ' + e.message }); return; }
      (function walk(node, dn) {
        node.k.forEach(function (ch) {
          var idName = ch.n.charAt(0).toLowerCase() + ch.n.slice(1) + 'Id';
          var idEl = ch.k.filter(function (g) { return g.n === idName; })[0];
          if (idEl) {
            var idv = decode(idEl.t.trim());
            var mydn = (dn ? dn + ',' : '') + ch.n + '=' + idv;
            var mo = mos[mydn] || (mos[mydn] = { cls: ch.n, id: idv, dn: mydn, attrs: {}, line: startLine + ch.line });
            if (order.indexOf(mydn) < 0) order.push(mydn);
            if (/\s/.test(idv) || idv === '') errors.push({ line: startLine + idEl.line, msg: ch.n + ' id "' + idv + '" is empty or contains spaces' });
            ch.k.forEach(function (g) {
              if (g === idEl) return;
              var gIdName = g.n.charAt(0).toLowerCase() + g.n.slice(1) + 'Id';
              if (g.k.some(function (x) { return x.n === gIdName; })) return;
              var val = g.k.length ? g : decode(g.t.trim());
              (mo.attrs[g.n] = mo.attrs[g.n] || []).push({ v: val, line: startLine + g.line, empty: !g.k.length && g.t.trim() === '' });
            });
            walk(ch, mydn);
          } else if (/^(rpc|edit-config|config|data|action|hello|capabilities|target)$/.test(ch.n)) {
            walk(ch, dn);
          }
        });
      })(tree, '');
    });
    return { mos: mos, order: order, errors: errors };
  }

  function lintXml(text, fileName) {
    var warnings = [], info = {};
    var map = buildMoMap(text), mos = map.mos, order = map.order, errors = map.errors.slice();
    function err(line, msg) { errors.push({ line: line, msg: msg }); }
    function warn(line, msg) { warnings.push({ line: line, msg: msg }); }
    if (fileName && /\s/.test(fileName)) err(0, 'File name "' + fileName + '" contains spaces — the SFTP download from SMRS can fail. Rename it without spaces.');
    function a(mo, n) { var x = mo.attrs[n]; return x ? x[x.length - 1] : null; }
    function byClass(c) { return order.map(function (d) { return mos[d]; }).filter(function (m) { return m.cls === c; }); }
    var ME_PREFIX = 'ManagedElement=1,';
    // InterfaceIPv4 encapsulation XOR loopback
    byClass('InterfaceIPv4').forEach(function (m) {
      var enc = a(m, 'encapsulation'), lb = a(m, 'loopback');
      if (lb && !lb.empty) err(lb.line, m.dn + ': loopback is an empty-type (EcimEmpty) attribute — write <loopback /> without a value');
      if (enc && lb) err(m.line, m.dn + ': both encapsulation and loopback are set — only one is allowed');
      if (!enc && !lb) err(m.line, m.dn + ': neither encapsulation nor loopback is set — commit will fail ("One of the attributes encapsulation and loopback must be set")');
    });
    // encapsulation shared
    var encUse = {};
    byClass('InterfaceIPv4').forEach(function (m) { var e = a(m, 'encapsulation'); if (e) { if (encUse[e.v]) err(e.line, m.dn + ' uses ' + e.v + ' which is already used by ' + encUse[e.v]); else encUse[e.v] = m.dn; } });
    // VLAN
    var vl = {};
    byClass('VlanPort').forEach(function (m) {
      var v = a(m, 'vlanId'), e = a(m, 'encapsulation');
      if (!v) { err(m.line, m.dn + ': vlanId is missing'); return; }
      var n = Number(v.v); if (!(n >= 1 && n <= 4094)) err(v.line, m.dn + ': vlanId ' + v.v + ' is out of range 1–4094');
      var key = (e ? e.v : '?') + '#' + n;
      if (vl[key]) err(v.line, m.dn + ': VLAN ' + n + ' is already used by ' + vl[key] + ' on the same port — commit will fail (sa_ais_err_bad_operation)');
      else vl[key] = m.dn;
    });
    // Addresses + routes
    var subnets = [], ipSeen = {}, routerNets = {};
    byClass('AddressIPv4').forEach(function (m) {
      var ad = a(m, 'address'); if (!ad) return;
      var mm = /^([\d.]+)\/(\d+)$/.exec(ad.v); var n = mm && ip2n(mm[1]);
      if (n == null || +mm[2] > 32) { err(ad.line, m.dn + ': address "' + ad.v + '" is not a valid IPv4/prefix'); return; }
      var p = +mm[2], router = (/Router=([^,]+)/.exec(m.dn) || [])[1];
      if (ipSeen[mm[1]]) err(ad.line, 'IP ' + mm[1] + ' is used twice (' + ipSeen[mm[1]] + ' and ' + m.dn + ')'); else ipSeen[mm[1]] = m.dn;
      if (p < 32) subnets.forEach(function (o) {
        var mp = Math.min(o.p, p);
        if (o.p < 32 && net(o.n, mp) === net(n, mp) && o.r !== router) warn(ad.line, ad.v + ' (' + router + ') overlaps ' + n2ip(o.n) + '/' + o.p + ' (' + o.r + ') — check the IP plan');
      });
      subnets.push({ n: n, p: p, r: router });
      (routerNets[router] = routerNets[router] || []).push({ n: n, p: p });
    });
    byClass('NextHop').forEach(function (m) {
      var ad = a(m, 'address'); if (!ad) return;
      var g = ip2n(ad.v), router = (/Router=([^,]+)/.exec(m.dn) || [])[1];
      if (g == null) { err(ad.line, m.dn + ': next hop "' + ad.v + '" is not a valid IP'); return; }
      var nets2 = routerNets[router] || [];
      if (nets2.length && !nets2.some(function (x) { return x.p < 32 && net(g, x.p) === net(x.n, x.p); }))
        warn(ad.line, 'Router ' + router + ': next hop ' + ad.v + ' is not in any subnet of this router — the default route will not work (the node still accepts it)');
    });
    // references
    order.forEach(function (d) {
      var m = mos[d];
      Object.keys(m.attrs).forEach(function (k) {
        m.attrs[k].forEach(function (x) {
          if (typeof x.v === 'string' && x.v.indexOf(ME_PREFIX) === 0 && k !== 'dnPrefix') {
            var target = x.v;
            if (!mos[target]) warn(x.line, m.dn + ' → ' + k + ' points to ' + target + ' which is not created in this file (OK only if it already exists on the node)');
          }
        });
      });
    });
    // RiPort used twice in RiLinks
    var riUse = {};
    byClass('RiLink').forEach(function (m) {
      ['riPortRef1', 'riPortRef2'].forEach(function (k) {
        var r = a(m, k); if (!r) { err(m.line, m.dn + ': ' + k + ' missing'); return; }
        if (riUse[r.v]) err(r.line, r.v + ' is used by two RiLinks (' + riUse[r.v] + ', ' + m.dn + ')'); else riUse[r.v] = m.dn;
      });
    });
    // fingerprint vs MeContext
    var me = mos['ManagedElement=1'];
    var lm = mos['ManagedElement=1,SystemFunctions=1,Lm=1'];
    if (me && lm) {
      var dp = a(me, 'dnPrefix'), fp = a(lm, 'fingerprint');
      var mc = dp && (/MeContext=([^,]+)$/.exec(dp.v) || [])[1];
      if (mc && fp && mc !== fp.v) warn(fp.line, 'fingerprint "' + fp.v + '" differs from MeContext "' + mc + '"');
      info.node = mc || (fp && fp.v);
    }
    if (me && a(me, 'logicalName')) info.node = info.node || a(me, 'logicalName').v;
    info.kind = mos['ManagedElement=1,Equipment=1'] && byClass('RiLink').length ? 'SiteEquipment' : (byClass('InterfaceIPv4').length ? 'SiteBasic' : 'Unknown');
    info.moCount = order.length;
    return { errors: errors, warnings: warnings, info: info };
  }

  /* ---------- import existing files into a config ---------- */
  function importFiles(texts, base) {
    var c = JSON.parse(JSON.stringify(base)), notes = [];
    var mos = {}, order = [];
    texts.forEach(function (t) { var m = buildMoMap(t); Object.keys(m.mos).forEach(function (k) { if (!mos[k]) mos[k] = m.mos[k]; else Object.keys(m.mos[k].attrs).forEach(function (n) { mos[k].attrs[n] = (mos[k].attrs[n] || []).concat(m.mos[k].attrs[n]); }); }); m.order.forEach(function (d) { if (order.indexOf(d) < 0) order.push(d); }); });
    function a(dn, n) { var mo = mos[dn]; var x = mo && mo.attrs[n]; return x ? x[x.length - 1].v : null; }
    function all(cls) { return order.filter(function (d) { return mos[d].cls === cls; }).map(function (d) { return mos[d]; }); }
    function last(dn) { return dn.split(',').pop().split('=').slice(1).join('='); }
    var ME = 'ManagedElement=1';
    var hasBasic = all('InterfaceIPv4').length > 0, hasEq = all('RiLink').length > 0;
    if (!hasBasic && !hasEq) return { cfg: base, notes: ['No SiteBasic or SiteEquipment content was found in the file.'] };
    var dp = a(ME, 'dnPrefix'), m = dp && /SubNetwork=([^,]+),SubNetwork=([^,]+),MeContext=(.+)$/.exec(dp);
    if (m) { c.rootMo = m[1]; c.subNetwork = m[2]; c.nodeName = m[3]; }
    else if (a(ME, 'logicalName')) c.nodeName = a(ME, 'logicalName');
    if (a(ME, 'networkManagedElementId')) c.networkMeId = a(ME, 'networkManagedElementId');
    if (hasBasic) {
      c.style = (all('CertM').length || all('VlanPort').some(function (v) { return a(v.dn, 'isTagged'); })) ? 'full' : 'basic';
      var mu = all('MaintenanceUser')[0];
      if (mu) { c.user.name = a(mu.dn, 'userName') || c.user.name; var pw = a(mu.dn, 'password');
        if (pw && pw.k) { var inner = pw.k.filter(function (x) { return x.n === 'password'; })[0]; if (inner) c.user.password = decode(inner.t.trim()); } }
      var eth = all('EthernetPort')[0];
      if (eth) { c.tn.port = eth.id; c.tn.mode = a(eth.dn, 'admOperatingMode') || c.tn.mode; c.tn.autoNeg = a(eth.dn, 'autoNegEnable') === 'true';
        var fr = /FieldReplaceableUnit=([^,]+)/.exec(a(eth.dn, 'encapsulation') || ''); if (fr) c.tn.fru = fr[1]; }
      function iface(router) {
        var ifdn = ME + ',Transport=1,Router=' + router + ',InterfaceIPv4=1';
        var enc = a(ifdn, 'encapsulation') || '', vp = /VlanPort=(.+)$/.exec(enc);
        var ad = (a(ifdn + ',AddressIPv4=1', 'address') || '/').split('/');
        var nh = a(ME + ',Transport=1,Router=' + router + ',RouteTableIPv4Static=1,Dst=1,NextHop=1', 'address') || '';
        return { router: router, vlanPort: vp ? vp[1] : '', vlan: vp ? Number(a(ME + ',Transport=1,VlanPort=' + vp[1], 'vlanId')) : '', ip: ad[0], prefix: Number(ad[1]) || '', gw: nh };
      }
      var ap = a(ME + ',SystemFunctions=1,SysM=1,OamAccessPoint=1', 'accessPoint') || '';
      var oamR = (/Router=([^,]+)/.exec(ap) || [])[1];
      if (oamR) c.oam = iface(oamR); else notes.push('OAM access point not found — fill OAM manually.');
      c.traffic = all('Router').map(function (r) { return r.id; }).filter(function (id) {
        return id !== oamR && id !== 'Node_Internal_F1' && a(ME + ',Transport=1,Router=' + id + ',InterfaceIPv4=1', 'encapsulation');
      }).map(iface);
      var f1 = ME + ',Transport=1,Router=Node_Internal_F1';
      c.f1 = { enabled: !!mos[f1], cucp: (a(f1 + ',InterfaceIPv4=NRCUCP,AddressIPv4=1', 'address') || '169.254.42.42/32').split('/')[0],
        du: (a(f1 + ',InterfaceIPv4=NRDU,AddressIPv4=1', 'address') || '169.254.42.43/32').split('/')[0] };
      var st = all('SnmpTargetV2C')[0];
      if (st) c.snmp = { id: st.id, community: a(st.dn, 'community') || 'public', target: a(st.dn, 'address') || '' };
      c.ntp = all('NtpServer').map(function (n) { return a(n.dn, 'serverAddress'); }).filter(Boolean);
      var dns = all('DnsClient')[0]; c.dns = dns ? (a(dns.dn, 'serverAddress') || '') : '';
      var ea = all('EnrollmentAuthority')[0], es = all('EnrollmentServer')[0], um = all('UserManagement')[0], cli = all('CliSsh')[0];
      c.security = { certm: !!ea, caFingerprint: ea ? a(ea.dn, 'enrollmentCaFingerprint') : '', caName: ea ? a(ea.dn, 'enrollmentAuthorityName') : '',
        enrollUri: es ? a(es.dn, 'uri') : '', ldap: all('LdapAuthenticationMethod').length > 0,
        legalNotice: um ? (a(um.dn, 'legalNotice') || '') : '', loginFailureDelay: um ? Number(a(um.dn, 'loginFailureDelay') || 5) : 5,
        cliSshPort: cli ? Number(a(cli.dn, 'port') || 2023) : 2023 };
      notes.push('SiteBasic imported (' + (c.style === 'full' ? 'full ENM style' : 'basic interim style') + ', ' + c.traffic.length + ' traffic network(s)).');
    }
    if (hasEq) {
      var ri = {};
      all('RiLink').forEach(function (l) {
        var r1 = a(l.dn, 'riPortRef1') || '', r2 = a(l.dn, 'riPortRef2') || '';
        var bb = /FieldReplaceableUnit=([^,]+),RiPort=([^,]+)$/.exec(r1), ru = /FieldReplaceableUnit=([^,]+),RiPort=/.exec(r2);
        if (bb && ru) { ri[ru[1]] = bb[2]; c.tn.fru = bb[1]; }
      });
      c.radios = all('SectorEquipmentFunction').map(function (s) {
        var refs = (mos[s.dn].attrs.rfBranchRef || []).map(function (x) { return x.v; });
        var trx = refs.length && /FieldReplaceableUnit=([^,]+),Transceiver=/.exec(refs[0]);
        if (trx) return { type: 'AIR', sector: s.id, fru: trx[1], branches: '', riPort: ri[trx[1]] || '' };
        var aug = refs.length && (/AntennaUnitGroup=([^,]+)/.exec(refs[0]) || [])[1];
        var rp = aug && a(ME + ',Equipment=1,AntennaUnitGroup=' + aug + ',RfBranch=1', 'rfPortRef');
        var fru = rp ? (/FieldReplaceableUnit=([^,]+)/.exec(rp) || [])[1] : 'RRU-' + s.id;
        if (aug && aug !== s.id) notes.push('Sector ' + s.id + ' uses AntennaUnitGroup ' + aug + ' — the generator names the group after the sector.');
        return { type: 'RRU', sector: s.id, fru: fru, branches: refs.length, riPort: ri[fru] || '' };
      });
      notes.push('SiteEquipment imported (' + c.radios.length + ' radio(s)).');
    }
    return { cfg: c, notes: notes };
  }

  /* ---------- minimal ZIP (store, no compression) ---------- */
  var CRC_T = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s); return Uint8Array.from(Buffer.from(s, 'utf8')); }
  function makeZip(files) {
    var parts = [], central = [], off = 0, d = new Date();
    var dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    function le(n, w) { var b = new Uint8Array(w); for (var i = 0; i < w; i++) b[i] = (n >>> (8 * i)) & 255; return b; }
    function cat(arr) { var len = arr.reduce(function (s, x) { return s + x.length; }, 0), o = new Uint8Array(len), p = 0; arr.forEach(function (x) { o.set(x, p); p += x.length; }); return o; }
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data);
      var head = cat([le(0x04034b50, 4), le(20, 2), le(0, 2), le(0, 2), le(dt, 2), le(dd, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), name]);
      parts.push(head, data);
      central.push(cat([le(0x02014b50, 4), le(20, 2), le(20, 2), le(0, 2), le(0, 2), le(dt, 2), le(dd, 2), le(crc, 4), le(data.length, 4), le(data.length, 4),
        le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(off, 4), name]));
      off += head.length + data.length;
    });
    var cd = cat(central);
    return cat(parts.concat([cd, cat([le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(cd.length, 4), le(off, 4), le(0, 2)])]));
  }

  function moshellChecks(c) {
    var L2 = ['lt all', 'alt', 'st ethernetport|vlanport|interfaceipv4', 'hget vlanport vlanid|encapsulation',
      'hget interfaceipv4 encapsulation|loopback|operationalstate', 'hget addressipv4 address', 'hget nexthop address'];
    L2.push('mcc router=' + c.oam.router + ' ping --count 3 ' + c.oam.gw);
    c.traffic.forEach(function (t) { L2.push('mcc router=' + t.router + ' ping --count 3 ' + t.gw); });
    L2.push('st ntpserver', 'st rilink', 'st sectorequipmentfunction', 'st fieldreplaceableunit');
    return L2;
  }

  function fileNames(c) {
    var tag = c.fileTag ? '_' + c.fileTag : '';
    return { basic: '01_SiteBasic_' + c.nodeName + tag + '.xml', equip: '02_SiteEquipment_' + c.nodeName + tag + '.xml' };
  }

  return { generateSiteBasic: generateSiteBasic, generateSiteEquipment: generateSiteEquipment, validateConfig: validateConfig,
    lintXml: lintXml, importFiles: importFiles, makeZip: makeZip, moshellChecks: moshellChecks, fileNames: fileNames, BB_RI_PORTS: BB_RI_PORTS, ip2n: ip2n };
})();
if (typeof module !== 'undefined') module.exports = Core;
