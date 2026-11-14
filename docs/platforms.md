# Supported vacuum platforms

*Better Xiaomi Vacuum Map Card* carries the upstream platform templates unchanged. A platform
page lists the templates it provides, the entities the card discovers and the service calls it
uses. Set the platform in a preset with `vacuum_platform` and leave everything else as the page
shows.

## Supported vacuum platforms

Following vacuum platforms are supported out of the box at this moment:

- [`Xiaomi Miio`](templates/xiaomiMiio.md)
- [`Roborock`](templates/Roborock.md)
- [`humbertogontijo/homeassistant-roborock`](templates/humbertogontijoHomeassistantRoborock.md)
- [`Tasshack/dreame-vacuum`](templates/tasshackDreameVacuum.md)
- [`rand256/ValetudoRE`](templates/rand256ValetudoRe.md)
- [`Hypfer/Valetudo`](templates/hypferValetudo.md)
- [`marotoweb/viomi SE`](templates/marotowebViomise.md)
- [`tykarol/ViomiVacuumV8`](templates/tykarolViomiVacuumV8.md)
- [`KrzysztofHajdamowicz/miio2`](templates/krzysztofHajdamowiczMiio2.md)
- [`send_command`](templates/sendCommand.md)
- [`al-one/Xiaomi MIoT`](templates/alOneHassXiaomiMiot.md) (additional manual configuration required)
- [`Neato`](templates/neato.md)
- [`Roomba`](templates/roomba.md)
- [`DeebotUniverse/Deebot-4-Home-Assistant`](templates/DeebotUniverseDeebot4homeAssistant.md)
- [`romedtino/simple-wyze-vac`](templates/romedtinoSimpleWyze.md)
- [`BenjaminPaap/home-assistant-myneato`](templates/BenjaminPaapMyNeato.md)
- [`CoderAS-ru/hass-neatsvor`](templates/CoderASruNeatsvor.md)
- [`johnnyh1975/ha_roomba_plus`](templates/johnnyh1975RoombaPlus.md)

[Adding a new platform](../CONTRIBUTING.md#adding-new-platform). Platform templates are shared with
upstream, so platform requests go to the
[upstream tracker](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/new?labels=new+platform&template=new_platform_request.yml).

## Getting coordinates

Setup platforms make it easier to retrieve vacuum coordinates for zones, points and room outlines
without a separate coordinate tool. The [setup platforms guide](templates/setup.md#getting-coordinates)
walks through the editor picker and the copy button.

The platform pages themselves are unchanged from upstream. A template is only claimed as tested
when a fixture or a real instance backs it; see the [maintenance model](../README.md#project)
for what that means for hardware-specific features.
