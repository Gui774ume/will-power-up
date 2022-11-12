# Will's Power Up

This project is a custom Power-Up for my Trello boards. This Power-Up adds the following feature:
- The ability to store and visualize location and direction data for cards:

![Location component](documentation/images/location_component.png)

## TODO

- The ability to sync the due date of a card to a Google Calendar (+ event duration)
- The ability to create Google Calendar events from the items of a checklist that contain a [date | time | duration | location] pattern
- The ability to periodically archive the cards of a list to another board, into a newly generated list
- The ability to import the events of a Google Calendar to the board
- The ability to query the weather for the provided locations of a card


## Getting started

### Add the Power-Up to your board

If you want to use this Power-Up as is:
- head to your Power-Ups admin page (👉 [https://trello.com/power-ups/admin](https://trello.com/power-ups/admin))
- create a new Power-Up with the following connector URL: [https://gui774ume.github.io/will-power-up](https://gui774ume.github.io/will-power-up)

You can also fork this repository, enable GitHub Pages on the main branch and follow the same steps as above, with your own connector URL.

### Provide a Google API Key

Some features of this Power-Up require a [Google API Key](https://cloud.google.com/docs/authentication/api-keys). You can configure this API key from the "settings" widget of the Power-Up.
Depending on which feature of the Power-Up you want to use, you'll need to configure your API key with the correct access rights.

We recommend you apply the following restrictions to your API key:
- Application restrictions: select `HTTP referrers (web sites)`
- Website restrictions: `gui774ume.github.io` (or your own domain)
- API restrictions:
  - The location and direction feature requires at least the `Maps Embed API`. If you want to enable the location autocomplete feature, add `Maps Javascript API` and `Places API` (monitor your usage, Google will make you pay for the autocomplete feature). You can disable the autocomplete feature from the settings of the Power-Up.