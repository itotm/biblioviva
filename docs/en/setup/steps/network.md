# Prepare the network

This step prepares what is needed outside the BiblioViva computer so that the school's other devices can reach it:
with Tailscale a school account and an access key, with the local network an address that does not change. It takes
about 15 minutes with Tailscale and about 10 minutes with the local network, plus the wait for whoever manages the
school's network. The choice between the two ways is explained in [Choose the network](../choose-network.md).

## Requirements

<!-- variant: tailscale -->
**With Tailscale**

- A Google, Microsoft, GitHub or Apple account with which to open the Tailscale account. The Tailscale account is a
  single one for the whole school, not one per person: a school account is better than a personal one.
- Any computer with a browser, connected to the internet.
- A safe place where to write down the access key until step 4 (a sheet in a locked drawer, a password manager).
<!-- /variant -->
<!-- variant: lan -->
**With the local network**

- The name of the person (or the company) who manages the school's network and router.
- The BiblioViva computer, with the name `biblioviva` given at step 1, connected to the school's network.
<!-- /variant -->

## Procedure

<!-- variant: tailscale -->
**With Tailscale**

### Account

1. Open the sign-up page of [Tailscale](https://login.tailscale.com/start).
1. Choose how to log in: "Google", "Microsoft", "GitHub" or "Apple". Tailscale has no passwords of its own: one always
   logs in with one of these accounts. To choose, the Tailscale page
   [Supported SSO identity providers](https://tailscale.com/kb/1013/sso-providers) can be read.
1. Follow Tailscale's questions up to the admin console. The Tailscale application is not to be installed in this
   step: it is installed at step 5, on the computer of the first run, and at step 6, on the other devices.

> [!IMPORTANT]
> The school's Tailscale account is a single one and serves every device that uses BiblioViva (the desk computer, the
> other computers, the tablets and the phones). The chosen account must remain in the school's hands: write down which
> one it is and who knows it. The comparison with personal accounts is in [Choose the network](../choose-network.md).

### Names and certificates

1. Open the "DNS" page of Tailscale's [admin console](https://login.tailscale.com/admin/dns).
1. Check that "MagicDNS" is on; if it is not, press "Enable MagicDNS". MagicDNS gives the devices a readable name in
   place of a number; it is explained in the [MagicDNS](https://tailscale.com/kb/1081/magicdns) page.
1. In the same page, at the "HTTPS Certificates" entry, press "Enable HTTPS" and confirm the warning. Tailscale warns
   that the names of the network's computers appear in the public certificate logs. The name of the BiblioViva computer
   is `biblioviva`, with no data of the school. The page [HTTPS certificates](https://tailscale.com/kb/1153/enabling-https)
   explains the rest. This step gives BiblioViva the browser's padlock, needed by the camera.
1. Write down the name of the school's network (*tailnet*, see the [glossary](../../help/glossary.md#tailnet)),
   written in the "DNS" page: it ends with `.ts.net`. It will be needed at steps 5 and 6.

### Computer tag

1. Open the "Access controls" page of the [admin console](https://login.tailscale.com/admin/acls). The file of the
   network's access rules is shown, a text between curly braces.
1. Add to the file the `tagOwners` entry with BiblioViva's tag. The tag (`tag:biblioviva`) is the way Tailscale
   recognises the BiblioViva computer as a service of the school and not as a person's device.

   ```json
   "tagOwners": {
     "tag:biblioviva": ["autogroup:admin"]
   },
   ```

   The entry goes inside the outermost curly braces of the file, as a section next to those already present, with the
   comma that separates the sections. If the file already contains a `tagOwners` section, add only the line
   `"tag:biblioviva": ["autogroup:admin"]` inside it, separated from the others by a comma.

   > [!WARNING]
   > Do not delete or change the other sections of the file (`grants`, `acls`, `ssh` and the others): they govern what
   > the network's devices can do. When in doubt, copy the whole text of the file into a document before changing it.
   > The file's syntax is explained in the [Policy syntax](https://tailscale.com/kb/1337/policy-syntax) page.

1. Save the file with the page's save button. Tailscale checks the text and reports errors before saving. [VERIFY:
   name of the save button in the rules editor, reachable only when logged in]

### Access key

1. Open the "Keys" page of the [admin console](https://login.tailscale.com/admin/settings/keys).
1. Press "Generate auth key". Tailscale's [Auth keys](https://tailscale.com/kb/1085/auth-keys) page describes the
   form.
1. Write a description, for example `BiblioViva`.
1. Turn on "Reusable" (the key can be used more than once, useful if the installation has to be redone).
1. Turn on "Pre-approved". "Ephemeral" stays off: otherwise the computer would vanish from the network when it is
   switched off.
1. At the "Tags" entry turn on the tags option and choose `tag:biblioviva`. If the tag is not in the list, the rules
   file was not saved: go back to the "Computer tag" part.
1. Leave the duration ("Expiry") that Tailscale proposes, at most 90 days. The key is needed only at step 4, when the
   computer joins the network: afterwards the computer stays in the network even if the key expires.
1. Press "Generate key" and copy the key that appears. Tailscale shows it only once.
1. Paste the key in the safe place chosen. It is needed at step 4, when `setup.sh` asks for it.

> [!IMPORTANT]
> The key is a secret: whoever has it can add devices to the school's network. Do not send it by email, do not write it
> in a chat, do not photograph it. If it has been seen by whoever should not, revoke it from the same "Keys" page and
> generate another.

<!-- screenshot: tailscale/dns | The DNS page of the Tailscale console with MagicDNS and HTTPS Certificates on, and the network name ending in .ts.net -->
<!-- screenshot: tailscale/auth-key | The Generate auth key form with Reusable, Pre-approved and the tag tag:biblioviva -->
<!-- /variant -->
<!-- variant: lan -->
**With the local network**

1. Ask whoever manages the school's network to reserve an address for the computer `biblioviva`, that is, to make the
   router always assign it the same address. It is called "DHCP reservation" or "reserved address" (see the
   [glossary](../../help/glossary.md#dhcp-reservation)). Without this reservation the address can change when
   the computer restarts, and the bookmarks stop working.
1. Give whoever manages the network the computer's name (`biblioviva`). If the router also asks for the physical (MAC)
   address, the person finds it in the list of devices connected to the router.
1. Write down the reserved address that the person communicates (for example `192.168.1.50`): it is needed to open
   BiblioViva from the computers where the name `biblioviva.local` does not work.
1. Ask that port `8080` not be blocked between the desk computers and the BiblioViva computer. In a home network or a
   small school's network it normally is not; it can be in a network with filters or with separate networks for the
   cabled connection and for Wi-Fi.

> [!NOTE]
> The name `biblioviva.local` usually works from the computers of the same network and can be used in place of the
> address; the check is at step 6. On a PC with Debian or Ubuntu the installation program of step 4 adds the necessary
> service (`avahi-daemon`) when it is missing; the Raspberry Pi answers to that name by itself.

> [!NOTE]
> With the local network the camera, the installation of the application on the phone and use from outside the school
> do not work. The USB barcode scanner and the rest of BiblioViva work normally. The complete comparison is in
> [Choose the network](../choose-network.md); the way can be changed later.
<!-- /variant -->

## Check before going on

<!-- variant: tailscale -->
**With Tailscale**

- In the console's "DNS" page, "MagicDNS" and "HTTPS Certificates" are on.
- The access rules file, in "Access controls", contains `tag:biblioviva` in the `tagOwners` section and is saved.
- The access key is written down in the safe place and begins with `tskey-auth-`.
- The network name ending in `.ts.net` is written down.

If one of the points is missing, go back to the procedure before going on to step 4: the installation stops without a
valid key.
<!-- /variant -->
<!-- variant: lan -->
**With the local network**

- Whoever manages the network has confirmed that the address is reserved for the computer `biblioviva`.
- The address (for example `192.168.1.50`) is written down.
- The person who manages the network knows that port `8080` must stay open.

If the reservation cannot be obtained right away, it is possible to go on: BiblioViva works anyway, but the address
might change at the computer's first restart, and the search described at step 6 has to be redone.
<!-- /variant -->

## Possible problems

<!-- variant: tailscale -->
**With Tailscale**

### The tag does not appear among those in the key form

The tag `tag:biblioviva` does not appear among those chosen in the key form: the `tagOwners` entry was not saved or
contains an error. Open "Access controls" again and check that the text is saved.

### After the installation a warning about tags appears

After the installation the warning "requested tags are invalid or not permitted" points to the same cause, that is the
`tagOwners` entry not saved or containing an error; the technical solution is in the page [Deployment notes
(technical)](../../../deploy.md).

### The network name contains the school's name

In the "DNS" page the "Rename tailnet" button allows choosing a random name among those proposed. Do it before turning
on the certificates, because changing the name later breaks the connections already in use. The [Tailnet
name](https://tailscale.com/kb/1217/tailnet-name) page describes the limits.
<!-- /variant -->
<!-- variant: lan -->
**With the local network**

### Whoever manages the network does not know what a DHCP reservation is

It is a function of the router, described in its settings as "static DHCP", "reserved address" or "address
reservation". The glossary gives an explanation for whoever is not of the trade.
<!-- /variant -->

## Related pages

- Previous step: [Connect to the computer](terminal.md)
- Next step: [Install BiblioViva](install.md)
- [Choose the network](../choose-network.md)
- [Glossary](../../help/glossary.md)
