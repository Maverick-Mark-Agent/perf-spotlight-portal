# Workspace API Keys

Generated from `client_registry` — 2026-04-30.

Each workspace has its own Bison API key. To use a key, you must also switch
Bison's context to that workspace's `bison_workspace_id` first:

```bash
curl -X POST 'https://send.maverickmarketingllc.com/api/workspaces/v1.1/switch-workspace' \
  -H 'Authorization: Bearer <api_key>' \
  -H 'Content-Type: application/json' \
  -d '{"team_id": <bison_workspace_id>}'
```

Bison instance base URLs:
- **Maverick** → `https://send.maverickmarketingllc.com/api`
- **Long Run** → `https://send.longrun.agency/api`

## Long Run

| Workspace | Bison ID | Active | API Key |
|-----------|----------|--------|---------|
| ATI | 4 | ❌ | `33|JAJDYuIWjFoKt4pnAWhl0A8HgoyBPSyEU7O0OjgA102630cf` |
| Boring Book Keeping | 16 | ❌ | `34|6Uqpz8Gfu0HjcSHjdjXYbArXNDfyrcwrkY8nuSWx0073546e` |
| Koppa Analytics | 17 | ❌ | `35|MZZAUcBRA3YqBaDV9P9eecqZMQUYyJKg43A8K3VYd259c704` |
| Littlegiant | 19 | ❌ | `36|QstEUfxwvEhqKqlqpBTJkk96OHEnSHWHmGDvI5DEbdb83119` |
| LongRun | 2 | ❌ | `37|bOW26iXNzlzsz67rXy1LMGQBSPWkvddzySRdWmDYc01058d5` |
| Ozment Media | 15 | ❌ | `38|6fLS8Z2GDhUDWXoy628EVLVX2OnmRNSAlYBBfAEr3739d1b6` |
| Radiant Energy | 9 | ❌ | `39|g1QcHjGiVNoA4zHWyaBIb6X9SIsflefBkeNRSGyk4017f41b` |
| Workspark | 14 | ❌ | `_(not set — uses global key)_` |

## Maverick

