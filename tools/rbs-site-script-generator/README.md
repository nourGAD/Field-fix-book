# RBS Site Script Generator

Generates the **Site Basic** and **Site Equipment** NETCONF files for Ericsson Baseband AutoIntegration from the site's IP plan: VLANs, IPs, gateways, NTP/SNMP and radios. Every value is checked before the files can be downloaded, so the node doesn't reject the files during AutoIntegration.

**Open the tool:** https://nourgad.github.io/Field-fix-book/tools/rbs-site-script-generator/

Everything runs in the browser and nothing is uploaded. You can also save `index.html` and open it offline on site.

## What it does

- **Generate:** fill in the form, or start from an example, and download both files as one zip. You can also copy each file.
- **Import ENM files:** load an existing Site Basic and Site Equipment and the form fills itself in. Fix what's wrong and regenerate.
- **Check a file:** drop any Site Basic or Site Equipment XML to see problems with line numbers before you load it.
- **MoShell checks:** a list of commands to verify transport, NTP and radios after integration.

Two output styles:

| Style | Use it for |
|---|---|
| Full ENM style | Security (CertM, LDAP), CLI SSH, DNS, BFD on routes, tagged VLANs |
| Basic interim style | Minimal transport + OAM + NTP/SNMP, as produced by interim generators |

## Checks that block generation

- VLAN used twice on the same Ethernet port, which causes the `sa_ais_err_bad_operation` commit failure
- `InterfaceIPv4` with neither encapsulation nor loopback ("One of the attributes encapsulation and loopback must be set")
- `<loopback>true</loopback>`: `loopback` is EcimEmpty, so it must be written as `<loopback />`
- Spaces or invalid characters in node name, MO ids or file names
- Invalid IP or prefix, network/broadcast address used as a host IP, the same IP twice
- Gateway outside the interface subnet
- Baseband RI port that doesn't exist (A–H, J–N, P–T) or is used twice
- Duplicate router, VlanPort, sector or unit names; bad CA fingerprint or enrollment URI

Overlapping subnets are a warning. The generated XML is checked again before the download unlocks.

## Develop

```
src/core.js       generator, validation, file checker, importer, zip writer (no dependencies)
src/examples.js   example sites — all data is made up
src/ui.html       the page; build.py inlines core.js and examples.js into index.html
test/run.js       node test/run.js
```

```
python3 build.py && node test/run.js
```

> Don't commit real site IDs, customer IPs or certificate fingerprints. The repo is public.

Maintained by Nour Gad.
