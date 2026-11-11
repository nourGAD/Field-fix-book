# RBS Site Script Generator

Generates the **Site Basic** and **Site Equipment** NETCONF files for Ericsson Baseband AutoIntegration from the site's IP plan: VLANs, IPs, gateways, NTP/SNMP and radios. Every value is checked before the files can be downloaded, so the node doesn't reject the files during AutoIntegration.

**Open the tool:** https://nourgad.github.io/Field-fix-book/tools/rbs-site-script-generator/

Everything runs in the browser and nothing is uploaded. You can also save `index.html` and open it offline on site.

## Quick mode (TRM sheet) — the default screen

1. **Paste the TRM rows** straight from Excel: Site ID, then 4G IP / NH / VLAN, 5G CP IP / NH / VLAN, 5G UP IP / NH / VLAN, OAM IP / NH / VLAN. The header row is skipped.
2. **Check each site:** the table looks like the TRM sheet. Enter the radios per site (4T4R RRUs, 2T2R RRUs, AIR units; default 3 / 0 / 3). Every site shows **Ready** or its problems in plain words, and wrong cells turn red.
3. **Download:** one zip, one folder per site, each with Site Basic, Site Equipment and the RBS Summary. Sites with problems are left out until fixed.

Radio layout: 4T4R RRUs on BB ports A…, AIR on N, P, Q…, 2T2R RRUs on the next free ports, sectors numbered in that order. Project settings (mask, node name ending, upgrade package, ENM settings) sit in one collapsed panel. **Advanced** keeps the step-by-step builder, import and project templates; **Check a file** checks any script.

## Workflow (Advanced)

1. **Start:** import the ENM files, start from scratch, or load an example.
2. **Site & node:** node name, ENM services (SNMP, NTP, DNS), security, radios.
3. **Interfaces:** transport port, OAM, traffic VLANs and IPs, internal F1.
4. **Review:** the VLAN/IP plan, node settings and RI links on one screen, with open issues and links to fix them.
5. **Validate & generate:** the files unlock only when every check passes. Download as a zip, or copy them. Includes the **RBS Summary** for manual integration.

Each step shows its own error count in the side rail, and fields with errors are highlighted.

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

## Different projects: project templates

Every operator project has its own script layout: router names (OAM/WRAT/S1-MME/GRAT, vr_LTE/SYNC, Traffic_LTE/NR_CP/NR_UP), PTP or NTP sync, feature keys, and radio setups such as one RRU serving three sectors. A single fixed builder can't cover all of them, so the tool has two ways to work:

| Mode | When to use | How it builds the files |
|---|---|---|
| Standard builder | Projects using the standard layout (OAM, traffic routers, internal F1, RRU/AIR per sector) | Builds both files from the form |
| Project template | Any other project | Takes one working site's Site Basic + Site Equipment, keeps every line, and changes only the site values |

**Set up a project once:** Start → Project templates → name it → choose the Site Basic + Site Equipment of a site that integrated successfully. Files with errors are refused, because a template must be known-good. Templates are kept in your browser; anyone else on the team loads the same two files once.

**For each new site:** pick the project → enter the node names (MeContext, fingerprint, Network ME ID), then each interface's VLAN, IP, prefix and gateway from the TRM plan → review (changed values are bold) → generate. Router names, interface names, sync, features and the whole Site Equipment stay exactly as in the template. The same checks run: duplicate VLAN on a port, gateway outside subnet, duplicate IP, names with spaces, and the full file checker on the output.

If you import ENM files whose layout doesn't match the standard builder, the tool says so and offers to use them as a project template, so it never silently rebuilds a different script.

## RBS Summary file (manual integration)

The tool also writes `RBSSummary_<node>.xml` pointing to the generated files:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<summary:AutoIntegrationRbsSummaryFile xmlns:summary="http://www.ericsson.se/RbsSummaryFileSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.ericsson.se/RbsSummaryFileSchemaSummaryFile.xsd">
  <Format revision="F" />
  <ConfigurationFiles siteBasicFilePath="01_SiteBasic_SITE01_NL.xml" siteEquipmentFilePath="02_SiteEquipment_SITE01_NL.xml" upgradePackageFilePath="Baseband_Radio_Node-CXP2010174_2-R42L18" />
</summary:AutoIntegrationRbsSummaryFile>
```

- The Site Basic and Site Equipment paths are the exact names the tool generated in the same run.
- The upgrade package is never guessed. The summary is only created when it's entered (or imported from an existing summary), and it's used exactly as typed.
- All generated file names use only letters, digits, `-` and `_`. Spaces, `/` and other symbols become `_`.
- The summary is checked before release: root element, namespace, `Format revision="F"`, and all three paths present, non-empty and without placeholders.

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