| Workspace | Bison ID | Active | API Key |
|-----------|----------|--------|---------|
| Anderson Agency | — | ✅ | `_(not set — uses global key)_` |
| Anna Luna Agency | 61 | ✅ | `199|BeEgENdkBsbRTYq9mZEFF9LHXZDkfwsIDCKlTeM7717557a3` |
| ApolloTechné | 13 | ❌ | `_(not set — uses global key)_` |
| Brian Weatherman Agency | 71 | ✅ | `235|gxKFXaQIo7s0nhVVOC7Kzu3mCOxqBnv4yga8lTAkfcfb615b` |
| Casanas Agency | 54 | ❌ | `155|jzzzZ9xyZca2JN5GC2i8mJtAHkLOCmSLUBVBQnts30faea1a` |
| Castle Agency | 48 | ✅ | `152|8ezoiUlDseTu7xa3ERbzO1v1n0oZhqpuhrKrzeOI36233bff` |
| Chris Glover Agency | — | ✅ | `_(not set — uses global key)_` |
| Curtis Ostler Agency | 67 | ✅ | `238|m0kAmTcoF5w5upQ7JW2lUgN4fm2IOi9w2dFaywcZ54b126ef` |
| Danny Schwartz | 36 | ✅ | `80|rEOfuoIPBuREBr5wXSwNDNEpEg2oXE9Dwy52QGre96f810f2` |
| Danny Schwartz 2 | 73 | ✅ | `204|pZ32OW5rnKQ7N9lO9SciWqsUFFLY48YznN8Vc9Bqe358a863` |
| Daryl Bowen | 76 | ✅ | `284|KV0MnMIGHASrJUxvpwuhDHtKQxzEiHeKk3xQJeAG741db882` |
| David Amiri | 25 | ✅ | `81|R3t2GP3Me5QPZFgF9m4yjVpYw6uIeAcPjvWlBQNEde29c77b` |
| Davis Agency | 85 | ✅ | `285|BKnfkDOIeA1P9YdTmqPavzSfABFeTjsxGfXkUH8T76e808b7` |
| Devin Hodo | 37 | ✅ | `82|rZqVRlP6Oyi9AoMLp4uGSjdc3fZsDbOAjqZQcI6hfc1675e2` |
| Drake Agency | 84 | ✅ | `286|OYgPCe0j4iTZakpmG5WbJrYXhHotBxNvY51hkX7q87751a1d` |
| Elgren Agency | 80 | ✅ | `287|HTvmX27VMfXpVupFayxESdZzyesfJgUeOCSjUaVEd5141a2b` |
| Eric Jeglum Agency | 72 | ✅ | `236|R6fizSx0dAjbwcvklZxoUZl5W42Dt6TTUAKdVOXhe595378c` |
| Flowerree Agency | — | ✅ | `_(not set — uses global key)_` |
| Frank Delemos Agency | 69 | ✅ | `234|Ou8Rzh3ZMbrBmRQJdN8OdiB34HJ88E5t7F7y7pmk5b34fc5d` |
| Gaudio Insurance Group | 78 | ✅ | `245|HH3iZBDa4VYgXWHdIqB2FuYoTfrjnizpotL8DEmi9d25b288` |
| Gina Eubanks Agency | 77 | ✅ | `244|ZIbra0tHbgN4TCPJ6hG2XMN3Lmts9ZfrEip31r5h574e0cad` |
| Gregg 2 | 68 | ✅ | `237|Fpsifn13QJl2ooAHu2HULCb4TrVTqryvG807KZTieb7d3cb8` |
| Gregg Blanchard | 44 | ✅ | `83|xsqg2C5rSRnLbJJ8IK231PEhzMM9mjLGoTZQCUms1c22a1de` |
| Heidi Rowan Agency | 70 | ✅ | `233|ni6QEkNydyvegjJwaWgMIfvTbRkU5fC5Y2n9PEmNf6c478eb` |
| Jason Binyon | 3 | ✅ | `84|xwaCyyYiDijdcASC3dKf1A9rTwb3BpBQGJUyCTdH7b5780c5` |
| Jason Park Kansas | 65 | ✅ | `229|9XhvQI2DRsCcWpGPHTuk8uOv1lLpfvSlb8X3wgN63f4f71cc` |
| Jason Park Missouri | 64 | ✅ | `231|7XJPVVWlz5IrZ052sCffJfQutF8sjzC3Gk7fQqY5797ee786` |
| Jason Park Oklahoma | 63 | ✅ | `230|NtaaBpUKsZEI9ZDMluN2FlkI7jIaxvqsc2wl4dT57e2bc116` |
| Jeff Schroder | 26 | ✅ | `85|imN5c7oWCp1aOvufpHoPBKHiV8U0Yz7lTdDhFdBb15f1e28a` |
| Jeff Schroder 2 | 95 | ✅ | `319|jSfpRw2OFrZK69aME2NBiQWbEHuxzKV1kfpdW1wP3b305fde` |
| John Roberts | 28 | ✅ | `86|33Cq5174ilbK8AANqykJXs3iG9VzOU2Z7JlfQx684a3a2568` |
| Kim Wallace | 4 | ✅ | `87|1h9mlKIzgqqIeVGmIgM05i84JhGIXqzLggvafoO8f96c87d0` |
| Kimguice Agency | 82 | ✅ | `288|gtw9owNN2DrcrLxUSxvxKKWS1Pg5icKaPmr5PJD9f0b073f1` |
| Kirk Hodgson | 23 | ✅ | `88|yYBUkyzmBzoyEUfuEvYxcimEvL5l7tEUeszkW7saa512b565` |
| LeBlanc Agency | 50 | ✅ | `153|KFuPzGLysZsYT5VURnhzUqFlST518rOi64zSq8tr4cbbc272` |
| Maison Energy | 10 | ❌ | `_(not set — uses global key)_` |
| Mark Mercer Agency | 60 | ✅ | `200|98jtMdRQCQAYQXrs6EtHJ1jPmbhV7x78ontPOqbLdd2b30c3` |
| Matt Devine Agency | 88 | ✅ | `289|jiizWIPtcQUtFX1UWwBLvQtFig8b4Hot5gCgnGcV35065caf` |
| Maverick In-house | 51 | ✅ | `146|VqNVtXcIzwqi5UFTGuqDoFEXffIH5EvxZfygRAzq56bea9a4` |
| Nick Sakha | 40 | ✅ | `90|VviJlqmhOC3SlNE9kRRfM1oNHpVM6twNMFEHneHYfa7b164e` |
| Noah Sisson | 58 | ✅ | `156|ITzg6TViCtbgiDH5gkdx1C4RmrLNKYNmiuXNV8dif1b1125d` |
| Pennington Insurance | 59 | ✅ | `159|LFRCGimXQ9MYlqj0fC4TJo8nTld5Z2rNG3WScOYL658663ab` |
| ROSSMANN | 11 | ❌ | `_(not set — uses global key)_` |
| Rick Huemmer | 27 | ❌ | `_(not set — uses global key)_` |
| Rob Russell | 24 | ✅ | `91|V0iI58GIxXShE1lm1WGZmMqdwzSdXzRtZH7jw3AHfaca86c0` |
| SAVANTY | 5 | ❌ | `_(not set — uses global key)_` |
| SMA Insurance | 32 | ✅ | `93|UHerd6enxB9Eu6tMnajpP5RO69LR17HgPE4dSFVld0d10ca6` |
| Schrauf Agency | 49 | ✅ | `154|8P1UT8iz3ms9KSKzzmHSjKUZikCM1jKoFI4lkUese0197b01` |
| Shane Miller | 12 | ✅ | `92|1F6DPDoPUvO0oyCcurpyrup2dn4Tv2g1pQGvfWmNe80b5bd6` |
| Small biz Heroes | 15 | ❌ | `_(not set — uses global key)_` |
| Stratlend Mortgage Advisors | 66 | ✅ | `232|WjGR3KPK8ywG5ecqi3J8o963DaAz375XxCTExGx48f51fad0` |
| StreetSmart Commercial | 29 | ✅ | `94|XcQVTpINRzn6JFGJPFJD0cs6beVmQXsQ8WbsftKD70e92d63` |
| StreetSmart P&C | 22 | ✅ | `147|7hpeDCUGzDeboRLLi5Jwvf7DgFnyO63wb112EA41ab715663` |
| StreetSmart Trucking | 9 | ✅ | `97|kws44FxobPd18cpFPukvntLAOr2bcpI0P2upDXz3c60c558a` |
| Tactical Hr | 62 | ✅ | `228|srXlrBu7ba6hrPP2YVQoV8xkYLhTU0C0U63iZzOwa2f3df2d` |
| Terrapin Agency | — | ✅ | `_(not set — uses global key)_` |
| Test Rob Russell | 46 | ❌ | `_(not set — uses global key)_` |
| The Capteam | 56 | ✅ | `151|9wdaoy6mkXH2Y2NggAp1E6wR5NbURmBeyrIiJAUi0bd2bdec` |
| The Capteam Commercial | 89 | ✅ | `323|AK0Y1bQNHxUleeXYvYRK7wZPSm4LMdIu1vBBwtOd8ea0ab81` |
| Thomas's Team | 2 | ❌ | `_(not set — uses global key)_` |
| Tony Schmitz | 41 | ✅ | `95|LISJUmFyQwfsKNsYB0XgQPQkQ5JXDbuVWN9TPBMNf1575525` |
| Victor Agency | — | ✅ | `_(not set — uses global key)_` |
| biz power benifits | 18 | ❌ | `_(not set — uses global key)_` |

## Unknown

| Workspace | Bison ID | Active | API Key |
|-----------|----------|--------|---------|
| Tactical HR | — | ✅ | `_(not set — uses global key)_` |
