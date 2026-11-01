# Choose the network

BiblioViva is reached from the browser, and the installation offers two ways to do it: Tailscale or the school's local
network. This page compares them to help whoever installs to choose one; neither is wrong.

## Comparison

| | Tailscale | Local network |
|---|---|---|
| What it is | A private network between the school's devices, created by a free service | The school's network, already existing |
| Address | `https://biblioviva.<tailnet>.ts.net` | `http://biblioviva.local:8080` or `http://<address of the computer>:8080` |
| Camera (photos of patrons, covers, reading with the phone) | Works | Does not work: the browser denies it on pages without HTTPS |
| Installation as an app on the phone | Possible | Not possible |
| Use from outside the school | Possible, from every device with Tailscale | No: only inside the school's network |
| Account | A free Tailscale account for the school | None |
| Internet | Needed | Not needed to use BiblioViva |
| Devices | The Tailscale app must be installed and connected on each | No installation: the browser is enough |

With both ways the loans desk, the catalogue, the cards, the printing, the reports and the administration work, with
the USB barcode scanner, which types like a keyboard, and with file upload (photos, covers, lists to import).

## Tailscale

[Tailscale](https://tailscale.com/) connects the school's devices in a private network across the internet. The
BiblioViva computer gets an address with a real HTTPS certificate, and for this reason the browser accepts the
functions reserved for secure pages.

Tailscale is the full way. It suits whoever:

- wants to use the camera, for example to photograph covers or to read a code with the phone;
- wants to install BiblioViva as an app on the phone or tablet;
- wants to be able to work from home or from another building too;
- can create a free account and install an app on every device that uses BiblioViva.

The address `https://biblioviva.<tailnet>.ts.net` works only from a device that has the Tailscale app, with the
school's account. The school's computer and the internet connection must work for the connection to succeed.

### The school's Tailscale account

A Tailscale account can be used in two ways.

1. One school account, used on every device. A single free account is created, for example with the library's email
   address, and it is logged in on the desk computer, on the phone and on the tablet. It is the simplest way and falls
   within the free plan, whose limits are on the [Tailscale pricing](https://tailscale.com/pricing) page.
1. Invited personal accounts. Each person uses their own Tailscale account and receives an invitation to the school's
   network. This keeps track of who connects and lets access be removed from a single person, but the administration
   is more laborious and the free plan limits the number of users (see the pricing page).

For a school library the first way is the recommended one. The users of Tailscale and those of BiblioViva are
distinct things: whoever uses BiblioViva logs in with one of the shared accounts of the roles (`admin`, `prestiti`,
`catalogo`, `tessere`, `report`), whatever the Tailscale account with which the network is connected.

The step [Prepare the network](steps/network.md) describes the creation of the account.

## Local network

With the local network BiblioViva is reachable from every device connected to the school's network, with no account
and nothing to install: it is enough to open the address in the browser. It is the basic way.

The local network suits whoever:

- works only at the loans desk and in the library, with the USB barcode scanner;
- prefers not to create accounts or install apps;
- does not need the camera or use from outside the school.

Two cautions apply to this way.

- The connection is not encrypted (HTTP): the roles' passwords travel in clear over the network. The way suits a
  network the school trusts.
- The computer's address must not change over time. The person who manages the school's network is asked to reserve a
  fixed address on the router for the computer. The name `biblioviva.local` works in many cases with nothing else, but
  not on all devices; in that case the numeric address is used, for example `http://192.168.1.50:8080`.

The step [Prepare the network](steps/network.md) describes the address reservation.

## Change the way later

The choice is not final. One can start with the local network and switch to Tailscale when the camera is needed,
keeping all the data: see [Switch from the local network to Tailscale](lan-to-tailscale.md). The reverse path, from
Tailscale to the local network, also keeps the data and is described in the same page, in the section
[The reverse: from Tailscale to the local network](lan-to-tailscale.md#the-reverse-from-tailscale-to-the-local-network).

## Related pages

- [Choose the computer](choose-computer.md)
- [Requirements](material.md)
- [Installation](README.md)
- [Common problems](../help/problems.md)
